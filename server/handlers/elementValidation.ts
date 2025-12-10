import { config } from '../config';
import type { WhiteboardElement } from '../types';

export const WORKSPACE_ID_REGEX = /^[a-zA-Z0-9_-]{1,32}$/;

export function isValidWorkspaceId(id: unknown): id is string {
  return typeof id === 'string' && WORKSPACE_ID_REGEX.test(id);
}

export const ELEMENT_TYPES = new Set([
  'rect', 'circle', 'ellipse', 'triangle', 'line', 'arrow', 'path',
  'text', 'diagram', 'polygon', 'star', 'diamond', 'pentagon',
  'hexagon', 'octagon', 'cross'
]);

const { maxIdLength: MAX_ELEMENT_ID_LENGTH, maxTextLength: MAX_TEXT_LENGTH, maxSrcLength: MAX_SRC_LENGTH } = config.validation.element;

interface ElementData {
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  scaleX?: number;
  scaleY?: number;
  angle?: number;
  strokeWidth?: number;
  fontSize?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  text?: string;
  src?: string;
  [key: string]: unknown;
}

export function isValidElementData(data: unknown): data is ElementData {
  if (typeof data !== 'object' || data === null) return false;
  const elementData = data as Record<string, unknown>;
  const numericKeys = [
    'left', 'top', 'width', 'height', 'scaleX', 'scaleY',
    'angle', 'strokeWidth', 'fontSize', 'x1', 'y1', 'x2', 'y2'
  ];
  for (const key of numericKeys) {
    if (elementData[key] !== undefined && (typeof elementData[key] !== 'number' || !Number.isFinite(elementData[key] as number))) {
      return false;
    }
  }
  if (elementData.text !== undefined && (typeof elementData.text !== 'string' || elementData.text.length > MAX_TEXT_LENGTH)) {
    return false;
  }
  if (elementData.src !== undefined && (typeof elementData.src !== 'string' || elementData.src.length > MAX_SRC_LENGTH)) {
    return false;
  }
  return true;
}

export function isValidElement(element: unknown): element is WhiteboardElement {
  if (typeof element !== 'object' || element === null) return false;
  const el = element as WhiteboardElement;
  if (typeof el.id !== 'string' || el.id.length === 0 || el.id.length > MAX_ELEMENT_ID_LENGTH) return false;
  if (!ELEMENT_TYPES.has(el.type)) return false;
  if (!isValidElementData(el.data)) return false;
  return true;
}

