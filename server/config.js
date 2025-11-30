export const config = {
  port: process.env.PORT || 3000,
  isProduction: process.env.NODE_ENV === 'production',
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? false
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
    intervalMs: 60 * 60 * 1000,
    inactiveThresholdMs: 24 * 60 * 60 * 1000
  },
  workspace: {
    keyLength: 6,
    userIdLength: 10
  }
};

export const SOCKET_EVENTS = {
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  JOIN_WORKSPACE: 'join-workspace',
  USER_JOINED: 'user-joined',
  USER_LEFT: 'user-left',
  WORKSPACE_STATE: 'workspace-state',
  WHITEBOARD_UPDATE: 'whiteboard-update',
  WHITEBOARD_CLEAR: 'whiteboard-clear',
  DELETE_ELEMENT: 'delete-element',
  DELETE_DIAGRAM: 'delete-diagram',
  CODE_UPDATE: 'code-update',
  DIAGRAM_UPDATE: 'diagram-update',
  GET_SHARING_INFO: 'get-sharing-info',
  SHARING_INFO: 'sharing-info',
  GET_ACTIVE_USERS: 'get-active-users',
  ACTIVE_USERS_UPDATE: 'active-users-update',
  INVITE_USER: 'invite-user',
  REQUEST_CANVAS_STATE: 'request-canvas-state',
  CURSOR_POSITION: 'cursor-position',
  CURSOR_UPDATE: 'cursor-update',
  GET_EDIT_TOKEN: 'get-edit-token',
  SET_EDIT_TOKEN: 'set-edit-token',
  EDIT_TOKEN_UPDATED: 'edit-token-updated',
  END_SESSION: 'end-session',
  SESSION_ENDED: 'session-ended',
  CHANGE_SHARING_MODE: 'change-sharing-mode',
  SHARING_MODE_CHANGED: 'sharing-mode-changed',
  ERROR: 'error'
};

export const SHARING_MODES = {
  READ_WRITE_ALL: 'read-write-all',
  READ_ONLY: 'read-only',
  READ_WRITE_SELECTED: 'read-write-selected'
};
