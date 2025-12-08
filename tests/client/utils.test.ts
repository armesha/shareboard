import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import {
  getWorkspaceId,
  generateUserId,
  constrainObjectToBounds,
  getPersistentUserId,
  getAccessToken,
  setAccessToken,
  removeAccessToken,
  type ConstrainableObject,
  type ConstrainableCanvas
} from '../../client/src/utils';
import { STORAGE_KEYS } from '../../client/src/constants';

// Types for mock objects based on the utils/index.ts types
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
  let originalPathname: string;

  beforeEach(() => {
    originalPathname = global.window.location.pathname;
  });

  afterEach(() => {
    global.window.location.pathname = originalPathname;
  });

  it('extracts workspace ID from URL path /w/abc123', () => {
    global.window.location.pathname = '/w/abc123';
    expect(getWorkspaceId()).toBe('abc123');
  });

  it('extracts workspace ID with longer alphanumeric ID', () => {
    global.window.location.pathname = '/w/xyz789def456';
    expect(getWorkspaceId()).toBe('xyz789def456');
  });

  it('returns null for invalid path with no workspace ID', () => {
    global.window.location.pathname = '/w/';
    expect(getWorkspaceId()).toBeNull();
  });

  it('returns null for root path', () => {
    global.window.location.pathname = '/';
    expect(getWorkspaceId()).toBeNull();
  });

  it('extracts third segment from any path structure', () => {
    global.window.location.pathname = '/other/abc123';
    expect(getWorkspaceId()).toBe('abc123');
  });

  it('returns null for empty pathname', () => {
    global.window.location.pathname = '';
    expect(getWorkspaceId()).toBeNull();
  });

  it('handles path with trailing slashes', () => {
    global.window.location.pathname = '/w/abc123/';
    expect(getWorkspaceId()).toBe('abc123');
  });
});

describe('generateUserId', () => {
  it('returns string in format user-{timestamp}-{random}', () => {
    const userId = generateUserId();
    expect(userId).toMatch(/^user-\d+-[a-z0-9]{6}$/);
  });

  it('each call returns unique value', () => {
    const userId1 = generateUserId();
    const userId2 = generateUserId();
    expect(userId1).not.toBe(userId2);
  });

  it('generates IDs with increasing timestamps', async () => {
    const userId1 = generateUserId();
    await new Promise<void>(resolve => setTimeout(resolve, 2));
    const userId2 = generateUserId();

    const timestamp1 = parseInt(userId1.split('-')[1] ?? '0', 10);
    const timestamp2 = parseInt(userId2.split('-')[1] ?? '0', 10);

    expect(timestamp2).toBeGreaterThanOrEqual(timestamp1);
  });

  it('random part is always 6 characters', () => {
    for (let i = 0; i < 10; i++) {
      const userId = generateUserId();
      const randomPart = userId.split('-')[2];
      expect(randomPart).toHaveLength(6);
    }
  });
});

describe('constrainObjectToBounds', () => {
  let mockObj: MockConstrainableObject;
  let mockCanvas: MockConstrainableCanvas;

  beforeEach(() => {
    mockObj = {
      left: 100,
      top: 100,
      getBoundingRect: vi.fn(() => ({
        left: 100,
        top: 100,
        width: 50,
        height: 50
      })),
      setCoords: vi.fn()
    };

    mockCanvas = {
      calcViewportBoundaries: vi.fn(() => ({
        tl: { x: 0, y: 0 },
        tr: { x: 800, y: 0 },
        bl: { x: 0, y: 600 },
        br: { x: 800, y: 600 }
      }))
    };
  });

  it('keeps object within canvas bounds when already inside', () => {
    const result = constrainObjectToBounds(mockObj as unknown as ConstrainableObject, mockCanvas as unknown as ConstrainableCanvas);
    expect(result).toBe(false);
    expect(mockObj.setCoords).not.toHaveBeenCalled();
  });

  it('adjusts left when exceeds left edge', () => {
    mockObj.getBoundingRect.mockReturnValue({
      left: 5,
      top: 100,
      width: 50,
      height: 50
    });

    const result = constrainObjectToBounds(mockObj as unknown as ConstrainableObject, mockCanvas as unknown as ConstrainableCanvas);
    expect(result).toBe(true);
    expect(mockObj.left).toBe(135);
    expect(mockObj.setCoords).toHaveBeenCalled();
  });

  it('adjusts left when exceeds right edge', () => {
    mockObj.getBoundingRect.mockReturnValue({
      left: 760,
      top: 100,
      width: 50,
      height: 50
    });

    const result = constrainObjectToBounds(mockObj as unknown as ConstrainableObject, mockCanvas as unknown as ConstrainableCanvas);
    expect(result).toBe(true);
    expect(mockObj.left).toBe(50);
    expect(mockObj.setCoords).toHaveBeenCalled();
  });

  it('adjusts top when exceeds top edge', () => {
    mockObj.getBoundingRect.mockReturnValue({
      left: 100,
      top: 5,
      width: 50,
      height: 50
    });

    const result = constrainObjectToBounds(mockObj as unknown as ConstrainableObject, mockCanvas as unknown as ConstrainableCanvas);
    expect(result).toBe(true);
    expect(mockObj.top).toBe(135);
    expect(mockObj.setCoords).toHaveBeenCalled();
  });

  it('adjusts top when exceeds bottom edge', () => {
    mockObj.getBoundingRect.mockReturnValue({
      left: 100,
      top: 560,
      width: 50,
      height: 50
    });

    const result = constrainObjectToBounds(mockObj as unknown as ConstrainableObject, mockCanvas as unknown as ConstrainableCanvas);
    expect(result).toBe(true);
    expect(mockObj.top).toBe(50);
    expect(mockObj.setCoords).toHaveBeenCalled();
  });

  it('uses default buffer of 40', () => {
    mockObj.getBoundingRect.mockReturnValue({
      left: 10,
      top: 100,
      width: 50,
      height: 50
    });

    const result = constrainObjectToBounds(mockObj as unknown as ConstrainableObject, mockCanvas as unknown as ConstrainableCanvas);
    expect(result).toBe(true);
    expect(mockObj.left).toBe(130);
  });

  it('uses custom buffer when provided', () => {
    mockObj.getBoundingRect.mockReturnValue({
      left: 10,
      top: 100,
      width: 50,
      height: 50
    });

    const result = constrainObjectToBounds(mockObj as unknown as ConstrainableObject, mockCanvas as unknown as ConstrainableCanvas, 30);
    expect(result).toBe(true);
    expect(mockObj.left).toBe(120);
  });

  it('adjusts both left and top when exceeds multiple edges', () => {
    mockObj.getBoundingRect.mockReturnValue({
      left: 5,
      top: 5,
      width: 50,
      height: 50
    });

    const result = constrainObjectToBounds(mockObj as unknown as ConstrainableObject, mockCanvas as unknown as ConstrainableCanvas);
    expect(result).toBe(true);
    expect(mockObj.left).toBe(135);
    expect(mockObj.top).toBe(135);
    expect(mockObj.setCoords).toHaveBeenCalled();
  });

  it('handles objects at exact boundary with buffer', () => {
    mockObj.getBoundingRect.mockReturnValue({
      left: 40,
      top: 40,
      width: 50,
      height: 50
    });

    const result = constrainObjectToBounds(mockObj as unknown as ConstrainableObject, mockCanvas as unknown as ConstrainableCanvas);
    expect(result).toBe(false);
  });
});

