import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { WebSocketServer } from 'ws';
import { setupWSConnection } from 'y-websocket/bin/utils.js';
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

// Input validation constants for drawing events
const DRAWING_VALIDATION = {
  MAX_DRAWING_ID_LENGTH: 64,
  MAX_SHAPE_ID_LENGTH: 64,
  MAX_SHAPE_TYPE_LENGTH: 32,
  MIN_BRUSH_WIDTH: 1,
  MAX_BRUSH_WIDTH: 100,
  MAX_POINTS_LENGTH: 10000,
  // Valid hex color regex or named colors
  COLOR_REGEX: /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$|^(rgb|rgba)\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*[\d.]+\s*)?\)$|^[a-zA-Z]+$/
};

// Input validation constants for cursor position
const CURSOR_VALIDATION = {
  MIN_POSITION: 0,
  MAX_POSITION: 10000,
  MAX_COLOR_LENGTH: 32,
  MAX_ANIMAL_KEY_LENGTH: 32
};

function isValidCursorPosition(position) {
  return typeof position === 'object' &&
         position !== null &&
         typeof position.x === 'number' &&
         typeof position.y === 'number' &&
         Number.isFinite(position.x) &&
         Number.isFinite(position.y) &&
         position.x >= CURSOR_VALIDATION.MIN_POSITION &&
         position.x <= CURSOR_VALIDATION.MAX_POSITION &&
         position.y >= CURSOR_VALIDATION.MIN_POSITION &&
         position.y <= CURSOR_VALIDATION.MAX_POSITION;
}

function isValidUserColor(color) {
  return typeof color === 'string' && color.length <= CURSOR_VALIDATION.MAX_COLOR_LENGTH;
}

function isValidAnimalKey(key) {
  return typeof key === 'string' && key.length <= CURSOR_VALIDATION.MAX_ANIMAL_KEY_LENGTH;
}

// Validation helper functions
function isValidDrawingId(id) {
  return typeof id === 'string' && id.length > 0 && id.length <= DRAWING_VALIDATION.MAX_DRAWING_ID_LENGTH;
}

function isValidShapeId(id) {
  return typeof id === 'string' && id.length > 0 && id.length <= DRAWING_VALIDATION.MAX_SHAPE_ID_LENGTH;
}

function isValidShapeType(type) {
  return typeof type === 'string' && type.length > 0 && type.length <= DRAWING_VALIDATION.MAX_SHAPE_TYPE_LENGTH;
}

function isValidColor(color) {
  return typeof color === 'string' && DRAWING_VALIDATION.COLOR_REGEX.test(color);
}

function isValidBrushWidth(width) {
  return typeof width === 'number' &&
         width >= DRAWING_VALIDATION.MIN_BRUSH_WIDTH &&
         width <= DRAWING_VALIDATION.MAX_BRUSH_WIDTH &&
         Number.isFinite(width);
}

function isValidPoints(points) {
  if (!Array.isArray(points)) return false;
  if (points.length > DRAWING_VALIDATION.MAX_POINTS_LENGTH) return false;
  // Points can be either array of numbers or array of {x, y} objects
  return points.every(p => {
    if (typeof p === 'number') return Number.isFinite(p);
    if (typeof p === 'object' && p !== null) {
      return typeof p.x === 'number' && Number.isFinite(p.x) &&
             typeof p.y === 'number' && Number.isFinite(p.y);
    }
    return false;
  });
}

function isValidShapeData(data) {
  // Shape data should be an object with numeric coordinates
  if (typeof data !== 'object' || data === null) return false;
  // Check common properties are numbers if present
  const numericProps = ['left', 'top', 'width', 'height', 'scaleX', 'scaleY', 'angle', 'x1', 'y1', 'x2', 'y2'];
  for (const prop of numericProps) {
    if (data[prop] !== undefined && (typeof data[prop] !== 'number' || !Number.isFinite(data[prop]))) {
      return false;
    }
  }
  return true;
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: config.cors,
  ...config.socketIO,
});

const yjsPort = process.env.YJS_PORT || 1234;
const yServer = createServer();
const yWebsocketServer = new WebSocketServer({ server: yServer });
yWebsocketServer.on('connection', (conn, req) => {
  setupWSConnection(conn, req, { maxPayload: 1024 * 1024 });
});
yServer.listen(yjsPort);

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
  try {
    for (const [workspaceId, queue] of updateQueues.entries()) {
      if (queue.elements.size > 0) {
        const batchedElements = Array.from(queue.elements.values());
        const senders = new Set(queue.senders);
        const roomSockets = io.sockets.adapter.rooms.get(workspaceId);

        queue.elements.clear();
        queue.senders.clear();

        if (roomSockets) {
          setImmediate(() => {
            try {
              for (const socketId of roomSockets) {
                if (!senders.has(socketId)) {
                  const socket = io.sockets.sockets.get(socketId);
                  if (socket) {
                    socket.emit(SOCKET_EVENTS.WHITEBOARD_UPDATE, batchedElements);
                  }
                }
              }
            } catch (innerError) {
              console.error('Error in batched update emission:', innerError);
            }
          });
        }
      }
    }
  } catch (error) {
    console.error('Error in batched update interval:', error);
  }
}, config.batch.interval);

