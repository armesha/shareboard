import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import {
  getWorkspaceId,
  constrainObjectToBounds,
  getPersistentUserId,
  type ConstrainableObject,
  type ConstrainableCanvas
} from '../../client/src/utils';
import { STORAGE_KEYS } from '../../client/src/constants';

interface BoundingRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface ViewportBoundaries {
  tl: { x: number; y: number };
  tr: { x: number; y: number };
  bl: { x: number; y: number };
  br: { x: number; y: number };
}

interface MockConstrainableObject {
  left: number;
  top: number;
  getBoundingRect: Mock<() => BoundingRect>;
  setCoords: Mock<() => void>;
}

interface MockConstrainableCanvas {
  calcViewportBoundaries: Mock<() => ViewportBoundaries>;
}

describe('getWorkspaceId', () => {
  it('extracts workspace ID from URL path', () => {
    const original = global.window.location.pathname;

    global.window.location.pathname = '/w/abc123';
    expect(getWorkspaceId()).toBe('abc123');

    global.window.location.pathname = '/w/';
    expect(getWorkspaceId()).toBeNull();

    global.window.location.pathname = '/w/abc123/';
    expect(getWorkspaceId()).toBe('abc123');

    global.window.location.pathname = original;
  });
});

describe('constrainObjectToBounds', () => {
  it('constrains objects to canvas boundaries with buffer', () => {
    const mockObj: MockConstrainableObject = {
      left: 100, top: 100,
      getBoundingRect: vi.fn(() => ({ left: 100, top: 100, width: 50, height: 50 })),
      setCoords: vi.fn()
    };
    const mockCanvas: MockConstrainableCanvas = {
      calcViewportBoundaries: vi.fn(() => ({ tl: { x: 0, y: 0 }, tr: { x: 800, y: 0 }, bl: { x: 0, y: 600 }, br: { x: 800, y: 600 } }))
    };

    expect(constrainObjectToBounds(mockObj as unknown as ConstrainableObject, mockCanvas as unknown as ConstrainableCanvas)).toBe(false);

    mockObj.getBoundingRect.mockReturnValue({ left: 5, top: 5, width: 50, height: 50 });
    expect(constrainObjectToBounds(mockObj as unknown as ConstrainableObject, mockCanvas as unknown as ConstrainableCanvas)).toBe(true);
    expect(mockObj.left).toBe(135);
    expect(mockObj.top).toBe(135);

    mockObj.left = 100;
    mockObj.getBoundingRect.mockReturnValue({ left: 10, top: 100, width: 50, height: 50 });
    expect(constrainObjectToBounds(mockObj as unknown as ConstrainableObject, mockCanvas as unknown as ConstrainableCanvas, 30)).toBe(true);
    expect(mockObj.left).toBe(120);
  });
});

describe('localStorage helpers', () => {
  beforeEach(() => global.localStorage.clear());

  it('manages persistent user ID', () => {
    const userId = getPersistentUserId();
    expect(userId).toMatch(/^user-\d+-[a-z0-9]{6}$/);
    expect(getPersistentUserId()).toBe(userId);

    global.localStorage.setItem(STORAGE_KEYS.USER_ID, 'existing-123');
    expect(getPersistentUserId()).toBe('existing-123');
  });

});
