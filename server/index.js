import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import crypto from 'crypto';
import DiagramHandler from './src/handlers/diagramHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:5173']
  }
});

const workspaces = new Map();
const activeConnections = new Map();
const userSessions = new Map(); // Maps socket IDs to user info

function generateWorkspaceKey(length = 6) {
  const bytes = crypto.randomBytes(Math.ceil(length * 3 / 4));
  const base64 = bytes.toString('base64');
  return base64
    .replace(/[+/]/g, '')
    .replace(/=+$/, '')
    .slice(0, length);
}

const cleanupInactiveWorkspaces = () => {
  for (const [workspaceId, workspace] of workspaces.entries()) {
    const connections = activeConnections.get(workspaceId) || new Set();
    if (connections.size === 0 && Date.now() - workspace.lastActivity > 24 * 60 * 60 * 1000) {
      workspaces.delete(workspaceId);
      activeConnections.delete(workspaceId);
    }
  }
};

setInterval(cleanupInactiveWorkspaces, 60 * 60 * 1000);

app.use(cors());
app.use(express.json());

app.use(express.static(join(__dirname, '../client')));

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '../dist')));
}

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, '../client/index.html'));
});

app.post('/api/workspaces', (req, res) => {
  const workspaceId = generateWorkspaceKey();
  const userId = req.body.userId || generateWorkspaceKey(10);
  
  workspaces.set(workspaceId, {
    id: workspaceId,
    created: Date.now(),
    lastActivity: Date.now(),
    diagrams: new Map(),
    drawings: [],
    allDrawings: [],
    drawingHistory: [],
    owner: userId,
    sharingMode: 'read-write-all',
    allowedUsers: [] 
  });
  
  res.json({ workspaceId });
});

app.get('/w/:workspaceId', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    res.sendFile(join(__dirname, '../dist/index.html'));
  } else {
    res.sendFile(join(__dirname, '../client/index.html'));
  }
});

app.get('/api/workspace/:workspaceId', (req, res) => {
  const { workspaceId } = req.params;
  const workspace = workspaces.get(workspaceId);
  
  if (!workspace) {
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }
  
  res.json({ exists: true });
});