setInterval(workspaceService.cleanupInactiveWorkspaces, config.cleanup.intervalMs);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      workerSrc: ["'self'", "blob:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(cors(config.cors));
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
    if (!checkRateLimit(SOCKET_EVENTS.DELETE_DIAGRAM)) {
      return;
    }
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
      // Validate cursor position data
      if (!isValidCursorPosition(position)) {
        return;
      }
      if (!isValidUserColor(userColor)) {
        return;
      }
      if (!isValidAnimalKey(animalKey)) {
        return;
      }

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

  socket.on(SOCKET_EVENTS.DRAWING_START, ({ workspaceId, drawingId, color, brushWidth }) => {
    try {
      // Validate input parameters
      if (!isValidDrawingId(drawingId)) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid drawing ID' });
        return;
      }
      if (!isValidColor(color)) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid color format' });
        return;
      }
      if (!isValidBrushWidth(brushWidth)) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid brush width' });
        return;
      }

      if (workspaceService.workspaceExists(workspaceId)) {
        socket.to(workspaceId).emit(SOCKET_EVENTS.DRAWING_START, {
          drawingId,
          userId: socket.id,
          color,
          brushWidth
        });
      }
    } catch (error) {
      console.error('DRAWING_START error:', error);
    }
  });

  socket.on(SOCKET_EVENTS.DRAWING_STREAM, ({ workspaceId, drawingId, points }) => {
    if (!checkRateLimit(SOCKET_EVENTS.DRAWING_STREAM)) {
      return;
    }
    try {
      // Validate input parameters
      if (!isValidDrawingId(drawingId)) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid drawing ID' });
        return;
      }
      if (!isValidPoints(points)) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid points data' });
        return;
      }

      if (workspaceService.workspaceExists(workspaceId)) {
        socket.to(workspaceId).emit(SOCKET_EVENTS.DRAWING_STREAM, {
          drawingId,
          points
        });
      }
    } catch (error) {
      console.error('DRAWING_STREAM error:', error);
    }
  });

  socket.on(SOCKET_EVENTS.DRAWING_END, ({ workspaceId, drawingId }) => {
    try {
      // Validate input parameter
      if (!isValidDrawingId(drawingId)) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid drawing ID' });
        return;
      }

      if (workspaceService.workspaceExists(workspaceId)) {
        socket.to(workspaceId).emit(SOCKET_EVENTS.DRAWING_END, {
          drawingId
        });
      }
    } catch (error) {
      console.error('DRAWING_END error:', error);
    }
  });

  socket.on(SOCKET_EVENTS.SHAPE_DRAWING_START, ({ workspaceId, shapeId, shapeType, data }) => {
    try {
      // Validate input parameters
      if (!isValidShapeId(shapeId)) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid shape ID' });
        return;
      }
      if (!isValidShapeType(shapeType)) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid shape type' });
        return;
      }
      if (!isValidShapeData(data)) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid shape data' });
        return;
      }

      if (workspaceService.workspaceExists(workspaceId)) {
        socket.to(workspaceId).emit(SOCKET_EVENTS.SHAPE_DRAWING_START, {
          shapeId,
          userId: socket.id,
          shapeType,
          data
        });
      }
    } catch (error) {
      console.error('SHAPE_DRAWING_START error:', error);
    }
  });

  socket.on(SOCKET_EVENTS.SHAPE_DRAWING_UPDATE, ({ workspaceId, shapeId, data }) => {
    if (!checkRateLimit(SOCKET_EVENTS.SHAPE_DRAWING_UPDATE)) {
      return;
    }
    try {
      // Validate input parameters
      if (!isValidShapeId(shapeId)) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid shape ID' });
        return;
      }
      if (!isValidShapeData(data)) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid shape data' });
        return;
      }

      if (workspaceService.workspaceExists(workspaceId)) {
        socket.to(workspaceId).emit(SOCKET_EVENTS.SHAPE_DRAWING_UPDATE, {
          shapeId,
          data
        });
      }
    } catch (error) {
      console.error('SHAPE_DRAWING_UPDATE error:', error);
    }
  });

  socket.on(SOCKET_EVENTS.SHAPE_DRAWING_END, ({ workspaceId, shapeId }) => {
    try {
      // Validate input parameter
      if (!isValidShapeId(shapeId)) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid shape ID' });
        return;
      }

      if (workspaceService.workspaceExists(workspaceId)) {
        socket.to(workspaceId).emit(SOCKET_EVENTS.SHAPE_DRAWING_END, {
          shapeId
        });
      }
    } catch (error) {
      console.error('SHAPE_DRAWING_END error:', error);
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
    // Clear rate limit entries for this socket to prevent memory leak
    for (const key of eventCounts.keys()) {
      if (key.startsWith(`${socket.id}:`)) {
        eventCounts.delete(key);
      }
    }

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
