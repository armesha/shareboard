import { SOCKET_EVENTS, SHARING_MODES } from '../shared/constants';

export { SOCKET_EVENTS, SHARING_MODES };

export const config = {
  port: process.env.PORT || 3000,
  isProduction: process.env.NODE_ENV === 'production',
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? ['https://shareboard.live', 'https://www.shareboard.live']
      : ['http://localhost:5173', 'http://localhost:3000']
  },
  socketIO: {
    transports: ['websocket', 'polling'] as const,
    perMessageDeflate: false,
    pingInterval: 25000,
    pingTimeout: 60000,
    maxHttpBufferSize: 1e6,
  },
  cleanup: {
    intervalMs: 5 * 60 * 1000,
    inactiveThresholdMs: 15 * 60 * 1000
  },
  workspace: {
    keyLength: 12,
    userIdLength: 10
  },
  batch: {
    interval: 50
  },
  validation: {
    drawing: {
      maxIdLength: 64,
      maxShapeIdLength: 64,
      maxShapeTypeLength: 32,
      minBrushWidth: 1,
      maxBrushWidth: 100,
      maxPointsLength: 10000,
    },
    cursor: {
      minPosition: -50000,
      maxPosition: 50000,
      maxColorLength: 32,
      maxAnimalKeyLength: 32,
    },
    element: {
      maxIdLength: 100,
      maxTextLength: 2000,
      maxSrcLength: 512000,
    },
    workspace: {
      maxElementsPerUpdate: 100,
      maxCodeLength: 500000,
      maxDrawings: 5000,
      maxUsersPerWorkspace: 100,
      maxLanguageLength: 32,
    },
    rateLimit: {
      ttlMs: 60000,
      cleanupIntervalMs: 30000,
      windowMs: 1000,
      maxEventsPerWindow: 50,
      apiWindowMs: 60000,
      apiMaxRequests: 10,
      wsWindowMs: 60000,
      wsMaxRequests: 100,
    },
    lock: {
      timeoutMs: 5000,
    },
  },
};