const SAMPLE_DIAGRAM = '';

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  let currentWorkspace = null;
  let currentUser = {
    id: socket.id,
    joinedAt: Date.now()
  };
  
  userSessions.set(socket.id, currentUser);

  socket.on('join-workspace', ({ workspaceId, userId, accessToken }) => {
    console.log(`User ${socket.id} joining workspace ${workspaceId} with userId ${userId}`, accessToken ? `and access token ${accessToken}` : '');
    let workspace = workspaces.get(workspaceId);
    let isNewWorkspace = false;
    
    if (!workspace) {
      isNewWorkspace = true;
      workspace = {
        id: workspaceId,
        created: Date.now(),
        lastActivity: Date.now(),
        diagrams: new Map(),
        drawings: [],
        allDrawings: [],
        diagramContent: '',
        owner: userId || socket.id,
        sharingMode: 'read-write-all',
        allowedUsers: [],
        editToken: null 
      };
      workspaces.set(workspaceId, workspace);
      
      console.log(`Created new workspace ${workspaceId} with owner ${userId || socket.id}`);
    }

    currentUser.userId = userId || socket.id;
    currentUser.workspaceId = workspaceId;
    currentUser.hasEditAccess = false; 
    
    const isOwner = workspace.owner === currentUser.userId;
    currentUser.isOwner = isOwner;
    
    if (isNewWorkspace) {
      currentUser.isOwner = true;
      workspace.owner = currentUser.userId;
    }
    
    if (currentUser.isOwner) {
      currentUser.hasEditAccess = true;
    } 
    else if (workspace.sharingMode === 'read-write-all') {
      currentUser.hasEditAccess = true;
    }
    else if (workspace.sharingMode === 'read-write-selected') {
      if (accessToken && workspace.editToken && accessToken === workspace.editToken) {
        currentUser.hasEditAccess = true;
        console.log(`User ${currentUser.userId} granted edit access via token`);
      }
    }
    
    if (accessToken && accessToken.startsWith('edit_') && !workspace.editToken) {
      workspace.editToken = accessToken;
      console.log(`Set first edit token for workspace ${workspaceId}: ${accessToken}`);
      
      if (workspace.sharingMode === 'read-write-selected') {
        currentUser.hasEditAccess = true;
        console.log(`User ${currentUser.userId} granted edit access via first token`);
      }
    }

    console.log(`User ${socket.id} joining workspace ${workspaceId}:`, { 
      userId: currentUser.userId,
      owner: workspace.owner,
      isOwner: currentUser.isOwner,
      hasEditAccess: currentUser.hasEditAccess,
      sharingMode: workspace.sharingMode,
      isNewWorkspace,
      workspaceEditToken: workspace.editToken || 'none',
      providedToken: accessToken || 'none'
    });

    if (currentWorkspace) {
      const prevWorkspaceId = Object.keys(workspaces).find(key => workspaces.get(key) === currentWorkspace);
      if (prevWorkspaceId) {
        socket.leave(prevWorkspaceId);
        const connections = activeConnections.get(prevWorkspaceId);
        if (connections) {
          connections.delete(socket.id);
          io.to(prevWorkspaceId).emit('user-left', {
            userId: socket.id,
            activeUsers: connections.size
          });
        }
      }
    }

    if (!activeConnections.has(workspaceId)) {
      activeConnections.set(workspaceId, new Set());
    }
    activeConnections.get(workspaceId).add(socket.id);
    
    socket.join(workspaceId);
    currentWorkspace = workspace;
    workspace.lastActivity = Date.now();

    const initialState = {
      whiteboardElements: workspace.drawings || [],
      diagrams: Array.from(workspace.diagrams.values()) || [],
      activeUsers: activeConnections.get(workspaceId).size,
      allDrawings: workspace.allDrawings || [],
      codeSnippets: workspace.codeSnippets || { language: 'javascript', content: '' },
      diagramContent: workspace.diagramContent || SAMPLE_DIAGRAM
    };

    console.log(`Sending initial state to user ${socket.id}:`, {
      whiteboardElementsCount: initialState.whiteboardElements.length,
      diagramsCount: initialState.diagrams.length,
      allDrawingsCount: initialState.allDrawings.length,
      activeUsers: initialState.activeUsers
    });

    socket.emit('workspace-state', initialState);
    
    socket.emit('sharing-info', {
      sharingMode: workspace.sharingMode,
      allowedUsers: workspace.allowedUsers,
      isOwner: currentUser.isOwner,
      currentUser: currentUser.userId,
      owner: workspace.owner,
      hasEditAccess: currentUser.hasEditAccess,
      editToken: workspace.editToken // Always send the token to all users
    });
    
    socket.to(workspaceId).emit('user-joined', { 
      userId: socket.id,
      activeUsers: activeConnections.get(workspaceId).size
    });
  });

  socket.on('get-sharing-info', ({ workspaceId, userId, accessToken }) => {
    const workspace = workspaces.get(workspaceId);
    if (!workspace) return;
    
    if (userId) {
      currentUser.userId = userId;
      if (workspace.owner === userId) {
        currentUser.isOwner = true;
      } else {
        currentUser.isOwner = false;
      }
    }
    
    let hasEditAccess = false;
    
    if (workspace.owner === currentUser.userId) {
      hasEditAccess = true;
    }
    else if (workspace.sharingMode === 'read-write-all') {
      hasEditAccess = true;
    }
    else if (workspace.sharingMode === 'read-write-selected') {
      if (accessToken && workspace.editToken && accessToken === workspace.editToken) {
        hasEditAccess = true;
        currentUser.hasEditAccess = true;
        console.log(`User ${currentUser.userId} granted edit access via token in get-sharing-info`);
      }
    }
    
    if (accessToken && accessToken.startsWith('edit_') && !workspace.editToken) {
      workspace.editToken = accessToken;
      console.log(`Stored first edit token for workspace ${workspaceId}: ${accessToken}`);
      
      if (workspace.sharingMode === 'read-write-selected') {
        hasEditAccess = true;
        currentUser.hasEditAccess = true;
        console.log(`User ${currentUser.userId} granted edit access via first token in get-sharing-info`);
      }
    }
    
    const isOwner = workspace.owner === currentUser.userId;
    currentUser.isOwner = isOwner;
    
    socket.emit('sharing-info', {
      sharingMode: workspace.sharingMode,
      allowedUsers: workspace.allowedUsers,
      isOwner: isOwner,
      currentUser: currentUser.userId,
      owner: workspace.owner,
      hasEditAccess: hasEditAccess,
      editToken: workspace.editToken // Send edit token to all users who need to know if they have edit access
    });
    
    console.log("Sent sharing info for workspace", workspaceId, {
      sharingMode: workspace.sharingMode,
      allowedUsers: workspace.allowedUsers,
      owner: workspace.owner,
      isOwner: isOwner,
      currentUser: currentUser.userId,
      hasEditAccess: hasEditAccess,
      editToken: workspace.editToken ? "set" : "not set",
      accessTokenProvided: accessToken ? "yes" : "no",
      socketId: socket.id
    });
  });
  
  socket.on('change-sharing-mode', ({ workspaceId, sharingMode }) => {
    const workspace = workspaces.get(workspaceId);
    if (!workspace) return;
    
    const isOwner = workspace.owner === currentUser.userId;
    console.log("Change sharing mode request:", {
      workspaceId,
      requestedBy: currentUser.userId,
      workspaceOwner: workspace.owner,
      isOwner,
      sharingMode,
      currentMode: workspace.sharingMode,
      currentEditToken: workspace.editToken || "none"
    });
    
    if (!isOwner) {
      console.log("Permission denied: user is not owner", {
        workspaceId,
        requestedBy: currentUser.userId,
        workspaceOwner: workspace.owner
      });
      socket.emit('error', { message: 'Only the workspace owner can change sharing settings' });
      return;
    }
    
    workspace.sharingMode = sharingMode;
    
    let hasEditAccess = isOwner;
    
    if (sharingMode === 'read-write-all') {
      hasEditAccess = true;
    }
    
    if (sharingMode === 'read-write-selected') {
      if (!workspace.editToken) {
        workspace.editToken = `edit_${Math.random().toString(36).substring(2, 10)}`;
        console.log(`Generated new edit token for workspace ${workspaceId}: ${workspace.editToken}`);
      } else {
        console.log(`Using existing edit token for workspace ${workspaceId}: ${workspace.editToken}`);
      }
    }
    
    console.log("Sharing mode changed successfully", {
      workspaceId,
      newMode: sharingMode,
      editToken: workspace.editToken || "none"
    });
    
    // Update all sockets in the room with new sharing info
    const clients = io.sockets.adapter.rooms.get(workspaceId) || new Set();
    console.log(`Updating ${clients.size} clients about new sharing mode: ${sharingMode}`);
    
    // Notify all users in the workspace about the sharing mode change
    io.to(workspaceId).emit('sharing-info', {
      sharingMode: workspace.sharingMode,
      allowedUsers: workspace.allowedUsers,
      currentUser: null,
      owner: workspace.owner,
      editToken: workspace.editToken
    });
    
    // Send a complete workspace state to ensure all clients have current whiteboard state
    const connections = activeConnections.get(workspaceId);
    const activeUsersCount = connections ? connections.size : 0;
    
    io.to(workspaceId).emit('workspace-state', {
      whiteboardElements: workspace.drawings || [],
      diagrams: Array.from(workspace.diagrams.values()) || [],
      activeUsers: activeUsersCount,
      allDrawings: workspace.allDrawings || []
    });
  });
  
  socket.on('get-active-users', ({ workspaceId }) => {
    const workspace = workspaces.get(workspaceId);
    if (!workspace) return;
    
    const connections = activeConnections.get(workspaceId) || new Set();
    const users = [];
    
    for (const socketId of connections) {
      const userInfo = userSessions.get(socketId);
      if (userInfo) {
        users.push({
          id: userInfo.userId,
          online: true,
          isOwner: workspace.owner === userInfo.userId
        });
      }
    }
    
    socket.emit('active-users-update', { activeUsers: users });
  });
  
  socket.on('invite-user', ({ workspaceId, email }, callback) => {
    const workspace = workspaces.get(workspaceId);
    if (!workspace) {
      callback({ error: 'Workspace not found' });
      return;
    }
    
    const userId = email.toLowerCase().replace(/[^a-z0-9]/g, '-');
    
    callback({ userId });
  });

  socket.on('whiteboard-update', ({ workspaceId, elements }) => {
    const workspace = workspaces.get(workspaceId);
    if (!workspace || !Array.isArray(elements)) return;
    
    const canWrite = workspace.sharingMode === 'read-write-all' || 
                   workspace.owner === currentUser.userId ||
                   (workspace.sharingMode === 'read-write-selected' && currentUser.hasEditAccess);
    
    if (!canWrite) {
      socket.emit('error', { message: 'You do not have permission to edit this workspace' });
      return;
    }

    workspace.lastActivity = Date.now();
    
    const existingDrawings = new Map(workspace.drawings.map(d => [d.id, d]));
    
    const deletedElements = new Set(
      workspace.allDrawings
        .filter(d => !workspace.drawings.some(current => current.id === d.id))
        .map(d => d.id)
    );

    // Debug info for tracking the issue
    const pathElements = elements.filter(e => e.type === 'path').length;
    const otherElements = elements.filter(e => e.type !== 'path').length;
    
    console.log(`Processing whiteboard update for workspace ${workspaceId}:`, {
      incomingElements: elements.length,
      pathElements,
      otherElements,
      currentDrawings: workspace.drawings.length,
      deletedElements: Array.from(deletedElements)
    });
    
    elements.forEach(element => {
      if (element && element.id && !deletedElements.has(element.id)) {
        const newElement = {
          ...element,
          timestamp: Date.now()
        };
        
        existingDrawings.set(element.id, newElement);
        
        if (!workspace.allDrawings.some(e => e.id === element.id)) {
          workspace.allDrawings.push(newElement);
        } else {
          const index = workspace.allDrawings.findIndex(e => e.id === element.id);
          if (index !== -1) {
            workspace.allDrawings[index] = newElement;
          }
        }
      } else if (element && element.id) {
        console.log(`Skipping deleted element ${element.id}`);
      }
    });
  
    workspace.drawings = Array.from(existingDrawings.values())
      .filter(drawing => !deletedElements.has(drawing.id));
    
    // Send update to all clients including sender to ensure synchronization
    io.to(workspaceId).emit('whiteboard-update', elements);
  });

  socket.on('whiteboard-clear', ({ workspaceId }) => {
    const workspace = workspaces.get(workspaceId);
    if (!workspace) return;
    
    const canWrite = workspace.sharingMode === 'read-write-all' || 
                   workspace.owner === currentUser.userId ||
                   (workspace.sharingMode === 'read-write-selected' && currentUser.hasEditAccess);
    
    if (!canWrite) {
      socket.emit('error', { message: 'You do not have permission to clear this workspace' });
      return;
    }

    workspace.lastActivity = Date.now();
    workspace.drawings = [];
    workspace.allDrawings = [];
    io.to(workspaceId).emit('whiteboard-clear');
  });

  socket.on('request-canvas-state', (workspaceId) => {
    const workspace = workspaces.get(workspaceId);
    if (workspace) {
      const connections = activeConnections.get(workspaceId);
      const activeUsersCount = connections ? connections.size : 0;
      
      socket.emit('workspace-state', {
        whiteboardElements: workspace.drawings || [],
        diagrams: Array.from(workspace.diagrams.values()) || [],
        activeUsers: activeUsersCount,
        allDrawings: workspace.allDrawings || []
      });
    }
  });

  socket.on('delete-diagram', ({ workspaceId, diagramId }) => {
    const workspace = workspaces.get(workspaceId);
    if (!workspace) return;

    workspace.lastActivity = Date.now();
    workspace.diagrams.delete(diagramId);
    
    workspace.drawings = workspace.drawings.filter(el => el.id !== diagramId);

    io.to(workspaceId).emit('diagram-deleted', { diagramId });
  });

  socket.on('code-update', ({ workspaceId, language, content }) => {
    const workspace = workspaces.get(workspaceId);
    if (workspace) {
      workspace.codeSnippets = { language, content };
      io.to(workspaceId).emit('code-update', { language, content });
    }
  });

  socket.on('delete-element', ({ workspaceId, elementId }) => {
    const workspace = workspaces.get(workspaceId);
    if (!workspace || !elementId) return;

    workspace.lastActivity = Date.now();
    
    workspace.drawings = workspace.drawings.filter(el => el.id !== elementId);
    workspace.drawingHistory = workspace.drawingHistory.filter(el => el.id !== elementId);
    workspace.allDrawings = workspace.allDrawings.filter(el => el.id !== elementId);
    
    io.to(workspaceId).emit('delete-element', { workspaceId, elementId });
    
    io.to(workspaceId).emit('whiteboard-update', workspace.drawings);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    if (currentWorkspace) {
      const workspaceId = Object.keys(workspaces).find(key => workspaces.get(key) === currentWorkspace);
      if (workspaceId) {
        const connections = activeConnections.get(workspaceId);
        if (connections) {
          connections.delete(socket.id);
          io.to(workspaceId).emit('user-left', {
            userId: socket.id,
            activeUsers: connections.size
          });
        }
      }
    }
  });

  socket.on('cursor-position', ({ workspaceId, position }) => {
    if (workspaces.has(workspaceId)) {
      socket.to(workspaceId).emit('cursor-update', {
        userId: socket.id,
        position
      });
    }
  });

  socket.on('diagram-update', ({ workspaceId, content }) => {
    const workspace = workspaces.get(workspaceId);
    if (workspace) {
      workspace.lastActivity = Date.now();
      workspace.diagramContent = content;
      socket.to(workspaceId).emit('diagram-update', { content });
    }
  });

  socket.on('get-edit-token', ({ workspaceId }, callback) => {
    const workspace = workspaces.get(workspaceId);
    if (!workspace) {
      if (callback) callback({ error: 'Workspace not found' });
      return;
    }
    
    if (workspace.owner !== currentUser.userId && !currentUser.isOwner) {
      if (callback) callback({ error: 'Permission denied' });
      return;
    }
    
    if (callback) {
      callback({ 
        editToken: workspace.editToken || null 
      });
      
      console.log(`Sent edit token for workspace ${workspaceId} to user ${currentUser.userId}`, 
        workspace.editToken ? `token: ${workspace.editToken}` : 'no token exists yet');
    }
  });
  
  socket.on('set-edit-token', ({ workspaceId, editToken }) => {
    const workspace = workspaces.get(workspaceId);
    if (!workspace) return;
    
    if (workspace.owner !== currentUser.userId && !currentUser.isOwner) {
      console.log(`Permission denied: User ${currentUser.userId} attempted to set edit token but is not owner`);
      return;
    }
    
    if (editToken && editToken.startsWith('edit_')) {
      workspace.editToken = editToken;
      console.log(`Set edit token for workspace ${workspaceId}: ${editToken}`);
      
      io.to(workspaceId).emit('edit-token-updated', { 
        editToken: workspace.editToken
      });
    }
  });

  socket.on('end-session', ({ workspaceId }) => {
    const workspace = workspaces.get(workspaceId);
    if (!workspace) return;
    
    // Check if the current user is the owner of the workspace
    const isUserOwner = workspace.owner === currentUser.userId;
    
    if (!isUserOwner) {
      console.log(`Permission denied: User ${currentUser.userId} attempted to end session but is not owner`);
      console.log(`Workspace owner: ${workspace.owner}, Current user: ${currentUser.userId}`);
      socket.emit('error', { message: 'Only the workspace owner can end the session' });
      return;
    }
    
    console.log(`Session ended by owner for workspace ${workspaceId}`);
    
    io.to(workspaceId).emit('session-ended', { 
      message: 'The workspace owner has ended this session'
    });
    
    const connections = activeConnections.get(workspaceId);
    if (connections) {
      for (const socketId of connections) {
        const clientSocket = io.sockets.sockets.get(socketId);
        if (clientSocket && clientSocket.id !== socket.id) {
          clientSocket.leave(workspaceId);
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
