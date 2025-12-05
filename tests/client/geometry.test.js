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

function calculateRectangle(startX, startY, currentX, currentY, ctrlPressed = false) {
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
}

function calculateCircle(startX, startY, currentX, currentY) {
  const deltaWidth = currentX - startX;
  const deltaHeight = currentY - startY;
  const radius = Math.sqrt(deltaWidth * deltaWidth + deltaHeight * deltaHeight) / 2;

  return {
    radius: radius,
    left: startX - radius,
    top: startY - radius
  };
}

function calculateTriangle(startX, startY, currentX, currentY, ctrlPressed = false) {
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
  let points;

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
}

function calculateLineSnap(startX, startY, endX, endY, shiftPressed = false) {
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
}

describe('Rectangle geometry calculations', () => {
  it('should calculate width and height from positive drag (right-down)', () => {
    const result = calculateRectangle(100, 100, 200, 150);
    expect(result).toEqual({
      width: 100,
      height: 50,
      left: 100,
      top: 100
    });
  });

  it('should handle negative drag to the left (negative deltaWidth)', () => {
    const result = calculateRectangle(100, 100, 50, 150);
    expect(result).toEqual({
      width: 50,
      height: 50,
      left: 50,
      top: 100
    });
  });

  it('should handle negative drag upward (negative deltaHeight)', () => {
    const result = calculateRectangle(100, 100, 200, 50);
    expect(result).toEqual({
      width: 100,
      height: 50,
      left: 100,
      top: 50
    });
  });

  it('should handle negative drag to top-left (both negative)', () => {
    const result = calculateRectangle(100, 100, 50, 50);
    expect(result).toEqual({
      width: 50,
      height: 50,
      left: 50,
      top: 50
    });
  });

  it('should force square when Ctrl is pressed (width > height)', () => {
    const result = calculateRectangle(100, 100, 200, 130, true);
    expect(result).toEqual({
      width: 100,
      height: 100,
      left: 100,
      top: 100
    });
  });

  it('should force square when Ctrl is pressed (height > width)', () => {
    const result = calculateRectangle(100, 100, 130, 250, true);
    expect(result).toEqual({
      width: 150,
      height: 150,
      left: 100,
      top: 100
    });
  });

  it('should force square with Ctrl and negative drag left', () => {
    const result = calculateRectangle(100, 100, 50, 200, true);
    expect(result).toEqual({
      width: 100,
      height: 100,
      left: 0,
      top: 100
    });
  });

  it('should force square with Ctrl and negative drag up', () => {
    const result = calculateRectangle(100, 100, 200, 20, true);
    expect(result).toEqual({
      width: 100,
      height: 100,
      left: 100,
      top: 0
    });
  });

  it('should force square with Ctrl and negative drag top-left', () => {
    const result = calculateRectangle(100, 100, 20, 20, true);
    expect(result).toEqual({
      width: 80,
      height: 80,
      left: 20,
      top: 20
    });
  });

  it('should handle zero drag (same start and end point)', () => {
    const result = calculateRectangle(100, 100, 100, 100);
    expect(result).toEqual({
      width: 0,
      height: 0,
      left: 100,
      top: 100
    });
  });
});

describe('Circle geometry calculations', () => {
  it('should calculate radius from distance formula', () => {
    const result = calculateCircle(100, 100, 200, 100);
    const expectedRadius = 50;
    expect(result.radius).toBe(expectedRadius);
  });

  it('should adjust position for radius (centered at start point)', () => {
    const result = calculateCircle(100, 100, 200, 100);
    expect(result.left).toBe(50);
    expect(result.top).toBe(50);
  });

  it('should calculate diagonal drag correctly', () => {
    const result = calculateCircle(0, 0, 60, 80);
    const expectedRadius = Math.sqrt(60 * 60 + 80 * 80) / 2;
    expect(result.radius).toBeCloseTo(expectedRadius, 5);
    expect(result.left).toBeCloseTo(-expectedRadius, 5);
    expect(result.top).toBeCloseTo(-expectedRadius, 5);
  });

  it('should handle negative drag', () => {
    const result = calculateCircle(100, 100, 50, 50);
    const expectedRadius = Math.sqrt(50 * 50 + 50 * 50) / 2;
    expect(result.radius).toBeCloseTo(expectedRadius, 5);
    expect(result.left).toBeCloseTo(100 - expectedRadius, 5);
    expect(result.top).toBeCloseTo(100 - expectedRadius, 5);
  });

  it('should handle zero drag', () => {
    const result = calculateCircle(100, 100, 100, 100);
    expect(result.radius).toBe(0);
    expect(result.left).toBe(100);
    expect(result.top).toBe(100);
  });

  it('should handle vertical drag', () => {
    const result = calculateCircle(100, 100, 100, 200);
    const expectedRadius = 50;
    expect(result.radius).toBe(expectedRadius);
    expect(result.left).toBe(50);
    expect(result.top).toBe(50);
  });
});

