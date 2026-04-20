import { SOCKET_EVENTS, SHARING_MODES } from '../../../shared/constants.js';

export { SOCKET_EVENTS, SHARING_MODES };

export const TOOLS = {
  SELECT: 'select',
  PEN: 'pen',
  TEXT: 'text',
  SHAPES: 'shapes',
  LINE: 'line',
  ARROW: 'arrow',
} as const;

export type Tool = typeof TOOLS[keyof typeof TOOLS];

export const ARROW = {
  HEAD_LENGTH: 15,
  HEAD_ANGLE: Math.PI / 6,
  MIN_HEAD_LENGTH: 12,
  HEAD_LENGTH_MULTIPLIER: 3,
} as const;

export const SHAPE_GEOMETRY = {
  STAR: {
    POINTS: 10,
    INNER_RADIUS_RATIO: 0.4,
    ANGLE_START: Math.PI / 2,
    ANGLE_STEP: Math.PI / 5,
  },
  PENTAGON: {
    SIDES: 5,
  },
  HEXAGON: {
    SIDES: 6,
  },
  OCTAGON: {
    SIDES: 8,
  },
  CROSS: {
    ARM_WIDTH_DIVISOR: 3,
  },
} as const;

export const POLYGON_SHAPE_TYPES = ['triangle', 'star', 'diamond', 'pentagon', 'hexagon', 'octagon', 'cross'] as const;
export const ZOOM = {
  WHEEL_OUT_MULTIPLIER: 0.95,
  WHEEL_IN_MULTIPLIER: 1.05,
  BUTTON_INCREMENT: 0.1,
  MIN: 0.1,
  MAX: 3,
} as const;

export const CONTROL_TIPS = [
  { key: 'Right-click', action: 'Pan canvas', keyTranslationKey: 'rightClick', translationKey: 'panCanvas' },
  { key: 'Scroll', action: 'Zoom in/out', keyTranslationKey: 'scroll', translationKey: 'zoomInOut' },
  { key: 'Delete', action: 'Delete selected', keyTranslationKey: 'delete', translationKey: 'deleteSelected' },
  { key: 'Ctrl+Drag', action: 'Perfect square', keyTranslationKey: 'ctrlDragRect', translationKey: 'perfectSquare' },
  { key: 'Ctrl+Drag', action: 'Perfect circle', keyTranslationKey: 'ctrlDragCircle', translationKey: 'perfectCircle' },
] as const;

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
} as const;

export type Shape = typeof SHAPES[keyof typeof SHAPES];


export const FABRIC_EVENTS = {
  PATH_CREATED: 'path:created',
  OBJECT_MODIFIED: 'object:modified',
  OBJECT_MOVING: 'object:moving',
  OBJECT_SCALING: 'object:scaling',
  OBJECT_ROTATING: 'object:rotating',
  MOUSE_DOWN: 'mouse:down',
  MOUSE_MOVE: 'mouse:move',
  MOUSE_UP: 'mouse:up',
  MOUSE_WHEEL: 'mouse:wheel',
} as const;

export const INTERACTIVE_TYPES = [
  'image', 'diagram', 'text', 'i-text', 'rect', 'circle', 'ellipse', 'polygon', 'triangle', 'star', 'diamond', 'pentagon', 'hexagon', 'octagon', 'cross', 'path', 'line', 'arrow', 'group'
] as const;

export const COLORS = {
  BG_WHITEBOARD: 'rgb(249, 250, 251)',
} as const;

export const DEFAULT_COLORS = {
  BLACK: '#000000',
  SELECTION: '#2196F3',
  SELECTION_BORDER: '#2196F3',
} as const;

export const FONT_SIZES = [12, 16, 20, 24, 32, 40, 48, 64, 80] as const;

export const LAYOUT = {
  MIN_WIDTH_PERCENT: 30,
  MAX_WIDTH_PERCENT: 70,
} as const;

export const BRUSH_COLORS = [
  '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00',
  '#FF00FF', '#00FFFF', '#FFA500', '#808080', '#8B4513', '#800080',
  '#FF69B4', '#4169E1', '#228B22', '#DC143C', '#FFD700', '#40E0D0',
  '#708090', '#F5DEB3', '#2F4F4F', '#B22222', '#9370DB', '#20B2AA'
] as const;

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
} as const;

