import express, { Express, Request, Response } from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config, SOCKET_EVENTS } from './config';
import * as workspaceService from './services/workspaceService';
import * as permissionService from './services/permissionService';
import * as handlers from './handlers/socketHandlers';
import { setupWSConnection } from './yjs-utils';
import type { Server as HttpServer } from 'http';
import type {
  CurrentUser,
  CurrentWorkspaceRef,
  Position,
  UpdateQueue,
  RateLimitRecord,
  WhiteboardElement,
  User
} from './types';

// Helper to convert CurrentUser to User for permission checks
function toUser(currentUser: CurrentUser): User {
  return {
    userId: currentUser.userId || currentUser.id,
    accessToken: currentUser.accessToken,
    hasEditAccess: currentUser.hasEditAccess,
    isOwner: currentUser.isOwner,
  };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Types for validation constants
interface DrawingValidation {
  MAX_DRAWING_ID_LENGTH: number;
  MAX_SHAPE_ID_LENGTH: number;
  MAX_SHAPE_TYPE_LENGTH: number;
  MIN_BRUSH_WIDTH: number;
  MAX_BRUSH_WIDTH: number;
  MAX_POINTS_LENGTH: number;
  COLOR_REGEX: RegExp;
}

interface CursorValidation {
  MIN_POSITION: number;
  MAX_POSITION: number;
  MAX_COLOR_LENGTH: number;
  MAX_ANIMAL_KEY_LENGTH: number;
}

// Input validation constants for drawing events
const DRAWING_VALIDATION: DrawingValidation = {
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
const CURSOR_VALIDATION: CursorValidation = {
  MIN_POSITION: 0,
  MAX_POSITION: 10000,
  MAX_COLOR_LENGTH: 32,
  MAX_ANIMAL_KEY_LENGTH: 32
};

function isValidCursorPosition(position: unknown): position is Position {
  return typeof position === 'object' &&
         position !== null &&
         'x' in position &&
         'y' in position &&
         typeof (position as Position).x === 'number' &&
         typeof (position as Position).y === 'number' &&
         Number.isFinite((position as Position).x) &&
         Number.isFinite((position as Position).y) &&
         (position as Position).x >= CURSOR_VALIDATION.MIN_POSITION &&
         (position as Position).x <= CURSOR_VALIDATION.MAX_POSITION &&
         (position as Position).y >= CURSOR_VALIDATION.MIN_POSITION &&
         (position as Position).y <= CURSOR_VALIDATION.MAX_POSITION;
}

function isValidUserColor(color: unknown): color is string {
  return typeof color === 'string' && color.length <= CURSOR_VALIDATION.MAX_COLOR_LENGTH;
}

function isValidAnimalKey(key: unknown): key is string {
  return typeof key === 'string' && key.length <= CURSOR_VALIDATION.MAX_ANIMAL_KEY_LENGTH;
}

// Validation helper functions
function isValidDrawingId(id: unknown): id is string {
  return typeof id === 'string' && id.length > 0 && id.length <= DRAWING_VALIDATION.MAX_DRAWING_ID_LENGTH;
}

function isValidShapeId(id: unknown): id is string {
  return typeof id === 'string' && id.length > 0 && id.length <= DRAWING_VALIDATION.MAX_SHAPE_ID_LENGTH;
}

function isValidShapeType(type: unknown): type is string {
  return typeof type === 'string' && type.length > 0 && type.length <= DRAWING_VALIDATION.MAX_SHAPE_TYPE_LENGTH;
}

function isValidColor(color: unknown): color is string {
  return typeof color === 'string' && DRAWING_VALIDATION.COLOR_REGEX.test(color);
}

function isValidBrushWidth(width: unknown): width is number {
  return typeof width === 'number' &&
         width >= DRAWING_VALIDATION.MIN_BRUSH_WIDTH &&
         width <= DRAWING_VALIDATION.MAX_BRUSH_WIDTH &&
         Number.isFinite(width);
}

function isValidPoints(points: unknown): points is (number | Position)[] {
  if (!Array.isArray(points)) return false;
  if (points.length > DRAWING_VALIDATION.MAX_POINTS_LENGTH) return false;
  // Points can be either array of numbers or array of {x, y} objects
  return points.every(p => {
    if (typeof p === 'number') return Number.isFinite(p);
    if (typeof p === 'object' && p !== null) {
      return typeof (p as any).x === 'number' && Number.isFinite((p as any).x) &&
             typeof (p as any).y === 'number' && Number.isFinite((p as any).y);
    }
    return false;
  });
}

function isValidShapeData(data: unknown): data is Record<string, any> {
  // Shape data should be an object with numeric coordinates
  if (typeof data !== 'object' || data === null) return false;
  // Check common properties are numbers if present
  const numericProps = ['left', 'top', 'width', 'height', 'scaleX', 'scaleY', 'angle', 'x1', 'y1', 'x2', 'y2'];
  for (const prop of numericProps) {
    if ((data as any)[prop] !== undefined && (typeof (data as any)[prop] !== 'number' || !Number.isFinite((data as any)[prop]))) {
      return false;
    }
  }
  return true;
}

const app: Express = express();
const httpServer: HttpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: config.cors.origin,
    credentials: true
  },
  ...config.socketIO,
});