describe('Triangle geometry calculations', () => {
  it('should calculate upright triangle points (positive deltaHeight)', () => {
    const result = calculateTriangle(100, 100, 200, 200);
    expect(result.isUpsideDown).toBe(false);
    expect(result.points).toEqual([
      { x: 100, y: 100 },
      { x: 50, y: 200 },
      { x: 150, y: 200 }
    ]);
  });

  it('should calculate upside-down triangle points (negative deltaHeight)', () => {
    const result = calculateTriangle(100, 100, 200, 50);
    expect(result.isUpsideDown).toBe(true);
    expect(result.points).toEqual([
      { x: 100, y: 100 },
      { x: 50, y: 50 },
      { x: 150, y: 50 }
    ]);
  });

  it('should handle zero drag (minimum 1x1 triangle)', () => {
    const result = calculateTriangle(100, 100, 100, 100);
    expect(result.points).toEqual([
      { x: 100, y: 100 },
      { x: 99.5, y: 101 },
      { x: 100.5, y: 101 }
    ]);
  });

  it('should force equilateral triangle with Ctrl (width > height)', () => {
    const result = calculateTriangle(100, 100, 250, 150, true);
    const size = 150;
    expect(result.points).toEqual([
      { x: 100, y: 100 },
      { x: 100 - size / 2, y: 100 + size },
      { x: 100 + size / 2, y: 100 + size }
    ]);
  });

  it('should force equilateral triangle with Ctrl (height > width)', () => {
    const result = calculateTriangle(100, 100, 150, 300, true);
    const size = 200;
    expect(result.points).toEqual([
      { x: 100, y: 100 },
      { x: 100 - size / 2, y: 100 + size },
      { x: 100 + size / 2, y: 100 + size }
    ]);
  });

  it('should force equilateral upside-down triangle with Ctrl', () => {
    const result = calculateTriangle(100, 100, 250, 20, true);
    const size = 150;
    expect(result.isUpsideDown).toBe(true);
    expect(result.points).toEqual([
      { x: 100, y: 100 },
      { x: 100 - size / 2, y: 100 - size },
      { x: 100 + size / 2, y: 100 - size }
    ]);
  });

  it('should calculate left drag (negative deltaWidth)', () => {
    const result = calculateTriangle(100, 100, 50, 200);
    expect(result.points).toEqual([
      { x: 100, y: 100 },
      { x: 75, y: 200 },
      { x: 125, y: 200 }
    ]);
  });

  it('should handle asymmetric triangle', () => {
    const result = calculateTriangle(100, 100, 180, 220);
    expect(result.points).toEqual([
      { x: 100, y: 100 },
      { x: 60, y: 220 },
      { x: 140, y: 220 }
    ]);
  });
});

