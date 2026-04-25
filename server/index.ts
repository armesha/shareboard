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
import * as rateLimitService from './services/rateLimitService';
import * as batchService from './services/batchService';
import * as handlers from './handlers/socketHandlers';
import { setupWSConnection } from './yjs-utils';
import { toUser } from './utils/userUtils';
import { logger, logThrottled, logSampled, clearLogKeysForSocket } from './utils/logger';
import {
  isValidCursorPosition,
  isValidUserColor,
  isValidAnimalKey,
  isValidDrawingId,
  isValidShapeId,
  isValidShapeType,
  isValidColor,
  isValidBrushWidth,
  isValidPoints,
  isValidShapeData
} from './validation/validators';
import type { Server as HttpServer } from 'http';
import type { CurrentUser, CurrentWorkspaceRef } from './types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
logger.info('y-websocket server initialized');

batchService.startBatchInterval(io);

setInterval(() => {
  const removed = workspaceService.cleanupInactiveWorkspaces();
  batchService.cleanupWorkspaceQueues(removed);
}, config.cleanup.intervalMs);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:", "https://cdn.jsdelivr.net"],
      workerSrc: ["'self'", "blob:"],
    },
  },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: 'strict-origin' },
}));

app.use(cors({
  origin: config.cors.origin,
  credentials: true
}));
app.use(express.json());

const createWorkspaceLimiter = rateLimit({
  windowMs: config.validation.rateLimit.apiWindowMs,
  max: config.validation.rateLimit.apiMaxRequests,
  message: { error: 'Too many workspaces created, please try again later' }
});

