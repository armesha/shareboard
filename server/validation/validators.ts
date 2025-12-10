import { config } from '../config';
import type { Position } from '../types';

const COLOR_REGEX = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$|^(rgb|rgba)\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*[\d.]+\s*)?\)$|^[a-zA-Z]+$/;

export function isValidCursorPosition(position: unknown): position is Position {
  const { minPosition, maxPosition } = config.validation.cursor;
  return typeof position === 'object' &&
         position !== null &&
         'x' in position &&
         'y' in position &&
         typeof (position as Position).x === 'number' &&
         typeof (position as Position).y === 'number' &&
         Number.isFinite((position as Position).x) &&
         Number.isFinite((position as Position).y) &&
         (position as Position).x >= minPosition &&
         (position as Position).x <= maxPosition &&
         (position as Position).y >= minPosition &&
         (position as Position).y <= maxPosition;
}

export function isValidUserColor(color: unknown): color is string {
  return typeof color === 'string' && color.length <= config.validation.cursor.maxColorLength;
}

export function isValidAnimalKey(key: unknown): key is string {
  return typeof key === 'string' && key.length <= config.validation.cursor.maxAnimalKeyLength;
}

export function isValidDrawingId(id: unknown): id is string {
  return typeof id === 'string' && id.length > 0 && id.length <= config.validation.drawing.maxIdLength;
}

export function isValidShapeId(id: unknown): id is string {
  return typeof id === 'string' && id.length > 0 && id.length <= config.validation.drawing.maxShapeIdLength;
}

export function isValidShapeType(type: unknown): type is string {
  return typeof type === 'string' && type.length > 0 && type.length <= config.validation.drawing.maxShapeTypeLength;
}

export function isValidColor(color: unknown): color is string {
  return typeof color === 'string' && COLOR_REGEX.test(color);
}

export function isValidBrushWidth(width: unknown): width is number {
  const { minBrushWidth, maxBrushWidth } = config.validation.drawing;
  return typeof width === 'number' &&
         width >= minBrushWidth &&
         width <= maxBrushWidth &&
         Number.isFinite(width);
}

export function isValidPoints(points: unknown): points is (number | Position)[] {
  if (!Array.isArray(points)) return false;
  if (points.length > config.validation.drawing.maxPointsLength) return false;
  return points.every(p => {
    if (typeof p === 'number') return Number.isFinite(p);
    if (typeof p === 'object' && p !== null) {
      return typeof (p as unknown as Position).x === 'number' && Number.isFinite((p as unknown as Position).x) &&
             typeof (p as unknown as Position).y === 'number' && Number.isFinite((p as unknown as Position).y);
    }
    return false;
  });
}

export function isValidShapeData(data: unknown): data is Record<string, unknown> {
  if (typeof data !== 'object' || data === null) return false;
  const numericProps = ['left', 'top', 'width', 'height', 'scaleX', 'scaleY', 'angle', 'x1', 'y1', 'x2', 'y2'];
  for (const prop of numericProps) {
    const value = (data as Record<string, unknown>)[prop];
    if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value))) {
      return false;
    }
  }
  return true;
}
