export const SOCKET_EVENTS = {
  CONNECTION: 'connection',
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  ERROR: 'error',
  CHECK_WORKSPACE_EXISTS: 'check-workspace-exists',
  WORKSPACE_EXISTS_RESULT: 'workspace-exists-result',
  JOIN_WORKSPACE: 'join-workspace',
  USER_JOINED: 'user-joined',
  USER_LEFT: 'user-left',
  WORKSPACE_STATE: 'workspace-state',
  WHITEBOARD_UPDATE: 'whiteboard-update',
  WHITEBOARD_CLEAR: 'whiteboard-clear',
  DELETE_ELEMENT: 'delete-element',
  DRAWING_START: 'drawing-start',
  DRAWING_STREAM: 'drawing-stream',
  DRAWING_END: 'drawing-end',
  SHAPE_DRAWING_START: 'shape-drawing-start',
  SHAPE_DRAWING_UPDATE: 'shape-drawing-update',
  SHAPE_DRAWING_END: 'shape-drawing-end',
  CODE_UPDATE: 'code-update',
  GET_SHARING_INFO: 'get-sharing-info',
  SHARING_INFO: 'sharing-info',
  SHARING_UPDATE: 'sharing-update',
  GET_ACTIVE_USERS: 'get-active-users',
  ACTIVE_USERS_UPDATE: 'active-users-update',
  CURSOR_POSITION: 'cursor-position',
  CURSOR_UPDATE: 'cursor-update',
  GET_EDIT_TOKEN: 'get-edit-token',
  SET_EDIT_TOKEN: 'set-edit-token',
  EDIT_TOKEN_UPDATED: 'edit-token-updated',
  END_SESSION: 'end-session',
  SESSION_ENDED: 'session-ended',
  CHANGE_SHARING_MODE: 'change-sharing-mode',
  SHARING_MODE_CHANGED: 'sharing-mode-changed',
} as const;

export type SocketEvent = typeof SOCKET_EVENTS[keyof typeof SOCKET_EVENTS];

export const SHARING_MODES = {
  READ_WRITE_ALL: 'read-write-all',
  READ_ONLY: 'read-only',
  READ_WRITE_SELECTED: 'read-write-selected',
} as const;

export type SharingMode = typeof SHARING_MODES[keyof typeof SHARING_MODES];
