import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config, SOCKET_EVENTS } from './config.js';
import * as workspaceService from './services/workspaceService.js';
import * as permissionService from './services/permissionService.js';
import * as handlers from './handlers/socketHandlers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: config.cors,
  ...config.socketIO,
});

const updateQueues = new Map();

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
}, config.batch.interval);

setInterval(workspaceService.cleanupInactiveWorkspaces, config.cleanup.intervalMs);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(cors());
app.use(express.json());

const createWorkspaceLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many workspaces created, please try again later' }
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later' }
});

if (config.isProduction) {
  app.use(express.static(join(__dirname, '../dist')));
} else {
  app.use(express.static(join(__dirname, '../client')));
}

app.get('/', (req, res) => {
  const indexPath = config.isProduction
    ? join(__dirname, '../dist/index.html')
    : join(__dirname, '../client/index.html');
  res.sendFile(indexPath);
});

app.post('/api/workspaces', createWorkspaceLimiter, (req, res) => {
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

app.get('/api/workspace/:workspaceId', apiLimiter, (req, res) => {
  const { workspaceId } = req.params;
  if (!workspaceService.workspaceExists(workspaceId)) {
    return res.status(404).json({ error: 'Workspace not found' });
  }
  res.json({ exists: true });
});

io.on(SOCKET_EVENTS.CONNECTION, (socket) => {
  const currentWorkspaceRef = { current: null };
  const currentUser = { id: socket.id, joinedAt: Date.now() };
  workspaceService.setUserSession(socket.id, currentUser);

  socket.on('error', (error) => {
    console.error(`Socket error for ${socket.id}:`, error);
  });

  const eventCounts = new Map();
  const RATE_LIMIT_WINDOW = 1000;
  const MAX_EVENTS_PER_WINDOW = 50;

  const checkRateLimit = (eventName) => {
    const now = Date.now();
    const key = `${socket.id}:${eventName}`;
    const record = eventCounts.get(key) || { count: 0, windowStart: now };

    if (now - record.windowStart > RATE_LIMIT_WINDOW) {
      record.count = 1;
      record.windowStart = now;
    } else {
      record.count++;
    }

    eventCounts.set(key, record);
    return record.count <= MAX_EVENTS_PER_WINDOW;
  };

  socket.on(SOCKET_EVENTS.CHECK_WORKSPACE_EXISTS, ({ workspaceId }) => {
    try {
      const exists = workspaceService.workspaceExists(workspaceId);
      socket.emit(SOCKET_EVENTS.WORKSPACE_EXISTS_RESULT, { workspaceId, exists });
    } catch (error) {
      console.error('CHECK_WORKSPACE_EXISTS error:', error);
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to check workspace' });
    }
  });

  socket.on(SOCKET_EVENTS.JOIN_WORKSPACE, (data) => {
    const result = handlers.handleJoinWorkspace(data, {
      socket,
      io,
      currentUser,
      currentWorkspaceRef,
      queueUpdate
    });

    if (result.success) {
      console.log(`User ${socket.id} joined workspace ${data.workspaceId}`);
    } else {
      console.error('JOIN_WORKSPACE error:', result.error);
    }
  });

  socket.on(SOCKET_EVENTS.GET_SHARING_INFO, ({ workspaceId, userId, accessToken }) => {
    try {
      const workspace = workspaceService.getWorkspace(workspaceId);
      if (!workspace) return;

      if (userId) currentUser.userId = userId;

      const { hasEditAccess, isOwner } = permissionService.calculateEditAccess(workspace, currentUser, accessToken);
      currentUser.isOwner = isOwner;
      currentUser.hasEditAccess = hasEditAccess;

      permissionService.validateAndSetToken(workspace, accessToken, currentUser);
      socket.emit(SOCKET_EVENTS.SHARING_INFO, permissionService.getSharingInfo(workspace, currentUser));
    } catch (error) {
      console.error('GET_SHARING_INFO error:', error);
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to get sharing info' });
    }
  });

  socket.on(SOCKET_EVENTS.GET_ACTIVE_USERS, ({ workspaceId }) => {
    try {
      const users = workspaceService.getWorkspaceUsers(workspaceId);
      socket.emit(SOCKET_EVENTS.ACTIVE_USERS_UPDATE, { activeUsers: users });
    } catch (error) {
      console.error('GET_ACTIVE_USERS error:', error);
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to get active users' });
    }
  });

  socket.on(SOCKET_EVENTS.WHITEBOARD_UPDATE, (data) => {
    if (!checkRateLimit(SOCKET_EVENTS.WHITEBOARD_UPDATE)) {
      return;
    }
    handlers.handleWhiteboardUpdate(data, {
      socket,
      currentUser,
      queueUpdate
    });
  });

  socket.on(SOCKET_EVENTS.WHITEBOARD_CLEAR, (data) => {
    if (!checkRateLimit(SOCKET_EVENTS.WHITEBOARD_CLEAR)) {
      return;
    }
    handlers.handleWhiteboardClear(data, {
      socket,
      currentUser
    });
  });

  socket.on(SOCKET_EVENTS.REQUEST_CANVAS_STATE, (workspaceId) => {
    try {
      const state = workspaceService.getWorkspaceState(workspaceId);
      if (state) socket.emit(SOCKET_EVENTS.WORKSPACE_STATE, state);
    } catch (error) {
      console.error('REQUEST_CANVAS_STATE error:', error);
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to get canvas state' });
    }
  });

  socket.on(SOCKET_EVENTS.DELETE_ELEMENT, (data) => {
    if (!checkRateLimit(SOCKET_EVENTS.DELETE_ELEMENT)) {
      return;
    }
    handlers.handleDeleteElement(data, {
      socket,
      currentUser
    });
  });

  socket.on(SOCKET_EVENTS.DELETE_DIAGRAM, (data) => {
    handlers.handleDeleteDiagram(data, {
      socket,
      currentUser
    });
  });

  socket.on(SOCKET_EVENTS.CODE_UPDATE, (data) => {
    if (!checkRateLimit(SOCKET_EVENTS.CODE_UPDATE)) {
      return;
    }
    handlers.handleCodeUpdate(data, {
      socket,
      currentUser
    });
  });

  socket.on(SOCKET_EVENTS.DIAGRAM_UPDATE, (data) => {
    if (!checkRateLimit(SOCKET_EVENTS.DIAGRAM_UPDATE)) {
      return;
    }
    handlers.handleDiagramUpdate(data, {
      socket,
      currentUser
    });
  });

  socket.on(SOCKET_EVENTS.CURSOR_POSITION, ({ workspaceId, position, userColor, animalKey }) => {
    if (!checkRateLimit(SOCKET_EVENTS.CURSOR_POSITION)) {
      return;
    }
    try {
      if (workspaceService.workspaceExists(workspaceId)) {
        socket.to(workspaceId).emit(SOCKET_EVENTS.CURSOR_UPDATE, {
          userId: socket.id,
          position,
          userColor,
          animalKey
        });
      }
    } catch (error) {
      console.error('CURSOR_POSITION error:', error);
    }
  });

  socket.on(SOCKET_EVENTS.GET_EDIT_TOKEN, (data, callback) => {
    handlers.handleGetEditToken(data, callback, { currentUser });
  });

  socket.on(SOCKET_EVENTS.SET_EDIT_TOKEN, (data) => {
    handlers.handleSetEditToken(data, {
      socket,
      io,
      currentUser
    });
  });

  socket.on(SOCKET_EVENTS.INVITE_USER, (data, callback) => {
    handlers.handleInviteUser(data, callback);
  });

  socket.on(SOCKET_EVENTS.CHANGE_SHARING_MODE, (data) => {
    handlers.handleChangeSharingMode(data, {
      socket,
      io,
      currentUser
    });
  });

  socket.on(SOCKET_EVENTS.END_SESSION, (data) => {
    handlers.handleEndSession(data, {
      socket,
      io,
      currentUser
    });
  });

  socket.on(SOCKET_EVENTS.DISCONNECT, () => {
    handlers.handleDisconnect({
      socket,
      io,
      currentWorkspaceRef
    });
  });
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

io.on('error', (error) => {
  console.error('Socket.io error:', error);
});

httpServer.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});
