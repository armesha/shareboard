import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config, SOCKET_EVENTS, SHARING_MODES } from './config.js';
import * as workspaceService from './services/workspaceService.js';
import * as permissionService from './services/permissionService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: config.cors,
  ...config.socketIO,
});

const updateQueues = new Map();
const BATCH_INTERVAL = 50;

function queueUpdate(workspaceId, elements, senderSocketId) {
  if (!updateQueues.has(workspaceId)) {
    updateQueues.set(workspaceId, { elements: new Map(), senders: new Set() });
  }
  const queue = updateQueues.get(workspaceId);
  queue.senders.add(senderSocketId);
  elements.forEach(el => {
    if (el?.id) queue.elements.set(el.id, el);
  });
}

setInterval(() => {
  for (const [workspaceId, queue] of updateQueues.entries()) {
    if (queue.elements.size > 0) {
      const batchedElements = Array.from(queue.elements.values());
      const senders = new Set(queue.senders);
      const roomSockets = io.sockets.adapter.rooms.get(workspaceId);

      queue.elements.clear();
      queue.senders.clear();

      if (roomSockets) {
        setImmediate(() => {
          for (const socketId of roomSockets) {
            if (!senders.has(socketId)) {
              const socket = io.sockets.sockets.get(socketId);
              if (socket) {
                socket.emit(SOCKET_EVENTS.WHITEBOARD_UPDATE, batchedElements);
              }
            }
          }
        });
      }
    }
  }
}, BATCH_INTERVAL);

setInterval(workspaceService.cleanupInactiveWorkspaces, config.cleanup.intervalMs);

app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, '../client')));

if (config.isProduction) {
  app.use(express.static(join(__dirname, '../dist')));
}

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, '../client/index.html'));
});

app.post('/api/workspaces', (req, res) => {
  const workspaceId = workspaceService.generateKey();
  const userId = req.body.userId || workspaceService.generateKey(config.workspace.userIdLength);
  workspaceService.createWorkspace(workspaceId, userId);
  res.json({ workspaceId });
});

app.get('/w/:workspaceId', (req, res) => {
  const indexPath = config.isProduction
    ? join(__dirname, '../dist/index.html')
    : join(__dirname, '../client/index.html');
  res.sendFile(indexPath);
});

app.get('/api/workspace/:workspaceId', (req, res) => {
  const { workspaceId } = req.params;
  if (!workspaceService.workspaceExists(workspaceId)) {
    return res.status(404).json({ error: 'Workspace not found' });
  }
  res.json({ exists: true });
});