const apiLimiter = rateLimit({
  windowMs: config.validation.rateLimit.wsWindowMs,
  max: config.validation.rateLimit.wsMaxRequests,
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
  logger.info({ workspaceId, userId }, 'workspace created');
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

app.get('/api/health', (_req: Request, res: Response) => {
  const mem = process.memoryUsage();
  res.json({
    heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
    rss: Math.round(mem.rss / 1024 / 1024),
    uptime: Math.round(process.uptime()),
  });
});

const rateLimitCleanupInterval = rateLimitService.startCleanupInterval();

io.on(SOCKET_EVENTS.CONNECTION, (socket: Socket) => {
  const currentWorkspaceRef: CurrentWorkspaceRef = { current: null };
  const currentUser: CurrentUser = { id: socket.id, joinedAt: Date.now() };
  workspaceService.setUserSession(socket.id, currentUser);

  socket.on('error', (error: Error) => {
    logger.error({ err: error, socketId: socket.id }, 'socket error');
  });

  const checkRateLimit = (eventName: string): boolean => {
    const allowed = rateLimitService.checkRateLimit(socket.id, eventName);
    if (!allowed) {
      logThrottled(`${socket.id}:rl:${eventName}`, 10000, () => {
        logger.warn({ socketId: socket.id, event: eventName }, 'rate limit exceeded');
      });
    }
    return allowed;
  };

  socket.on(SOCKET_EVENTS.CHECK_WORKSPACE_EXISTS, ({ workspaceId }: { workspaceId: string }) => {
    try {
      const exists = workspaceService.workspaceExists(workspaceId);
      socket.emit(SOCKET_EVENTS.WORKSPACE_EXISTS_RESULT, { workspaceId, exists });
    } catch (error) {
      logger.warn({ err: error, socketId: socket.id, event: 'CHECK_WORKSPACE_EXISTS' }, 'handler failed');
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to check workspace' });
    }
  });

  socket.on(SOCKET_EVENTS.JOIN_WORKSPACE, async (data: handlers.JoinWorkspaceData) => {
    const result = await handlers.handleJoinWorkspace(data, {
      socket,
      io,
      currentUser,
      currentWorkspaceRef,
      queueUpdate: batchService.queueUpdate
    });

    if (result.success) {
      logger.info({ socketId: socket.id, workspaceId: data.workspaceId, isNewWorkspace: result.isNewWorkspace }, 'user joined workspace');
    } else {
      logger.error({ err: result.error, socketId: socket.id, workspaceId: data.workspaceId, reason: result.reason }, 'join workspace failed');
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

      const tokenValid = permissionService.validateAndSetToken(workspace, accessToken, toUser(currentUser));
      if (accessToken && !tokenValid && !isOwner) {
        logger.warn({ socketId: socket.id, workspaceId }, 'invalid edit token');
      }

      socket.emit(SOCKET_EVENTS.SHARING_INFO, permissionService.getSharingInfo(workspace, toUser(currentUser)));
    } catch (error) {
      logger.warn({ err: error, socketId: socket.id, event: 'GET_SHARING_INFO' }, 'handler failed');
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to get sharing info' });
    }
  });

  socket.on(SOCKET_EVENTS.WHITEBOARD_UPDATE, (data: handlers.WhiteboardUpdateData) => {
    if (!checkRateLimit(SOCKET_EVENTS.WHITEBOARD_UPDATE)) return;
    handlers.handleWhiteboardUpdate(data, { socket, currentUser, queueUpdate: batchService.queueUpdate });
  });

  socket.on(SOCKET_EVENTS.WHITEBOARD_CLEAR, (data: { workspaceId: string }) => {
    if (!checkRateLimit(SOCKET_EVENTS.WHITEBOARD_CLEAR)) return;
    handlers.handleWhiteboardClear(data, { socket, currentUser });
  });

  socket.on(SOCKET_EVENTS.DELETE_ELEMENT, (data: handlers.DeleteElementData) => {
    if (!checkRateLimit(SOCKET_EVENTS.DELETE_ELEMENT)) return;
    handlers.handleDeleteElement(data, { socket, currentUser });
  });

  socket.on(SOCKET_EVENTS.TEXT_EDIT_START, (data: handlers.TextEditStartData) => {
    if (!checkRateLimit(SOCKET_EVENTS.TEXT_EDIT_START)) return;
    handlers.handleTextEditStart(data, { socket, currentUser });
  });

  socket.on(SOCKET_EVENTS.TEXT_EDIT_END, (data: handlers.TextEditEndData) => {
    if (!checkRateLimit(SOCKET_EVENTS.TEXT_EDIT_END)) return;
    handlers.handleTextEditEnd(data, { socket, currentUser });
  });

  socket.on(SOCKET_EVENTS.CODE_UPDATE, (data: handlers.CodeUpdateData) => {
    if (!checkRateLimit(SOCKET_EVENTS.CODE_UPDATE)) return;
    handlers.handleCodeUpdate(data, { socket, currentUser });
  });

  socket.on(SOCKET_EVENTS.CURSOR_POSITION, ({ workspaceId, position, userColor, animalKey }: { workspaceId: string; position: unknown; userColor: unknown; animalKey: unknown }) => {
    if (!checkRateLimit(SOCKET_EVENTS.CURSOR_POSITION)) return;
    try {
      const validPos = isValidCursorPosition(position);
      const validColor = isValidUserColor(userColor);
      const validAnimal = isValidAnimalKey(animalKey);
      if (!validPos || !validColor || !validAnimal) return;
      if (workspaceService.workspaceExists(workspaceId)) {
        socket.to(workspaceId).emit(SOCKET_EVENTS.CURSOR_UPDATE, { userId: socket.id, position, userColor, animalKey });
      }
    } catch (error) {
      logSampled(`${socket.id}:cursor-err`, 100, (count) => {
        logger.warn({ err: error, socketId: socket.id, event: 'CURSOR_POSITION', sampledCount: count }, 'cursor handler failed');
      });
    }
  });

  socket.on(SOCKET_EVENTS.DRAWING_START, ({ workspaceId, drawingId, color, brushWidth }: { workspaceId: string; drawingId: unknown; color: unknown; brushWidth: unknown }) => {
    if (!checkRateLimit(SOCKET_EVENTS.DRAWING_START)) return;
    try {
      if (!isValidDrawingId(drawingId) || !isValidColor(color) || !isValidBrushWidth(brushWidth)) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid drawing data' });
        return;
      }
      const workspace = workspaceService.getWorkspace(workspaceId);
      if (!permissionService.checkWritePermission(workspace, toUser(currentUser))) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'No write permission' });
        return;
      }
      if (workspaceService.workspaceExists(workspaceId)) {
        socket.to(workspaceId).emit(SOCKET_EVENTS.DRAWING_START, { drawingId, userId: socket.id, color, brushWidth });
      }
    } catch (error) {
      logger.error({ err: error, socketId: socket.id, workspaceId }, 'drawing handler failed');
    }
  });

  socket.on(SOCKET_EVENTS.DRAWING_STREAM, ({ workspaceId, drawingId, points }: { workspaceId: string; drawingId: unknown; points: unknown }) => {
    if (!checkRateLimit(SOCKET_EVENTS.DRAWING_STREAM)) return;
    try {
      if (!isValidDrawingId(drawingId) || !isValidPoints(points)) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid drawing stream data' });
        return;
      }
      const workspace = workspaceService.getWorkspace(workspaceId);
      if (!permissionService.checkWritePermission(workspace, toUser(currentUser))) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'No write permission' });
        return;
      }
      if (workspaceService.workspaceExists(workspaceId)) {
        socket.to(workspaceId).emit(SOCKET_EVENTS.DRAWING_STREAM, { drawingId, points });
      }
    } catch (error) {
      logger.error({ err: error, socketId: socket.id, workspaceId }, 'drawing handler failed');
    }
  });

  socket.on(SOCKET_EVENTS.DRAWING_END, ({ workspaceId, drawingId }: { workspaceId: string; drawingId: unknown }) => {
    if (!checkRateLimit(SOCKET_EVENTS.DRAWING_END)) return;
    try {
      if (!isValidDrawingId(drawingId)) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid drawing ID' });
        return;
      }
      const workspace = workspaceService.getWorkspace(workspaceId);
      if (!permissionService.checkWritePermission(workspace, toUser(currentUser))) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'No write permission' });
        return;
      }
      if (workspaceService.workspaceExists(workspaceId)) {
        socket.to(workspaceId).emit(SOCKET_EVENTS.DRAWING_END, { drawingId });
      }
    } catch (error) {
      logger.error({ err: error, socketId: socket.id, workspaceId }, 'drawing handler failed');
    }
  });

  socket.on(SOCKET_EVENTS.SHAPE_DRAWING_START, ({ workspaceId, shapeId, shapeType, data }: { workspaceId: string; shapeId: unknown; shapeType: unknown; data: unknown }) => {
    if (!checkRateLimit(SOCKET_EVENTS.SHAPE_DRAWING_START)) return;
    try {
      if (!isValidShapeId(shapeId) || !isValidShapeType(shapeType) || !isValidShapeData(data)) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid shape data' });
        return;
      }
      const workspace = workspaceService.getWorkspace(workspaceId);
      if (!permissionService.checkWritePermission(workspace, toUser(currentUser))) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'No write permission' });
        return;
      }
      if (workspaceService.workspaceExists(workspaceId)) {
        socket.to(workspaceId).emit(SOCKET_EVENTS.SHAPE_DRAWING_START, { shapeId, userId: socket.id, shapeType, data });
      }
    } catch (error) {
      logger.error({ err: error, socketId: socket.id, workspaceId }, 'drawing handler failed');
    }
  });

  socket.on(SOCKET_EVENTS.SHAPE_DRAWING_UPDATE, ({ workspaceId, shapeId, data }: { workspaceId: string; shapeId: unknown; data: unknown }) => {
    if (!checkRateLimit(SOCKET_EVENTS.SHAPE_DRAWING_UPDATE)) return;
    try {
      if (!isValidShapeId(shapeId) || !isValidShapeData(data)) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid shape update data' });
        return;
      }
      const workspace = workspaceService.getWorkspace(workspaceId);
      if (!permissionService.checkWritePermission(workspace, toUser(currentUser))) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'No write permission' });
        return;
      }
      if (workspaceService.workspaceExists(workspaceId)) {
        socket.to(workspaceId).emit(SOCKET_EVENTS.SHAPE_DRAWING_UPDATE, { shapeId, data });
      }
    } catch (error) {
      logger.error({ err: error, socketId: socket.id, workspaceId }, 'drawing handler failed');
    }
  });

  socket.on(SOCKET_EVENTS.SHAPE_DRAWING_END, ({ workspaceId, shapeId }: { workspaceId: string; shapeId: unknown }) => {
    if (!checkRateLimit(SOCKET_EVENTS.SHAPE_DRAWING_END)) return;
    try {
      if (!isValidShapeId(shapeId)) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid shape ID' });
        return;
      }
      const workspace = workspaceService.getWorkspace(workspaceId);
      if (!permissionService.checkWritePermission(workspace, toUser(currentUser))) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'No write permission' });
        return;
      }
      if (workspaceService.workspaceExists(workspaceId)) {
        socket.to(workspaceId).emit(SOCKET_EVENTS.SHAPE_DRAWING_END, { shapeId });
      }
    } catch (error) {
      logger.error({ err: error, socketId: socket.id, workspaceId }, 'drawing handler failed');
    }
  });

  socket.on(SOCKET_EVENTS.GET_EDIT_TOKEN, (data: handlers.GetEditTokenData, callback: (result: unknown) => void) => {
    handlers.handleGetEditToken(data, callback, { socket, currentUser });
  });


  socket.on(SOCKET_EVENTS.CHANGE_SHARING_MODE, (data: handlers.ChangeSharingModeData) => {
    handlers.handleChangeSharingMode(data, { socket, io, currentUser });
  });

  socket.on(SOCKET_EVENTS.END_SESSION, (data: handlers.EndSessionData) => {
    handlers.handleEndSession(data, { socket, io, currentUser });
  });

  socket.on(SOCKET_EVENTS.DISCONNECT, () => {
    rateLimitService.clearSocketRateLimits(socket.id);
    clearLogKeysForSocket(socket.id);
    handlers.handleDisconnect({ socket, io, currentUser, currentWorkspaceRef });
  });
});

process.on('uncaughtException', (error: Error) => {
  logger.fatal({ err: error }, 'uncaught exception');
});

process.on('unhandledRejection', (reason: unknown) => {
  logger.fatal({ err: reason }, 'unhandled rejection');
});

io.on('error', (error: Error) => {
  logger.error({ err: error }, 'socket.io error');
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, cleaning up');
  clearInterval(rateLimitCleanupInterval);
  httpServer.close(() => {
    logger.info('server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, cleaning up');
  clearInterval(rateLimitCleanupInterval);
  httpServer.close(() => {
    logger.info('server closed');
    process.exit(0);
  });
});

httpServer.listen(config.port, () => {
  logger.info({ port: config.port }, 'server started');
});
