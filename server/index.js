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
    createdAt: Date.now()
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
    const workspace = workspaces.get(workspaceId);
    if (!workspace) {
      socket.emit('error', { message: 'Workspace not found' });
      return;
    }

    // Join the workspace room
    socket.join(workspaceId);
    currentWorkspace = workspace;
    
    // Initialize diagram handler for this workspace
    diagramHandler = new DiagramHandler(workspace);
    diagramHandler.loadFromWorkspaceState(workspace);
    diagramHandler.initialize(socket, io.to(workspaceId));

    // Send initial state
    socket.emit('workspace-state', workspace);
    
    // Notify other users in the workspace
    socket.to(workspaceId).emit('user-joined', { userId: socket.id });
  });

  socket.on('whiteboard-update', ({ workspaceId, elements }) => {
    const workspace = workspaces.get(workspaceId);
    if (workspace) {
      workspace.whiteboardElements = elements;
      socket.to(workspaceId).emit('whiteboard-update', elements);
    }
  });

  socket.on('code-update', ({ workspaceId, language, content }) => {
    const workspace = workspaces.get(workspaceId);
    if (workspace) {
      workspace.codeSnippets = { language, content };
      socket.to(workspaceId).emit('code-update', { language, content });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    if (currentWorkspace) {
      socket.leave(currentWorkspace.id);
    }
  });
});

// Cleanup old workspaces periodically (every hour)
setInterval(() => {
  const now = Date.now();
  const MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

  for (const [key, workspace] of workspaces.entries()) {
    if (now - workspace.createdAt > MAX_AGE) {
      workspaces.delete(key);
    }
  }
}, 60 * 60 * 1000);

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
