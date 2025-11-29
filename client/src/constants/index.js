export const TOOLS = {
  SELECT: 'select',
  PEN: 'pen',
  TEXT: 'text',
  SHAPES: 'shapes',
  LINE: 'line',
  ARROW: 'arrow',
};

export const SHAPES = {
  RECTANGLE: 'rectangle',
  CIRCLE: 'circle',
  TRIANGLE: 'triangle',
};

export const SHARING_MODES = {
  READ_WRITE_ALL: 'read-write-all',
  READ_ONLY: 'read-only',
  READ_WRITE_SELECTED: 'read-write-selected',
};

export const SOCKET_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  ERROR: 'error',
  JOIN_WORKSPACE: 'join-workspace',
  LEAVE_WORKSPACE: 'leave-workspace',
  WORKSPACE_STATE: 'workspace-state',
  WHITEBOARD_UPDATE: 'whiteboard-update',
  WHITEBOARD_CLEAR: 'whiteboard-clear',
  DELETE_ELEMENT: 'delete-element',
  CODE_UPDATE: 'code-update',
  DIAGRAM_UPDATE: 'diagram-update',
  GET_SHARING_INFO: 'get-sharing-info',
  SHARING_INFO: 'sharing-info',
  CHANGE_SHARING_MODE: 'change-sharing-mode',
  SHARING_UPDATE: 'sharing-update',
  EDIT_TOKEN_UPDATED: 'edit-token-updated',
  GET_EDIT_TOKEN: 'get-edit-token',
  SET_EDIT_TOKEN: 'set-edit-token',
  INVITE_USER: 'invite-user',
  END_SESSION: 'end-session',
  SESSION_ENDED: 'session-ended',
  REQUEST_CANVAS_STATE: 'request-canvas-state',
  CANVAS_STATE: 'canvas-state',
};

export const FABRIC_EVENTS = {
  PATH_CREATED: 'path:created',
  OBJECT_MODIFIED: 'object:modified',
  OBJECT_MOVING: 'object:moving',
  OBJECT_MOVED: 'object:moved',
  OBJECT_SCALING: 'object:scaling',
  OBJECT_ROTATING: 'object:rotating',
  TEXT_CHANGED: 'text:changed',
  MOUSE_DOWN: 'mouse:down',
  MOUSE_MOVE: 'mouse:move',
  MOUSE_UP: 'mouse:up',
  MOUSE_DBLCLICK: 'mouse:dblclick',
  SELECTION_CREATED: 'selection:created',
  SELECTION_UPDATED: 'selection:updated',
  SELECTION_CLEARED: 'selection:cleared',
};

export const INTERACTIVE_TYPES = [
  'image', 'text', 'i-text', 'rect', 'circle', 'triangle', 'path', 'line', 'arrow', 'group'
];

export const COLORS = {
  BG_WHITEBOARD: 'rgb(249, 250, 251)',
  DIAGRAM_BG: 'rgba(240, 240, 240, 0.5)',
  DIAGRAM_BORDER: '#ccc',
  PRIMARY: '#3B82F6',
  PRIMARY_DARK: '#1D4ED8',
  SUCCESS: '#10B981',
  WARNING: '#F59E0B',
  DANGER: '#EF4444',
  TEXT_PRIMARY: '#1F2937',
  TEXT_SECONDARY: '#6B7280',
  BORDER: '#E5E7EB',
};

export const BRUSH_COLORS = [
  '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF',
  '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#808080'
];

export const MERMAID_THEME = {
  primaryColor: '#3B82F6',
  primaryTextColor: '#1F2937',
  primaryBorderColor: '#3B82F6',
  lineColor: '#3B82F6',
  textColor: '#1F2937',
  fontSize: '16px',
  background: 'transparent',
  backgroundColor: 'transparent',
  nodeBorder: '#3B82F6',
  mainBkg: 'rgba(220, 225, 255, 0.7)',
  titleColor: '#1F2937',
  edgeLabelBackground: 'transparent',
  clusterBkg: 'transparent',
  clusterBorder: '#3B82F6',
};

export const TIMING = {
  DEBOUNCE_DELAY: 250,
  NOTIFICATION_DURATION: 3000,
  MOVEMENT_TIMEOUT: 50,
  DIAGRAM_ADJUSTMENT_DELAY: 100,
  STATE_REFRESH_INTERVAL: 30000,
  RECONNECT_DELAY: 2000,
  RECONNECT_MAX_DELAY: 10000,
};

export const CANVAS = {
  EDGE_BUFFER: 20,
  EDGE_BUFFER_LARGE: 30,
  DEFAULT_FONT_SIZE: 20,
  DEFAULT_FONT_FAMILY: 'Arial',
  DEFAULT_BRUSH_WIDTH: 2,
  MAX_BRUSH_WIDTH: 20,
  MIN_BRUSH_WIDTH: 1,
};

export const STORAGE_KEYS = {
  USER_ID: 'shareboardUserId',
  accessToken: (workspaceId) => `accessToken_${workspaceId}`,
  editToken: (workspaceId) => `editToken_${workspaceId}`,
};

export const CONNECTION_STATUS = {
  CONNECTED: 'connected',
  CONNECTING: 'connecting',
  DISCONNECTED: 'disconnected',
  ERROR: 'error',
};

export const FABRIC_OBJECT_PROPS = [
  'id', 'left', 'top', 'width', 'height', 'scaleX', 'scaleY', 'angle',
  'stroke', 'strokeWidth', 'fill', 'opacity', 'path',
  'strokeLineCap', 'strokeLineJoin', 'strokeMiterLimit',
  'text', 'fontSize', 'fontFamily', 'fontWeight', 'fontStyle',
  'textAlign', 'charSpacing', 'lineHeight'
];