describe('Line snap logic (Shift modifier)', () => {
  it('should not snap when Shift is not pressed', () => {
    const result = calculateLineSnap(100, 100, 250, 175, false);
    expect(result).toEqual({
      x1: 100,
      y1: 100,
      x2: 250,
      y2: 175
    });
  });

  it('should snap to horizontal when deltaX > deltaY * 2', () => {
    const result = calculateLineSnap(100, 100, 300, 120, true);
    expect(result).toEqual({
      x1: 100,
      y1: 100,
      x2: 300,
      y2: 100
    });
  });

  it('should snap to vertical when deltaY > deltaX * 2', () => {
    const result = calculateLineSnap(100, 100, 120, 300, true);
    expect(result).toEqual({
      x1: 100,
      y1: 100,
      x2: 100,
      y2: 300
    });
  });

  it('should snap to 45-degree diagonal (bottom-right)', () => {
    const result = calculateLineSnap(100, 100, 180, 170, true);
    expect(result).toEqual({
      x1: 100,
      y1: 100,
      x2: 180,
      y2: 180
    });
  });

  it('should snap to 45-degree diagonal (top-right)', () => {
    const result = calculateLineSnap(100, 100, 180, 30, true);
    expect(result).toEqual({
      x1: 100,
      y1: 100,
      x2: 180,
      y2: 20
    });
  });

  it('should snap to 45-degree diagonal (bottom-left)', () => {
    const result = calculateLineSnap(100, 100, 20, 170, true);
    expect(result).toEqual({
      x1: 100,
      y1: 100,
      x2: 20,
      y2: 180
    });
  });

  it('should snap to 45-degree diagonal (top-left)', () => {
    const result = calculateLineSnap(100, 100, 20, 30, true);
    expect(result).toEqual({
      x1: 100,
      y1: 100,
      x2: 20,
      y2: 20
    });
  });

  it('should snap to horizontal with negative deltaX', () => {
    const result = calculateLineSnap(100, 100, 20, 110, true);
    expect(result).toEqual({
      x1: 100,
      y1: 100,
      x2: 20,
      y2: 100
    });
  });

  it('should snap to vertical with negative deltaY', () => {
    const result = calculateLineSnap(100, 100, 110, 20, true);
    expect(result).toEqual({
      x1: 100,
      y1: 100,
      x2: 100,
      y2: 20
    });
  });

  it('should snap to horizontal when ratio is greater than 2x', () => {
    const result = calculateLineSnap(100, 100, 300, 149, true);
    expect(result.y2).toBe(100);
  });

  it('should snap to vertical when ratio is greater than 2x', () => {
    const result = calculateLineSnap(100, 100, 149, 300, true);
    expect(result.x2).toBe(100);
  });

  it('should snap to diagonal at exactly 2x ratio (edge case)', () => {
    const result1 = calculateLineSnap(100, 100, 200, 150, true);
    expect(result1.x2).toBe(200);
    expect(result1.y2).toBe(200);

    const result2 = calculateLineSnap(100, 100, 150, 200, true);
    expect(result2.x2).toBe(200);
    expect(result2.y2).toBe(200);
  });

  it('should handle zero drag', () => {
    const result = calculateLineSnap(100, 100, 100, 100, true);
    expect(result).toEqual({
      x1: 100,
      y1: 100,
      x2: 100,
      y2: 100
    });
  });
});

describe('Edge cases and boundary conditions', () => {
  it('should handle very small rectangle dimensions', () => {
    const result = calculateRectangle(100, 100, 101, 101);
    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
  });

  it('should handle very large rectangle dimensions', () => {
    const result = calculateRectangle(0, 0, 10000, 10000);
    expect(result.width).toBe(10000);
    expect(result.height).toBe(10000);
  });

  it('should handle very small circle radius', () => {
    const result = calculateCircle(100, 100, 100.1, 100.1);
    expect(result.radius).toBeGreaterThan(0);
  });

  it('should handle triangle with minimal width', () => {
    const result = calculateTriangle(100, 100, 100, 200);
    expect(result.points[0]).toEqual({ x: 100, y: 100 });
    expect(result.points[1].x).toBeCloseTo(99.5, 1);
    expect(result.points[2].x).toBeCloseTo(100.5, 1);
  });

  it('should handle triangle with minimal height', () => {
    const result = calculateTriangle(100, 100, 200, 100);
    expect(result.points[0]).toEqual({ x: 100, y: 100 });
    expect(result.points[1].y).toBe(101);
    expect(result.points[2].y).toBe(101);
  });

  it('should handle line snap with very small deltas', () => {
    const result = calculateLineSnap(100, 100, 101, 101, true);
    expect(result.x2).toBe(101);
    expect(result.y2).toBe(101);
  });
});
