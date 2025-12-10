import { describe, it, expect } from 'vitest';

/**
 * Geometry calculation functions for shape drawing.
 *
 * These functions are implemented inline in this test file because the actual
 * geometry calculations are embedded within the useShapeDrawing hook
 * (client/src/hooks/useShapeDrawing.js) as part of the updateShape callback.
 * They are not exported as standalone functions since they are tightly coupled
 * with Fabric.js shape manipulation and canvas rendering.
 *
 * These tests verify the mathematical correctness of the geometry algorithms
 * used for rectangle, circle, triangle, and line drawing with modifiers
 * (Ctrl for constrained proportions, Shift for line snapping).
 */

interface RectangleResult {
  width: number;
  height: number;
  left: number;
  top: number;
}

interface CircleResult {
  radius: number;
  left: number;
  top: number;
}

interface Point {
  x: number;
  y: number;
}

interface TriangleResult {
  points: Point[];
  isUpsideDown: boolean;
}

interface LineSnapResult {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const calculateRectangle = (
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
  ctrlPressed: boolean = false
): RectangleResult => {
  const deltaWidth = currentX - startX;
  const deltaHeight = currentY - startY;

  if (ctrlPressed) {
    const size = Math.max(Math.abs(deltaWidth), Math.abs(deltaHeight));
    return {
      width: size,
      height: size,
      left: deltaWidth > 0 ? startX : startX - size,
      top: deltaHeight > 0 ? startY : startY - size
    };
  } else {
    return {
      width: Math.abs(deltaWidth),
      height: Math.abs(deltaHeight),
      left: deltaWidth > 0 ? startX : currentX,
      top: deltaHeight > 0 ? startY : currentY
    };
  }
};

const calculateCircle = (
  startX: number,
  startY: number,
  currentX: number,
  currentY: number
): CircleResult => {
  const deltaWidth = currentX - startX;
  const deltaHeight = currentY - startY;
  const radius = Math.sqrt(deltaWidth * deltaWidth + deltaHeight * deltaHeight) / 2;

  return {
    radius: radius,
    left: startX - radius,
    top: startY - radius
  };
};

const calculateTriangle = (
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
  ctrlPressed: boolean = false
): TriangleResult => {
  const deltaWidth = currentX - startX;
  const deltaHeight = currentY - startY;
  const isUpsideDown = deltaHeight < 0;
  const absWidth = Math.abs(deltaWidth) || 1;
  const absHeight = Math.abs(deltaHeight) || 1;

  let triWidth = absWidth;
  let triHeight = absHeight;

  if (ctrlPressed) {
    const size = Math.max(absWidth, absHeight);
    triWidth = size;
    triHeight = size;
  }

  const halfWidth = triWidth / 2;
  let points: Point[];

  if (isUpsideDown) {
    points = [
      { x: startX, y: startY },
      { x: startX - halfWidth, y: startY - triHeight },
      { x: startX + halfWidth, y: startY - triHeight }
    ];
  } else {
    points = [
      { x: startX, y: startY },
      { x: startX - halfWidth, y: startY + triHeight },
      { x: startX + halfWidth, y: startY + triHeight }
    ];
  }

  return { points, isUpsideDown };
};

const calculateLineSnap = (
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  shiftPressed: boolean = false
): LineSnapResult => {
  if (!shiftPressed) {
    return { x1: startX, y1: startY, x2: endX, y2: endY };
  }

  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);

  let newEndX = endX;
  let newEndY = endY;

  if (absX > absY * 2) {
    newEndY = startY;
  } else if (absY > absX * 2) {
    newEndX = startX;
  } else {
    const dist = Math.max(absX, absY);
    newEndX = startX + (deltaX > 0 ? dist : -dist);
    newEndY = startY + (deltaY > 0 ? dist : -dist);
  }

  return { x1: startX, y1: startY, x2: newEndX, y2: newEndY };
};

describe('Rectangle geometry calculations', () => {
  it('calculates dimensions in all directions with Ctrl modifier', () => {
    expect(calculateRectangle(100, 100, 200, 150)).toEqual({ width: 100, height: 50, left: 100, top: 100 });
    expect(calculateRectangle(100, 100, 50, 150)).toEqual({ width: 50, height: 50, left: 50, top: 100 });
    expect(calculateRectangle(100, 100, 200, 50)).toEqual({ width: 100, height: 50, left: 100, top: 50 });
    expect(calculateRectangle(100, 100, 200, 130, true)).toEqual({ width: 100, height: 100, left: 100, top: 100 });
    expect(calculateRectangle(100, 100, 130, 250, true)).toEqual({ width: 150, height: 150, left: 100, top: 100 });
  });
});

describe('Circle geometry calculations', () => {
  it('calculates radius and position', () => {
    expect(calculateCircle(100, 100, 200, 100)).toEqual({ radius: 50, left: 50, top: 50 });
    const diagonal = calculateCircle(0, 0, 60, 80);
    expect(diagonal.radius).toBeCloseTo(50, 0);
    expect(calculateCircle(100, 100, 100, 100).radius).toBe(0);
  });
});

describe('Triangle geometry calculations', () => {
  it('calculates triangle points with Ctrl modifier', () => {
    expect(calculateTriangle(100, 100, 200, 200)).toEqual({ isUpsideDown: false, points: [{ x: 100, y: 100 }, { x: 50, y: 200 }, { x: 150, y: 200 }] });
    expect(calculateTriangle(100, 100, 200, 50).isUpsideDown).toBe(true);
    expect(calculateTriangle(100, 100, 250, 150, true).points[1]!.y).toBe(250);
  });
});

describe('Line snap logic (Shift modifier)', () => {
  it('snaps to horizontal, vertical, and diagonal', () => {
    expect(calculateLineSnap(100, 100, 250, 175, false)).toEqual({ x1: 100, y1: 100, x2: 250, y2: 175 });
    expect(calculateLineSnap(100, 100, 300, 120, true)).toEqual({ x1: 100, y1: 100, x2: 300, y2: 100 });
    expect(calculateLineSnap(100, 100, 120, 300, true)).toEqual({ x1: 100, y1: 100, x2: 100, y2: 300 });
    expect(calculateLineSnap(100, 100, 180, 170, true)).toEqual({ x1: 100, y1: 100, x2: 180, y2: 180 });
  });
});
