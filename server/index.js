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
  workspaces.set(workspaceId, {
    id: workspaceId,
    created: Date.now(),
    lastActivity: Date.now(),
    diagrams: new Map(),
    drawings: [],
    allDrawings: [],
    drawingHistory: []
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
  let diagramHandler = null;

  socket.on('join-workspace', (workspaceId) => {
    console.log(`User ${socket.id} joining workspace ${workspaceId}`);
    let workspace = workspaces.get(workspaceId);
    
    if (!workspace) {
      workspace = {
        id: workspaceId,
        created: Date.now(),
        lastActivity: Date.now(),
        diagrams: new Map(),
        drawings: [],
        allDrawings: [],
        diagramContent: ''
      };
      workspaces.set(workspaceId, workspace);
    }

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
    
    socket.to(workspaceId).emit('user-joined', { 
      userId: socket.id,
      activeUsers: activeConnections.get(workspaceId).size
    });
  });

  socket.on('whiteboard-update', ({ workspaceId, elements }) => {
    const workspace = workspaces.get(workspaceId);
    if (!workspace || !Array.isArray(elements)) return;

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
    
    // Update only non-deleted elements
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
        }
      } else if (element && element.id) {
        console.log(`Skipping deleted element ${element.id}`);
      }
    });
    
    // Update workspace drawings
    workspace.drawings = Array.from(existingDrawings.values())
      .filter(drawing => !deletedElements.has(drawing.id));
    
    console.log(`Updated workspace ${workspaceId} state:`, {
      currentDrawingsCount: workspace.drawings.length,
      allDrawingsCount: workspace.allDrawings.length,
      skippedDeletedElements: Array.from(deletedElements)
    });

    // Broadcast the update to all other clients in the workspace
    socket.to(workspaceId).emit('whiteboard-update', workspace.drawings);
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

  socket.on('whiteboard-clear', ({ workspaceId }) => {
    const workspace = workspaces.get(workspaceId);
    if (workspace) {
      workspace.lastActivity = Date.now();
      workspace.drawings = [];
      workspace.allDrawings = [];
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