io.on(SOCKET_EVENTS.CONNECTION, (socket) => {
  let currentWorkspace = null;
  const currentUser = { id: socket.id, joinedAt: Date.now() };
  workspaceService.setUserSession(socket.id, currentUser);

  socket.on(SOCKET_EVENTS.JOIN_WORKSPACE, ({ workspaceId, userId, accessToken }) => {
    let workspace = workspaceService.getWorkspace(workspaceId);
    let isNewWorkspace = false;

    if (!workspace) {
      isNewWorkspace = true;
      workspace = workspaceService.createWorkspace(workspaceId, userId || socket.id);
    }

    currentUser.userId = userId || socket.id;
    currentUser.workspaceId = workspaceId;

    const { hasEditAccess, isOwner } = permissionService.calculateEditAccess(workspace, currentUser, accessToken);
    currentUser.hasEditAccess = hasEditAccess;
    currentUser.isOwner = isNewWorkspace || isOwner;

    if (isNewWorkspace) {
      workspace.owner = currentUser.userId;
      currentUser.hasEditAccess = true;
    }

    permissionService.validateAndSetToken(workspace, accessToken, currentUser);

    if (currentWorkspace) {
      const prevWorkspaceId = workspaceService.findWorkspaceIdByRef(currentWorkspace);
      if (prevWorkspaceId) {
        socket.leave(prevWorkspaceId);
        workspaceService.removeConnection(prevWorkspaceId, socket.id);
        const activeUsers = workspaceService.getActiveUserCount(prevWorkspaceId);
        io.to(prevWorkspaceId).emit(SOCKET_EVENTS.USER_LEFT, { userId: socket.id, activeUsers });
      }
    }

    workspaceService.addConnection(workspaceId, socket.id);
    const activeUsers = workspaceService.getActiveUserCount(workspaceId);
    socket.join(workspaceId);
    currentWorkspace = workspace;
    workspaceService.updateLastActivity(workspaceId);

    socket.emit(SOCKET_EVENTS.WORKSPACE_STATE, {
      ...workspaceService.getWorkspaceState(workspaceId),
      isNewWorkspace
    });
    socket.emit(SOCKET_EVENTS.SHARING_INFO, permissionService.getSharingInfo(workspace, currentUser));
    socket.to(workspaceId).emit(SOCKET_EVENTS.USER_JOINED, { userId: socket.id, activeUsers });
  });

  socket.on(SOCKET_EVENTS.GET_SHARING_INFO, ({ workspaceId, userId, accessToken }) => {
    const workspace = workspaceService.getWorkspace(workspaceId);
    if (!workspace) return;

    if (userId) currentUser.userId = userId;

    const { hasEditAccess, isOwner } = permissionService.calculateEditAccess(workspace, currentUser, accessToken);
    currentUser.isOwner = isOwner;
    currentUser.hasEditAccess = hasEditAccess;

    permissionService.validateAndSetToken(workspace, accessToken, currentUser);
    socket.emit(SOCKET_EVENTS.SHARING_INFO, permissionService.getSharingInfo(workspace, currentUser));
  });

  socket.on(SOCKET_EVENTS.GET_ACTIVE_USERS, ({ workspaceId }) => {
    const users = workspaceService.getWorkspaceUsers(workspaceId);
    socket.emit(SOCKET_EVENTS.ACTIVE_USERS_UPDATE, { activeUsers: users });
  });

  socket.on(SOCKET_EVENTS.WHITEBOARD_UPDATE, ({ workspaceId, elements }) => {
    const workspace = workspaceService.getWorkspace(workspaceId);
    if (!workspace || !Array.isArray(elements)) return;

    if (!permissionService.checkWritePermission(workspace, currentUser)) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'You do not have permission to edit' });
      return;
    }

    workspaceService.updateLastActivity(workspaceId);

    const drawingsMap = workspace.drawingsMap;
    const allDrawingsMap = workspace.allDrawingsMap;
    const drawingOrder = workspace.drawingOrder;

    const MAX_DRAWINGS = 5000;

    elements.forEach(element => {
      if (element?.id) {
        const newElement = { ...element, timestamp: Date.now() };
        const isNew = !drawingsMap.has(element.id);
        drawingsMap.set(element.id, newElement);
        allDrawingsMap.set(element.id, newElement);
        if (isNew) {
          drawingOrder.push(element.id);
        }
      }
    });

    while (allDrawingsMap.size > MAX_DRAWINGS && drawingOrder.length > 0) {
      const oldestId = drawingOrder.shift();
      allDrawingsMap.delete(oldestId);
    }

    queueUpdate(workspaceId, elements, socket.id);
  });

  socket.on(SOCKET_EVENTS.WHITEBOARD_CLEAR, ({ workspaceId }) => {
    const workspace = workspaceService.getWorkspace(workspaceId);
    if (!workspace) return;

    if (!permissionService.checkWritePermission(workspace, currentUser)) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'You do not have permission to clear' });
      return;
    }

    workspaceService.updateLastActivity(workspaceId);
    workspace.drawings = [];
    workspace.allDrawings = [];
    workspace.drawingsMap.clear();
    workspace.allDrawingsMap.clear();
    workspace.drawingOrder.length = 0;
    socket.broadcast.to(workspaceId).emit(SOCKET_EVENTS.WHITEBOARD_CLEAR);
  });

  socket.on(SOCKET_EVENTS.REQUEST_CANVAS_STATE, (workspaceId) => {
    const state = workspaceService.getWorkspaceState(workspaceId);
    if (state) socket.emit(SOCKET_EVENTS.WORKSPACE_STATE, state);
  });

  socket.on(SOCKET_EVENTS.DELETE_ELEMENT, ({ workspaceId, elementId }) => {
    const workspace = workspaceService.getWorkspace(workspaceId);
    if (!workspace || !elementId) return;

    if (!permissionService.checkWritePermission(workspace, currentUser)) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'You do not have permission to delete' });
      return;
    }

    workspaceService.updateLastActivity(workspaceId);

    workspace.drawingsMap.delete(elementId);
    workspace.allDrawingsMap.delete(elementId);

    socket.broadcast.to(workspaceId).emit(SOCKET_EVENTS.DELETE_ELEMENT, { workspaceId, elementId });
  });

  socket.on(SOCKET_EVENTS.DELETE_DIAGRAM, ({ workspaceId, diagramId }) => {
    const workspace = workspaceService.getWorkspace(workspaceId);
    if (!workspace) return;

    if (!permissionService.checkWritePermission(workspace, currentUser)) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'You do not have permission to delete diagram' });
      return;
    }

    workspaceService.updateLastActivity(workspaceId);
    workspace.diagrams.delete(diagramId);
    workspace.drawings = workspace.drawings.filter(el => el.id !== diagramId);
    socket.broadcast.to(workspaceId).emit(SOCKET_EVENTS.DELETE_DIAGRAM, { diagramId });
  });

  socket.on(SOCKET_EVENTS.CODE_UPDATE, ({ workspaceId, language, content }) => {
    const workspace = workspaceService.getWorkspace(workspaceId);
    if (!workspace) return;

    if (!permissionService.checkWritePermission(workspace, currentUser)) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'You do not have permission to edit code' });
      return;
    }

    workspaceService.updateLastActivity(workspaceId);
    workspace.codeSnippets = { language, content };
    socket.broadcast.to(workspaceId).emit(SOCKET_EVENTS.CODE_UPDATE, { language, content });
  });

  socket.on(SOCKET_EVENTS.DIAGRAM_UPDATE, ({ workspaceId, content }) => {
    const workspace = workspaceService.getWorkspace(workspaceId);
    if (!workspace) return;

    if (!permissionService.checkWritePermission(workspace, currentUser)) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'You do not have permission to edit diagram' });
      return;
    }

    workspaceService.updateLastActivity(workspaceId);
    workspace.diagramContent = content;
    socket.to(workspaceId).emit(SOCKET_EVENTS.DIAGRAM_UPDATE, { content });
  });

  socket.on(SOCKET_EVENTS.CURSOR_POSITION, ({ workspaceId, position }) => {
    if (workspaceService.workspaceExists(workspaceId)) {
      socket.to(workspaceId).emit(SOCKET_EVENTS.CURSOR_UPDATE, { userId: socket.id, position });
    }
  });

  socket.on(SOCKET_EVENTS.GET_EDIT_TOKEN, ({ workspaceId }, callback) => {
    const workspace = workspaceService.getWorkspace(workspaceId);
    if (!workspace) {
      callback?.({ error: 'Workspace not found' });
      return;
    }

    if (!permissionService.checkOwnership(workspace, currentUser.userId) && !currentUser.isOwner) {
      callback?.({ error: 'Permission denied' });
      return;
    }

    callback?.({ editToken: workspace.editToken || null });
  });

  socket.on(SOCKET_EVENTS.SET_EDIT_TOKEN, ({ workspaceId, editToken }) => {
    const workspace = workspaceService.getWorkspace(workspaceId);
    if (!workspace) return;

    if (!permissionService.checkOwnership(workspace, currentUser.userId) && !currentUser.isOwner) {
      return;
    }

    if (editToken?.startsWith('edit_')) {
      workspace.editToken = editToken;
      io.to(workspaceId).emit(SOCKET_EVENTS.EDIT_TOKEN_UPDATED, { editToken });
    }
  });

  socket.on(SOCKET_EVENTS.INVITE_USER, ({ workspaceId, email }, callback) => {
    const workspace = workspaceService.getWorkspace(workspaceId);
    if (!workspace) {
      callback?.({ error: 'Workspace not found' });
      return;
    }
    const userId = email.toLowerCase().replace(/[^a-z0-9]/g, '-');
    callback?.({ userId });
  });

  socket.on(SOCKET_EVENTS.CHANGE_SHARING_MODE, ({ workspaceId, sharingMode }) => {
    const workspace = workspaceService.getWorkspace(workspaceId);
    if (!workspace) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Workspace not found' });
      return;
    }

    if (!permissionService.checkOwnership(workspace, currentUser.userId)) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Only the workspace owner can change sharing mode' });
      return;
    }

    const validModes = Object.values(SHARING_MODES);
    if (!validModes.includes(sharingMode)) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid sharing mode' });
      return;
    }

    const success = workspaceService.updateSharingMode(workspaceId, sharingMode);
    if (success) {
      io.to(workspaceId).emit(SOCKET_EVENTS.SHARING_MODE_CHANGED, {
        sharingMode,
        editToken: workspace.editToken
      });
    }
  });

  socket.on(SOCKET_EVENTS.END_SESSION, ({ workspaceId }) => {
    const workspace = workspaceService.getWorkspace(workspaceId);
    if (!workspace) return;

    if (!permissionService.checkOwnership(workspace, currentUser.userId)) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Only the workspace owner can end the session' });
      return;
    }

    io.to(workspaceId).emit(SOCKET_EVENTS.SESSION_ENDED, { message: 'The workspace owner has ended this session' });

    const connections = workspaceService.getActiveConnections(workspaceId);
    for (const socketId of connections) {
      const clientSocket = io.sockets.sockets.get(socketId);
      if (clientSocket && clientSocket.id !== socket.id) {
        clientSocket.leave(workspaceId);
      }
    }
  });

  socket.on(SOCKET_EVENTS.DISCONNECT, () => {
    if (currentWorkspace) {
      const workspaceId = workspaceService.findWorkspaceIdByRef(currentWorkspace);
      if (workspaceId) {
        workspaceService.removeConnection(workspaceId, socket.id);
        const activeUsers = workspaceService.getActiveUserCount(workspaceId);
        io.to(workspaceId).emit(SOCKET_EVENTS.USER_LEFT, { userId: socket.id, activeUsers });
      }
    }

    workspaceService.removeUserSession(socket.id);
  });
});

httpServer.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});