export const TIMING = {
  NOTIFICATION_DURATION: 3000,
  MOVEMENT_TIMEOUT: 50,
  RECONNECT_DELAY: 2000,
  RECONNECT_MAX_DELAY: 10000,
  COPY_SUCCESS_DURATION: 2000,
  SOCKET_TIMEOUT: 20000,
  CURSOR_THROTTLE: 50,
  CURSOR_TIMEOUT: 5000,
  DRAWING_STREAM_THROTTLE: 50,
  TOKEN_TTL_MS: 4 * 60 * 60 * 1000,
  REMOTE_DRAWING_CLEANUP_DELAY: 100,
} as const;

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
] as const;

export const CURSOR_ANIMALS = [
  'fox', 'owl', 'wolf', 'bear', 'deer',
  'eagle', 'rabbit', 'tiger', 'lion', 'panda',
  'koala', 'dolphin', 'penguin', 'otter', 'hedgehog',
  'raccoon', 'squirrel', 'falcon', 'lynx', 'beaver',
] as const;

export const SOCKET = {
  MAX_RECONNECT_ATTEMPTS: 5,
} as const;

export const TOAST = {
  POSITION: 'bottom-right' as const,
  MAX_TOASTS: 3,
} as const;

export const EXPORT = {
  FILENAME_PREFIX: 'shareboard-export',
} as const;

export const DIAGRAM_POSITION = {
  HORIZONTAL_OFFSET_RATIO: 0.15,
  VERTICAL_OFFSET_RATIO: 0.2,
  SCALE_RATIO: 0.18,
  FALLBACK_CENTER_X_RATIO: 0.3,
  FALLBACK_CENTER_Y_RATIO: 0.2,
  FALLBACK_SCALE_RATIO: 0.15,
  IMAGE_SCALE_MULTIPLIER: 2.0,
} as const;

export const CANVAS = {
  EDGE_BUFFER: 40,
  DEFAULT_FONT_SIZE: 20,
  MIN_FONT_SIZE: 8,
  MAX_FONT_SIZE: 100,
  DEFAULT_FONT_FAMILY: 'Inter',
  CODE_FONT_FAMILY: 'Consolas, Monaco, monospace',
  DEFAULT_BRUSH_WIDTH: 2,
  MAX_BRUSH_WIDTH: 100,
  MIN_BRUSH_WIDTH: 1,
  EXPORT_PADDING: 50,
  EXPORT_MULTIPLIER: 2,
  STROKE_MITER_LIMIT: 10,
  CUSTOM_CURSOR: "url(\"data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87c.48 0 .72-.58.38-.92L6.35 2.85a.5.5 0 0 0-.85.36Z' fill='%233b82f6' stroke='white' stroke-width='1.5'/%3E%3C/svg%3E\") 5 3, auto",
} as const;

export const STORAGE_KEYS = {
  USER_ID: 'shareboardUserId',
  LANGUAGE: 'shareboardLanguage',
  SPLIT_POSITION: 'shareboardSplitPosition',
  accessToken: (workspaceId: string) => `accessToken_${workspaceId}`,
  editToken: (workspaceId: string) => `editToken_${workspaceId}`,
} as const;

export const CONNECTION_STATUS = {
  CONNECTED: 'connected',
  CONNECTING: 'connecting',
  DISCONNECTED: 'disconnected',
  ERROR: 'error',
} as const;

export const FABRIC_OBJECT_PROPS = [
  'id', 'left', 'top', 'width', 'height', 'scaleX', 'scaleY', 'angle',
  'stroke', 'strokeWidth', 'fill', 'opacity', 'path',
  'strokeLineCap', 'strokeLineJoin', 'strokeMiterLimit',
  'text', 'fontSize', 'fontFamily', 'fontWeight', 'fontStyle',
  'textAlign', 'charSpacing', 'lineHeight'
] as const;

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
] as const;

export type CodeEditorLanguage = typeof CODE_EDITOR_LANGUAGES[number];

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
} as const;

export const SAMPLE_DIAGRAM = `graph TD
  A[Start] --> B{Is it?}
  B -- Yes --> C[OK]
  B -- No --> D[End]
`;
