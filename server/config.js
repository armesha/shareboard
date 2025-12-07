import { SOCKET_EVENTS, SHARING_MODES } from '../shared/constants.js';

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
    transports: ['websocket', 'polling'],
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
  }
};

