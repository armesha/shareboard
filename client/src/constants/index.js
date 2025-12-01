export const TOOLS = {
  SELECT: 'select',
  PEN: 'pen',
  TEXT: 'text',
  SHAPES: 'shapes',
  LINE: 'line',
  ARROW: 'arrow',
};

export const GRID = {
  SIZE: 20,
  COLOR: 'rgba(200, 200, 200, 0.3)',
};

export const ZOOM = {
  WHEEL_OUT_MULTIPLIER: 0.95,
  WHEEL_IN_MULTIPLIER: 1.05,
  BUTTON_INCREMENT: 0.1,
  MIN: 0.1,
  MAX: 3,
};

export const COLOR_PICKER = {
  BASIC_COLORS: ['#000000', '#FF0000', '#0000FF', '#00FF00'],
  RECENT_COLORS_KEY: 'whiteboard_recent_colors',
  MAX_RECENT_COLORS: 4,
};

export const KEYBOARD = {
  PAN: 'Space',
  DELETE: 'Delete',
};

export const CONTROL_TIPS = [
  { key: 'Right-click', action: 'Pan canvas', keyTranslationKey: 'rightClick', translationKey: 'panCanvas' },
  { key: 'Scroll', action: 'Zoom in/out', keyTranslationKey: 'scroll', translationKey: 'zoomInOut' },
  { key: 'Delete', action: 'Delete selected', keyTranslationKey: 'delete', translationKey: 'deleteSelected' },
];

export const SHAPES = {
  RECTANGLE: 'rectangle',
  CIRCLE: 'circle',
  ELLIPSE: 'ellipse',
  TRIANGLE: 'triangle',
  PENTAGON: 'pentagon',
  HEXAGON: 'hexagon',
  OCTAGON: 'octagon',
  DIAMOND: 'diamond',
  STAR: 'star',
  CROSS: 'cross',
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
  SHARING_UPDATE: 'sharing-update',
  EDIT_TOKEN_UPDATED: 'edit-token-updated',
  GET_EDIT_TOKEN: 'get-edit-token',
  SET_EDIT_TOKEN: 'set-edit-token',
  GET_ACTIVE_USERS: 'get-active-users',
  ACTIVE_USERS_UPDATE: 'active-users-update',
  INVITE_USER: 'invite-user',
  END_SESSION: 'end-session',
  SESSION_ENDED: 'session-ended',
  REQUEST_CANVAS_STATE: 'request-canvas-state',
  CANVAS_STATE: 'canvas-state',
  CHANGE_SHARING_MODE: 'change-sharing-mode',
  SHARING_MODE_CHANGED: 'sharing-mode-changed',
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
  'image', 'text', 'i-text', 'rect', 'circle', 'ellipse', 'triangle', 'star', 'diamond', 'pentagon', 'hexagon', 'octagon', 'cross', 'path', 'line', 'arrow', 'group'
];

export const EXPORT_MODES = {
  ALL_OBJECTS: 'all-objects',
  CUSTOM_AREA: 'custom-area',
};

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
  '#000000', '#FFFFFF', '#FF0000', '#00FF00',
  '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
  '#FFA500', '#808080', '#8B4513', '#800080'
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
  nodeBkg: 'rgba(240, 245, 255, 0.7)',
  mainBkg: 'rgba(240, 245, 255, 0.7)',
  titleColor: '#1F2937',
  edgeLabelBackground: 'transparent',
  clusterBkg: 'transparent',
  clusterBorder: '#3B82F6',
  labelBackground: 'transparent',
  nodeTextColor: '#1F2937',
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
  EDGE_BUFFER: 40,
  DEFAULT_FONT_SIZE: 20,
  DEFAULT_FONT_FAMILY: 'Arial',
  DEFAULT_BRUSH_WIDTH: 2,
  MAX_BRUSH_WIDTH: 20,
  MIN_BRUSH_WIDTH: 1,
  AUTO_PAN_EDGE: 40,
  AUTO_PAN_SPEED: 10,
  AUTO_PAN_INTERVAL: 16,
};

export const STORAGE_KEYS = {
  USER_ID: 'shareboardUserId',
  SPLIT_POSITION: 'shareboardSplitPosition',
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

export const CODE_EDITOR_LANGUAGES = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C/C++' },
  { value: 'go', label: 'Go' },
  { value: 'sql', label: 'SQL' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'json', label: 'JSON' }
];

export const CODE_EXAMPLES = {
  javascript: `function greet(name) {
  return \`Hello, \${name}!\`;
}

console.log(greet("World"));`,

  typescript: `function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

console.log(greet("World"));`,

  python: `def greet(name: str) -> str:
    return f"Hello, {name}!"

if __name__ == "__main__":
    print(greet("World"))`,

  java: `public class HelloWorld {
    public static void main(String[] args) {
        System.out.println(greet("World"));
    }

    public static String greet(String name) {
        return "Hello, " + name + "!";
    }
}`,

  cpp: `#include <iostream>
#include <string>

std::string greet(const std::string& name) {
    return "Hello, " + name + "!";
}

int main() {
    std::cout << greet("World") << std::endl;
    return 0;
}`,

  go: `package main

import "fmt"

func greet(name string) string {
    return fmt.Sprintf("Hello, %s!", name)
}

func main() {
    fmt.Println(greet("World"))
}`,

  sql: `-- Create a greetings table
CREATE TABLE greetings (
    id INT PRIMARY KEY,
    name VARCHAR(100),
    message VARCHAR(255)
);

-- Insert a greeting
INSERT INTO greetings (id, name, message)
VALUES (1, 'World', 'Hello, World!');

-- Select the greeting
SELECT * FROM greetings WHERE name = 'World';`,

  html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Hello World</title>
</head>
<body>
    <h1>Hello, World!</h1>
    <p>Welcome to my page.</p>
</body>
</html>`,

  css: `/* Main container styles */
.container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.hello-world {
    font-size: 3rem;
    color: white;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
}`,

  json: `{
  "greeting": {
    "message": "Hello, World!",
    "language": "en",
    "timestamp": "2024-01-01T00:00:00Z"
  },
  "metadata": {
    "version": "1.0.0",
    "author": "Developer"
  }
}`
};
