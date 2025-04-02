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
    // Add sharing configuration
    owner: userId,
    sharingMode: 'read-write-all', // Default sharing mode
    allowedUsers: [] // Users with edit permission when in selective mode
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

  socket.on('join-workspace', ({ workspaceId, userId }) => {
    console.log(`User ${socket.id} joining workspace ${workspaceId} with userId ${userId}`);
    let workspace = workspaces.get(workspaceId);
    let isNewWorkspace = false;
    
    if (!workspace) {
      // Create new workspace if it doesn't exist
      // First user to join becomes the owner
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
        allowedUsers: []
      };
      workspaces.set(workspaceId, workspace);
      
      console.log(`Created new workspace ${workspaceId} with owner ${userId || socket.id}`);
    }

    // Update user information
    currentUser.userId = userId || socket.id;
    currentUser.workspaceId = workspaceId;
    
    // Check if this user is the owner
    const isOwner = workspace.owner === currentUser.userId;
    currentUser.isOwner = isOwner;
    
    // If this is a new workspace, the first joiner is automatically the owner
    if (isNewWorkspace) {
      currentUser.isOwner = true;
      workspace.owner = currentUser.userId;
    }
    
    console.log(`User ${socket.id} joining workspace ${workspaceId}:`, { 
      userId: currentUser.userId,
      owner: workspace.owner,
      isOwner: currentUser.isOwner,
      isNewWorkspace
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
    
    // Send sharing info immediately after joining
    socket.emit('sharing-info', {
      sharingMode: workspace.sharingMode,
      allowedUsers: workspace.allowedUsers,
      isOwner: currentUser.isOwner,
      currentUser: currentUser.userId,
      owner: workspace.owner
    });
    
    socket.to(workspaceId).emit('user-joined', { 
      userId: socket.id,
      activeUsers: activeConnections.get(workspaceId).size
    });
  });

  // Handle sharing info requests
  socket.on('get-sharing-info', ({ workspaceId, userId }) => {
    const workspace = workspaces.get(workspaceId);
    if (!workspace) return;
    
    // Update the userId if it's provided in the request
    if (userId) {
      currentUser.userId = userId;
      // Check if this is the owner
      if (workspace.owner === userId) {
        currentUser.isOwner = true;
        // Ensure owner ID is consistent
        workspace.owner = userId;
      }
    }
    
    const isOwner = workspace.owner === currentUser.userId;
    
    socket.emit('sharing-info', {
      sharingMode: workspace.sharingMode,
      allowedUsers: workspace.allowedUsers,
      isOwner: isOwner,
      currentUser: currentUser.userId,
      owner: workspace.owner
    });
    
    console.log("Sent sharing info for workspace", workspaceId, {
      sharingMode: workspace.sharingMode,
      allowedUsers: workspace.allowedUsers,
      owner: workspace.owner,
      isOwner: isOwner,
      currentUser: currentUser.userId,
      socketId: socket.id
    });
  });
  
  // Handle changes to sharing mode
  socket.on('change-sharing-mode', ({ workspaceId, sharingMode, allowedUsers }) => {
    const workspace = workspaces.get(workspaceId);
    if (!workspace) return;
    
    // Check if this user is the owner based on userId
    const isOwner = workspace.owner === currentUser.userId;
    console.log("Change sharing mode request:", {
      workspaceId,
      requestedBy: currentUser.userId,
      workspaceOwner: workspace.owner,
      isOwner,
      sharingMode,
      allowedUsersCount: allowedUsers?.length || 0
    });
    
    // Only the owner can change sharing mode
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
    
    if (sharingMode === 'read-write-selected') {
      workspace.allowedUsers = allowedUsers || [];
    }
    
    // Log the change
    console.log("Sharing mode changed successfully", {
      workspaceId,
      newMode: sharingMode,
      allowedUsers: workspace.allowedUsers
    });
    
    // Notify all users in the workspace about the change but ensure the owner status is preserved
    io.to(workspaceId).emit('sharing-info', {
      sharingMode: workspace.sharingMode,
      allowedUsers: workspace.allowedUsers,
      currentUser: null, // Each client will fill in their own user ID
      // Important: all users need to know who the owner is to show proper UI
      owner: workspace.owner
    });
  });
  
  // Get list of active users
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
  
  // Invite a user to the workspace
  socket.on('invite-user', ({ workspaceId, email }, callback) => {
    const workspace = workspaces.get(workspaceId);
    if (!workspace) {
      callback({ error: 'Workspace not found' });
      return;
    }
    
    // In a real app, you would send an invitation email
    // For this demo, we'll simulate creating a user from the email
    const userId = email.toLowerCase().replace(/[^a-z0-9]/g, '-');
    
    callback({ userId });
  });

  // When modifying whiteboard, check if the user has permission
  socket.on('whiteboard-update', ({ workspaceId, elements }) => {
    const workspace = workspaces.get(workspaceId);
    if (!workspace || !Array.isArray(elements)) return;
    
    // Check if user has write permission
    const canWrite = workspace.sharingMode === 'read-write-all' || 
                   workspace.owner === currentUser.userId ||
                   (workspace.sharingMode === 'read-write-selected' && 
                    workspace.allowedUsers.includes(currentUser.userId));
    
    if (!canWrite) {
      socket.emit('error', { message: 'You do not have permission to edit this workspace' });
      return;
    }

    workspace.lastActivity = Date.now();
    
    // Create a map of current drawings for efficient lookup
    const existingDrawings = new Map(workspace.drawings.map(d => [d.id, d]));
    
    // Keep track of deleted elements to prevent them from reappearing
    const deletedElements = new Set(
      workspace.allDrawings
        .filter(d => !workspace.drawings.some(current => current.id === d.id))
        .map(d => d.id)
    );

    console.log(`Processing whiteboard update for workspace ${workspaceId}:`, {
      incomingElements: elements.length,
      currentDrawings: workspace.drawings.length,
      deletedElements: Array.from(deletedElements)
    });
    
    // Process each incoming element
    elements.forEach(element => {
      if (element && element.id && !deletedElements.has(element.id)) {
        const newElement = {
          ...element,
          timestamp: Date.now()
        };
        
        existingDrawings.set(element.id, newElement);
        
        // Update allDrawings if it's a new element
        if (!workspace.allDrawings.some(e => e.id === element.id)) {
          workspace.allDrawings.push(newElement);
        } else {
          // Update existing element in allDrawings
          const index = workspace.allDrawings.findIndex(e => e.id === element.id);
          if (index !== -1) {
            workspace.allDrawings[index] = newElement;
          }
        }
      } else if (element && element.id) {
        console.log(`Skipping deleted element ${element.id}`);
      }
    });
    
    // Update workspace drawings
    workspace.drawings = Array.from(existingDrawings.values())
      .filter(drawing => !deletedElements.has(drawing.id));
    
    // Broadcast to all clients in the room EXCEPT the sender
    socket.to(workspaceId).emit('whiteboard-update', elements);
  });

  // For other methods like whiteboard-clear, delete-element, etc., add similar permission checks
  socket.on('whiteboard-clear', ({ workspaceId }) => {
    const workspace = workspaces.get(workspaceId);
    if (!workspace) return;
    
    // Check if user has write permission
    const canWrite = workspace.sharingMode === 'read-write-all' || 
                   workspace.owner === currentUser.userId ||
                   (workspace.sharingMode === 'read-write-selected' && 
                    workspace.allowedUsers.includes(currentUser.userId));
    
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
      socket.emit('workspace-state', {
        whiteboardElements: workspace.drawings || [],
        diagrams: Array.from(workspace.diagrams.values()) || [],
        activeUsers: activeConnections.get(workspaceId).size,
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
    
    // Remove from all arrays
    workspace.drawings = workspace.drawings.filter(el => el.id !== elementId);
    workspace.drawingHistory = workspace.drawingHistory.filter(el => el.id !== elementId);
    workspace.allDrawings = workspace.allDrawings.filter(el => el.id !== elementId);
    
    // Use io.to instead of socket.to to ensure ALL clients receive the event
    io.to(workspaceId).emit('delete-element', { workspaceId, elementId });
    
    // After deletion, broadcast the current state to ensure everyone is in sync
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
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
