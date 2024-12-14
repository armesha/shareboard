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

// In-memory storage for workspaces
const workspaces = new Map();
const activeConnections = new Map(); // Track active connections per workspace

// Utility function to generate a random workspace key
function generateWorkspaceKey(length = 6) {
  // Generate random bytes and convert to base64
  const bytes = crypto.randomBytes(Math.ceil(length * 3 / 4));
  const base64 = bytes.toString('base64');
  
  // Make the string URL-safe and trim to desired length
  return base64
    .replace(/[+/]/g, '') // Remove + and / characters
    .replace(/=+$/, '')   // Remove trailing =
    .slice(0, length);    // Trim to desired length
}

// Utility function to clean up inactive workspaces
const cleanupInactiveWorkspaces = () => {
  for (const [workspaceId, workspace] of workspaces.entries()) {
    const connections = activeConnections.get(workspaceId) || new Set();
    if (connections.size === 0 && Date.now() - workspace.lastActivity > 24 * 60 * 60 * 1000) {
      workspaces.delete(workspaceId);
      activeConnections.delete(workspaceId);
    }
  }
};

// Run cleanup every hour
setInterval(cleanupInactiveWorkspaces, 60 * 60 * 1000);

app.use(cors());
app.use(express.json());

// Serve static files from the client directory during development
app.use(express.static(join(__dirname, '../client')));

// In production, serve from dist directory
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '../dist')));
}

// Root route - serve index.html
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, '../client/index.html'));
});

// Create new workspace
app.get('/api/workspace/new', (req, res) => {
  let key;
  do {
    key = generateWorkspaceKey();
  } while (workspaces.has(key));

  // Initialize workspace with default state
  workspaces.set(key, {
    whiteboardElements: [],
    codeSnippets: { language: 'javascript', content: '' },
    diagramDefinitions: [],
    permissions: { default: 'read-write' },
    createdAt: Date.now(),
    lastActivity: Date.now()
  });

  res.json({ key });
});

// Serve the main app for workspace routes
app.get('/w/:workspaceId', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    res.sendFile(join(__dirname, '../dist/index.html'));
  } else {
    res.sendFile(join(__dirname, '../client/index.html'));
  }
});

// API endpoint to check if workspace exists
app.get('/api/workspace/:workspaceId', (req, res) => {
  const { workspaceId } = req.params;
  const workspace = workspaces.get(workspaceId);
  
  if (!workspace) {
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }
  
  res.json({ exists: true });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  let currentWorkspace = null;
  let diagramHandler = null;

  socket.on('join-workspace', (workspaceId) => {
    console.log(`User ${socket.id} joining workspace ${workspaceId}`);
    const workspace = workspaces.get(workspaceId);
    if (!workspace) {
      socket.emit('error', { message: 'Workspace not found' });
      return;
    }

    // Leave previous workspace if any
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

    // Track active connections
    if (!activeConnections.has(workspaceId)) {
      activeConnections.set(workspaceId, new Set());
    }
    activeConnections.get(workspaceId).add(socket.id);
    
    // Join the workspace room
    socket.join(workspaceId);
    currentWorkspace = workspace;
    workspace.lastActivity = Date.now();
    
    // Initialize diagram handler for this workspace
    diagramHandler = new DiagramHandler(workspace);
    diagramHandler.loadFromWorkspaceState(workspace);
    diagramHandler.initialize(socket, io.to(workspaceId));

    console.log(`Workspace ${workspaceId} state:`, {
      elements: workspace.whiteboardElements?.length || 0,
      activeUsers: activeConnections.get(workspaceId).size
    });

    // Send initial state to the joining user
    socket.emit('workspace-state', {
      whiteboardElements: workspace.whiteboardElements || [],
      codeSnippets: workspace.codeSnippets || { language: 'javascript', content: '' },
      activeUsers: activeConnections.get(workspaceId).size
    });
    
    // Notify other users in the workspace
    socket.to(workspaceId).emit('user-joined', { 
      userId: socket.id,
      activeUsers: activeConnections.get(workspaceId).size
    });
  });

  // Handle whiteboard updates
  socket.on('whiteboard-update', ({ workspaceId, elements }) => {
    console.log(`Received whiteboard update for workspace ${workspaceId} from ${socket.id}`);
    const workspace = workspaces.get(workspaceId);
    if (workspace) {
      workspace.lastActivity = Date.now();
      
      // Update the workspace state with new elements
      if (Array.isArray(elements)) {
        // If receiving an array of elements, merge them with existing elements
        const currentElements = workspace.whiteboardElements || [];
        const elementsMap = new Map(currentElements.map(el => [el.id, el]));
        
        elements.forEach(element => {
          if (element.id) {
            elementsMap.set(element.id, element);
          }
        });
        
        workspace.whiteboardElements = Array.from(elementsMap.values());
      }

      // Broadcast the update to all clients in the workspace, including sender
      io.to(workspaceId).emit('whiteboard-update', workspace.whiteboardElements);
      
      console.log(`Broadcasted whiteboard update to workspace ${workspaceId}, elements:`, 
        workspace.whiteboardElements.length);
    }
  });

  socket.on('whiteboard-clear', ({ workspaceId }) => {
    const workspace = workspaces.get(workspaceId);
    if (workspace) {
      workspace.lastActivity = Date.now();
      workspace.whiteboardElements = [];
      io.to(workspaceId).emit('whiteboard-clear');
    }
  });

  socket.on('code-update', ({ workspaceId, language, content }) => {
    const workspace = workspaces.get(workspaceId);
    if (workspace) {
      workspace.codeSnippets = { language, content };
      io.to(workspaceId).emit('code-update', { language, content });
    }
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

  // Handle cursor position updates
  socket.on('cursor-position', ({ workspaceId, position }) => {
    if (workspaces.has(workspaceId)) {
      socket.to(workspaceId).emit('cursor-update', {
        userId: socket.id,
        position
      });
    }
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