describe('getPersistentUserId', () => {
  beforeEach(() => {
    global.localStorage.clear();
  });

  it('returns existing userId from localStorage', () => {
    global.localStorage.setItem(STORAGE_KEYS.USER_ID, 'existing-user-123');
    const userId = getPersistentUserId();
    expect(userId).toBe('existing-user-123');
  });

  it('generates and stores new userId if none exists', () => {
    const userId = getPersistentUserId();
    expect(userId).toMatch(/^user-\d+-[a-z0-9]{6}$/);
    expect(global.localStorage.getItem(STORAGE_KEYS.USER_ID)).toBe(userId);
  });

  it('returns same userId on subsequent calls', () => {
    const userId1 = getPersistentUserId();
    const userId2 = getPersistentUserId();
    expect(userId1).toBe(userId2);
  });
});

describe('getAccessToken', () => {
  beforeEach(() => {
    global.localStorage.clear();
  });

  it('returns access token for workspace', () => {
    global.localStorage.setItem(STORAGE_KEYS.accessToken('workspace123'), 'token-abc');
    const token = getAccessToken('workspace123');
    expect(token).toBe('token-abc');
  });

  it('returns null if no token exists', () => {
    const token = getAccessToken('workspace123');
    expect(token).toBeNull();
  });

  it('returns different tokens for different workspaces', () => {
    global.localStorage.setItem(STORAGE_KEYS.accessToken('workspace1'), 'token1');
    global.localStorage.setItem(STORAGE_KEYS.accessToken('workspace2'), 'token2');

    expect(getAccessToken('workspace1')).toBe('token1');
    expect(getAccessToken('workspace2')).toBe('token2');
  });
});

describe('setAccessToken', () => {
  beforeEach(() => {
    global.localStorage.clear();
  });

  it('stores access token for workspace', () => {
    setAccessToken('workspace123', 'token-xyz');
    expect(global.localStorage.getItem(STORAGE_KEYS.accessToken('workspace123'))).toBe('token-xyz');
  });

  it('overwrites existing token', () => {
    setAccessToken('workspace123', 'old-token');
    setAccessToken('workspace123', 'new-token');
    expect(global.localStorage.getItem(STORAGE_KEYS.accessToken('workspace123'))).toBe('new-token');
  });
});

describe('removeAccessToken', () => {
  beforeEach(() => {
    global.localStorage.clear();
  });

  it('removes access token for workspace', () => {
    global.localStorage.setItem(STORAGE_KEYS.accessToken('workspace123'), 'token-abc');
    removeAccessToken('workspace123');
    expect(global.localStorage.getItem(STORAGE_KEYS.accessToken('workspace123'))).toBeNull();
  });

  it('does not affect other workspace tokens', () => {
    global.localStorage.setItem(STORAGE_KEYS.accessToken('workspace1'), 'token1');
    global.localStorage.setItem(STORAGE_KEYS.accessToken('workspace2'), 'token2');

    removeAccessToken('workspace1');

    expect(global.localStorage.getItem(STORAGE_KEYS.accessToken('workspace1'))).toBeNull();
    expect(global.localStorage.getItem(STORAGE_KEYS.accessToken('workspace2'))).toBe('token2');
  });
});