const yWebsocketServer = new WebSocketServer({ noServer: true });
yWebsocketServer.on('connection', (conn: WebSocket, req: import('http').IncomingMessage) => {
  setupWSConnection(conn, req);
});

httpServer.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;
  if (pathname === '/yjs' || pathname.startsWith('/yjs/')) {
    yWebsocketServer.handleUpgrade(request, socket, head, (ws) => {
      yWebsocketServer.emit('connection', ws, request);
    });
  }
});
console.log('Y-websocket server initialized');

const updateQueues = new Map<string, UpdateQueue>();

function queueUpdate(workspaceId: string, elements: WhiteboardElement[], senderSocketId: string): void {
  if (!workspaceService.workspaceExists(workspaceId)) {
    return;
  }
  if (!updateQueues.has(workspaceId)) {
    updateQueues.set(workspaceId, { elements: new Map(), senders: new Set() });
  }
  const queue = updateQueues.get(workspaceId)!;
  queue.senders.add(senderSocketId);
  elements.forEach(el => {
    if (el?.id) queue.elements.set(el.id, el);
  });
}

setInterval(() => {
  try {
    for (const [workspaceId, queue] of updateQueues.entries()) {
      if (!workspaceService.workspaceExists(workspaceId)) {
        updateQueues.delete(workspaceId);
        continue;
      }
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

setInterval(() => {
  const removed = workspaceService.cleanupInactiveWorkspaces();
  removed.forEach(id => updateQueues.delete(id));
}, config.cleanup.intervalMs);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      workerSrc: ["'self'", "blob:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: config.cors.origin,
  credentials: true
}));
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

app.get('/', (_req: Request, res: Response) => {
  const indexPath = config.isProduction
    ? join(__dirname, '../dist/index.html')
    : join(__dirname, '../client/index.html');
  res.sendFile(indexPath);
});

app.post('/api/workspaces', createWorkspaceLimiter, (req: Request, res: Response) => {
  const workspaceId = workspaceService.generateKey();
  const userId = req.body.userId || workspaceService.generateKey(config.workspace.userIdLength);
  workspaceService.createWorkspace(workspaceId, userId);
  res.json({ workspaceId });
});

app.get('/w/:workspaceId', (_req: Request, res: Response) => {
  const indexPath = config.isProduction
    ? join(__dirname, '../dist/index.html')
    : join(__dirname, '../client/index.html');
  res.sendFile(indexPath);
});

app.get('/api/workspace/:workspaceId', apiLimiter, (req: Request, res: Response) => {
  const workspaceId = req.params.workspaceId;
  if (!workspaceId || !workspaceService.workspaceExists(workspaceId)) {
    return res.status(404).json({ error: 'Workspace not found' });
  }
  res.json({ exists: true });
});

io.on(SOCKET_EVENTS.CONNECTION, (socket: Socket) => {
  const currentWorkspaceRef: CurrentWorkspaceRef = { current: null };
  const currentUser: CurrentUser = { id: socket.id, joinedAt: Date.now() };
  workspaceService.setUserSession(socket.id, currentUser);

  socket.on('error', (error: Error) => {
    console.error(`Socket error for ${socket.id}:`, error);
  });

  const eventCounts = new Map<string, RateLimitRecord>();
  const RATE_LIMIT_WINDOW = 1000;
  const MAX_EVENTS_PER_WINDOW = 50;

  const checkRateLimit = (eventName: string): boolean => {
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

  socket.on(SOCKET_EVENTS.CHECK_WORKSPACE_EXISTS, ({ workspaceId }: { workspaceId: string }) => {
    try {
      const exists = workspaceService.workspaceExists(workspaceId);
      socket.emit(SOCKET_EVENTS.WORKSPACE_EXISTS_RESULT, { workspaceId, exists });
    } catch (error) {
      console.error('CHECK_WORKSPACE_EXISTS error:', error);
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to check workspace' });
    }
  });

  socket.on(SOCKET_EVENTS.JOIN_WORKSPACE, async (data: any) => {
    const result = await handlers.handleJoinWorkspace(data, {
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

  socket.on(SOCKET_EVENTS.GET_SHARING_INFO, ({ workspaceId, userId, accessToken }: { workspaceId: string; userId?: string; accessToken?: string }) => {
    try {
      const workspace = workspaceService.getWorkspace(workspaceId);
      if (!workspace) return;

      currentUser.accessToken = accessToken || currentUser.accessToken || null;
      if (userId) currentUser.userId = userId;

      const { hasEditAccess, isOwner } = permissionService.calculateEditAccess(workspace, toUser(currentUser), accessToken);
      currentUser.isOwner = isOwner;
      currentUser.hasEditAccess = hasEditAccess;

      permissionService.validateAndSetToken(workspace, accessToken, toUser(currentUser));
      socket.emit(SOCKET_EVENTS.SHARING_INFO, permissionService.getSharingInfo(workspace, toUser(currentUser)));
    } catch (error) {
      console.error('GET_SHARING_INFO error:', error);
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to get sharing info' });
    }
  });

  socket.on(SOCKET_EVENTS.GET_ACTIVE_USERS, ({ workspaceId }: { workspaceId: string }) => {
    try {
      const users = workspaceService.getWorkspaceUsers(workspaceId);
      socket.emit(SOCKET_EVENTS.ACTIVE_USERS_UPDATE, { activeUsers: users });
    } catch (error) {
      console.error('GET_ACTIVE_USERS error:', error);
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to get active users' });
    }
  });

  socket.on(SOCKET_EVENTS.WHITEBOARD_UPDATE, (data: any) => {
    if (!checkRateLimit(SOCKET_EVENTS.WHITEBOARD_UPDATE)) {
      return;
    }
    handlers.handleWhiteboardUpdate(data, {
      socket,
      currentUser,
      queueUpdate
    });
  });

  socket.on(SOCKET_EVENTS.WHITEBOARD_CLEAR, (data: any) => {
    if (!checkRateLimit(SOCKET_EVENTS.WHITEBOARD_CLEAR)) {
      return;
    }
    handlers.handleWhiteboardClear(data, {
      socket,
      currentUser
    });
  });

  socket.on(SOCKET_EVENTS.REQUEST_CANVAS_STATE, (workspaceId: string) => {
    try {
      const state = workspaceService.getWorkspaceState(workspaceId);
      if (state) socket.emit(SOCKET_EVENTS.WORKSPACE_STATE, state);
    } catch (error) {
      console.error('REQUEST_CANVAS_STATE error:', error);
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to get canvas state' });
    }
  });

  socket.on(SOCKET_EVENTS.DELETE_ELEMENT, (data: any) => {
    if (!checkRateLimit(SOCKET_EVENTS.DELETE_ELEMENT)) {
      return;
    }
    handlers.handleDeleteElement(data, {
      socket,
      currentUser
    });
  });

  socket.on(SOCKET_EVENTS.DELETE_DIAGRAM, (data: any) => {
    if (!checkRateLimit(SOCKET_EVENTS.DELETE_DIAGRAM)) {
      return;
    }
    handlers.handleDeleteDiagram(data, {
      socket,
      currentUser
    });
  });

  socket.on(SOCKET_EVENTS.CODE_UPDATE, (data: any) => {
    if (!checkRateLimit(SOCKET_EVENTS.CODE_UPDATE)) {
      return;
    }
    handlers.handleCodeUpdate(data, {
      socket,
      currentUser
    });
  });

  socket.on(SOCKET_EVENTS.DIAGRAM_UPDATE, (data: any) => {
    if (!checkRateLimit(SOCKET_EVENTS.DIAGRAM_UPDATE)) {
      return;
    }
    handlers.handleDiagramUpdate(data, {
      socket,
      currentUser
    });
  });

  socket.on(SOCKET_EVENTS.CURSOR_POSITION, ({ workspaceId, position, userColor, animalKey }: { workspaceId: string; position: unknown; userColor: unknown; animalKey: unknown }) => {
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

  socket.on(SOCKET_EVENTS.DRAWING_START, ({ workspaceId, drawingId, color, brushWidth }: { workspaceId: string; drawingId: unknown; color: unknown; brushWidth: unknown }) => {
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

  socket.on(SOCKET_EVENTS.DRAWING_STREAM, ({ workspaceId, drawingId, points }: { workspaceId: string; drawingId: unknown; points: unknown }) => {
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

  socket.on(SOCKET_EVENTS.DRAWING_END, ({ workspaceId, drawingId }: { workspaceId: string; drawingId: unknown }) => {
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

  socket.on(SOCKET_EVENTS.SHAPE_DRAWING_START, ({ workspaceId, shapeId, shapeType, data }: { workspaceId: string; shapeId: unknown; shapeType: unknown; data: unknown }) => {
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

  socket.on(SOCKET_EVENTS.SHAPE_DRAWING_UPDATE, ({ workspaceId, shapeId, data }: { workspaceId: string; shapeId: unknown; data: unknown }) => {
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

  socket.on(SOCKET_EVENTS.SHAPE_DRAWING_END, ({ workspaceId, shapeId }: { workspaceId: string; shapeId: unknown }) => {
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

  socket.on(SOCKET_EVENTS.GET_EDIT_TOKEN, (data: any, callback: (result: any) => void) => {
    handlers.handleGetEditToken(data, callback, { socket, currentUser });
  });

  socket.on(SOCKET_EVENTS.SET_EDIT_TOKEN, (data: any) => {
    handlers.handleSetEditToken(data, {
      socket,
      io,
      currentUser
    });
  });

  socket.on(SOCKET_EVENTS.INVITE_USER, (data: any, callback: (result: any) => void) => {
    handlers.handleInviteUser(data, callback, { socket, io, currentUser });
  });

  socket.on(SOCKET_EVENTS.CHANGE_SHARING_MODE, (data: any) => {
    handlers.handleChangeSharingMode(data, {
      socket,
      io,
      currentUser
    });
  });

  socket.on(SOCKET_EVENTS.END_SESSION, (data: any) => {
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
      currentUser,
      currentWorkspaceRef
    });
  });
});

process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

io.on('error', (error: Error) => {
  console.error('Socket.io error:', error);
});

httpServer.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});
