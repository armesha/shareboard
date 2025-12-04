import { SOCKET_EVENTS, SHARING_MODES } from '../../../shared/constants.js';

export { SOCKET_EVENTS, SHARING_MODES };

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

export const ARROW = {
  HEAD_LENGTH: 15,
  HEAD_ANGLE: Math.PI / 6,
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
  { key: 'Ctrl+Drag', action: 'Perfect square', keyTranslationKey: 'ctrlDragRect', translationKey: 'perfectSquare' },
  { key: 'Ctrl+Drag', action: 'Perfect circle', keyTranslationKey: 'ctrlDragCircle', translationKey: 'perfectCircle' },
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
  MOUSE_WHEEL: 'mouse:wheel',
  MOUSE_DBLCLICK: 'mouse:dblclick',
  SELECTION_CREATED: 'selection:created',
  SELECTION_UPDATED: 'selection:updated',
  SELECTION_CLEARED: 'selection:cleared',
};

export const INTERACTIVE_TYPES = [
  'image', 'diagram', 'text', 'i-text', 'rect', 'circle', 'ellipse', 'triangle', 'star', 'diamond', 'pentagon', 'hexagon', 'octagon', 'cross', 'path', 'line', 'arrow', 'group'
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

export const DEFAULT_COLORS = {
  BLACK: '#000000',
  SELECTION: '#2196F3',
  SELECTION_BORDER: '#2196F3',
};

export const FONT_SIZES = [12, 16, 20, 24, 32, 48, 64];

export const LAYOUT = {
  MIN_WIDTH_PERCENT: 30,
  MAX_WIDTH_PERCENT: 70,
};

export const BRUSH_COLORS = [
  '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00',
  '#FF00FF', '#00FFFF', '#FFA500', '#808080', '#8B4513', '#800080',
  '#FF69B4', '#4169E1', '#228B22', '#DC143C', '#FFD700', '#40E0D0',
  '#708090', '#F5DEB3', '#2F4F4F', '#B22222', '#9370DB', '#20B2AA'
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
  COPY_SUCCESS_DURATION: 2000,
  SOCKET_TIMEOUT: 20000,
  CURSOR_THROTTLE: 50,
  CURSOR_TIMEOUT: 5000,
};

export const CURSOR_COLORS = [
  { color: '#3b82f6', name: 'Blue' },
  { color: '#10b981', name: 'Green' },
  { color: '#f59e0b', name: 'Amber' },
  { color: '#ef4444', name: 'Red' },
  { color: '#8b5cf6', name: 'Purple' },
  { color: '#ec4899', name: 'Pink' },
  { color: '#06b6d4', name: 'Cyan' },
  { color: '#84cc16', name: 'Lime' },
  { color: '#f97316', name: 'Orange' },
  { color: '#6366f1', name: 'Indigo' },
];

export const CURSOR_ANIMALS = [
  'fox', 'owl', 'wolf', 'bear', 'deer',
  'eagle', 'rabbit', 'tiger', 'lion', 'panda',
  'koala', 'dolphin', 'penguin', 'otter', 'hedgehog',
  'raccoon', 'squirrel', 'falcon', 'lynx', 'beaver',
];

export const SOCKET = {
  MAX_RECONNECT_ATTEMPTS: 5,
};

export const TOAST = {
  POSITION: 'bottom-right',
  MAX_TOASTS: 3,
};

export const EXPORT = {
  FILENAME_PREFIX: 'shareboard-export',
};

export const CANVAS = {
  EDGE_BUFFER: 40,
  DEFAULT_FONT_SIZE: 20,
  MIN_FONT_SIZE: 8,
  MAX_FONT_SIZE: 200,
  DEFAULT_FONT_FAMILY: 'Inter',
  DEFAULT_BRUSH_WIDTH: 2,
  MAX_BRUSH_WIDTH: 100,
  MIN_BRUSH_WIDTH: 1,
  AUTO_PAN_EDGE: 40,
  AUTO_PAN_SPEED: 10,
  AUTO_PAN_INTERVAL: 16,
  EXPORT_PADDING: 50,
  CUSTOM_CURSOR: "url(\"data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87c.48 0 .72-.58.38-.92L6.35 2.85a.5.5 0 0 0-.85.36Z' fill='%233b82f6' stroke='white' stroke-width='1.5'/%3E%3C/svg%3E\") 5 3, auto",
};

export const STORAGE_KEYS = {
  USER_ID: 'shareboardUserId',
  LANGUAGE: 'shareboardLanguage',
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
