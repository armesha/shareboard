import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getWorkspaceId,
  generateUserId,
  shallowEqual,
  debounce,
  constrainObjectToBounds,
  createNotificationManager,
  getPersistentUserId,
  getAccessToken,
  setAccessToken,
  removeAccessToken
} from '../../client/src/utils';
import { STORAGE_KEYS } from '../../client/src/constants';

describe('getWorkspaceId', () => {
  let originalPathname;

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
    await new Promise(resolve => setTimeout(resolve, 2));
    const userId2 = generateUserId();

    const timestamp1 = parseInt(userId1.split('-')[1]);
    const timestamp2 = parseInt(userId2.split('-')[1]);

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

describe('shallowEqual', () => {
  it('returns true for equal objects with same values', () => {
    const obj1 = { a: 1, b: 2, c: 3 };
    const obj2 = { a: 1, b: 2, c: 3 };
    expect(shallowEqual(obj1, obj2)).toBe(true);
  });

  it('returns false for objects with different values', () => {
    const obj1 = { a: 1, b: 2 };
    const obj2 = { a: 1, b: 3 };
    expect(shallowEqual(obj1, obj2)).toBe(false);
  });

  it('returns false for objects with different keys', () => {
    const obj1 = { a: 1, b: 2 };
    const obj2 = { a: 1, c: 2 };
    expect(shallowEqual(obj1, obj2)).toBe(false);
  });

  it('returns false when one object has more keys', () => {
    const obj1 = { a: 1, b: 2 };
    const obj2 = { a: 1, b: 2, c: 3 };
    expect(shallowEqual(obj1, obj2)).toBe(false);
  });

  it('handles empty objects', () => {
    expect(shallowEqual({}, {})).toBe(true);
  });

  it('returns false when comparing empty and non-empty objects', () => {
    expect(shallowEqual({}, { a: 1 })).toBe(false);
  });

  it('only compares first level (shallow comparison)', () => {
    const nested1 = { x: 1 };
    const nested2 = { x: 1 };
    const obj1 = { a: nested1 };
    const obj2 = { a: nested2 };
    expect(shallowEqual(obj1, obj2)).toBe(false);
  });

  it('returns true when nested objects are same reference', () => {
    const nested = { x: 1 };
    const obj1 = { a: nested };
    const obj2 = { a: nested };
    expect(shallowEqual(obj1, obj2)).toBe(true);
  });

  it('handles null values', () => {
    const obj1 = { a: null };
    const obj2 = { a: null };
    expect(shallowEqual(obj1, obj2)).toBe(true);
  });

  it('handles undefined values', () => {
    const obj1 = { a: undefined };
    const obj2 = { a: undefined };
    expect(shallowEqual(obj1, obj2)).toBe(true);
  });

  it('handles mixed value types', () => {
    const obj1 = { a: 1, b: 'test', c: true, d: null };
    const obj2 = { a: 1, b: 'test', c: true, d: null };
    expect(shallowEqual(obj1, obj2)).toBe(true);
  });
});

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('delays function execution', () => {
    const func = vi.fn();
    const debouncedFunc = debounce(func, 100);

    debouncedFunc();
    expect(func).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(func).toHaveBeenCalledTimes(1);
  });

  it('only calls once after rapid calls', () => {
    const func = vi.fn();
    const debouncedFunc = debounce(func, 100);

    debouncedFunc();
    debouncedFunc();
    debouncedFunc();
    debouncedFunc();

    expect(func).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(func).toHaveBeenCalledTimes(1);
  });

  it('passes arguments correctly', () => {
    const func = vi.fn();
    const debouncedFunc = debounce(func, 100);

    debouncedFunc('arg1', 'arg2', 123);
    vi.advanceTimersByTime(100);

    expect(func).toHaveBeenCalledWith('arg1', 'arg2', 123);
  });

  it('resets timer on subsequent calls', () => {
    const func = vi.fn();
    const debouncedFunc = debounce(func, 100);

    debouncedFunc();
    vi.advanceTimersByTime(50);
    debouncedFunc();
    vi.advanceTimersByTime(50);

    expect(func).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(func).toHaveBeenCalledTimes(1);
  });

  it('uses latest arguments when called multiple times', () => {
    const func = vi.fn();
    const debouncedFunc = debounce(func, 100);

    debouncedFunc('first');
    debouncedFunc('second');
    debouncedFunc('third');

    vi.advanceTimersByTime(100);

    expect(func).toHaveBeenCalledTimes(1);
    expect(func).toHaveBeenCalledWith('third');
  });

  it('handles different wait times', () => {
    const func = vi.fn();
    const debouncedFunc = debounce(func, 500);

    debouncedFunc();
    vi.advanceTimersByTime(400);
    expect(func).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(func).toHaveBeenCalledTimes(1);
  });
});

describe('constrainObjectToBounds', () => {
  let mockObj;
  let mockCanvas;

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
        br: { x: 800, y: 600 }
      }))
    };
  });

  it('keeps object within canvas bounds when already inside', () => {
    const result = constrainObjectToBounds(mockObj, mockCanvas);
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

    const result = constrainObjectToBounds(mockObj, mockCanvas);
    expect(result).toBe(true);
    expect(mockObj.left).toBe(115);
    expect(mockObj.setCoords).toHaveBeenCalled();
  });

  it('adjusts left when exceeds right edge', () => {
    mockObj.getBoundingRect.mockReturnValue({
      left: 760,
      top: 100,
      width: 50,
      height: 50
    });

    const result = constrainObjectToBounds(mockObj, mockCanvas);
    expect(result).toBe(true);
    expect(mockObj.left).toBe(70);
    expect(mockObj.setCoords).toHaveBeenCalled();
  });

  it('adjusts top when exceeds top edge', () => {
    mockObj.getBoundingRect.mockReturnValue({
      left: 100,
      top: 5,
      width: 50,
      height: 50
    });

    const result = constrainObjectToBounds(mockObj, mockCanvas);
    expect(result).toBe(true);
    expect(mockObj.top).toBe(115);
    expect(mockObj.setCoords).toHaveBeenCalled();
  });

  it('adjusts top when exceeds bottom edge', () => {
    mockObj.getBoundingRect.mockReturnValue({
      left: 100,
      top: 560,
      width: 50,
      height: 50
    });

    const result = constrainObjectToBounds(mockObj, mockCanvas);
    expect(result).toBe(true);
    expect(mockObj.top).toBe(70);
    expect(mockObj.setCoords).toHaveBeenCalled();
  });

  it('uses default buffer of 20', () => {
    mockObj.getBoundingRect.mockReturnValue({
      left: 10,
      top: 100,
      width: 50,
      height: 50
    });

    const result = constrainObjectToBounds(mockObj, mockCanvas);
    expect(result).toBe(true);
    expect(mockObj.left).toBe(110);
  });

  it('uses custom buffer when provided', () => {
    mockObj.getBoundingRect.mockReturnValue({
      left: 10,
      top: 100,
      width: 50,
      height: 50
    });

    const result = constrainObjectToBounds(mockObj, mockCanvas, 30);
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

    const result = constrainObjectToBounds(mockObj, mockCanvas);
    expect(result).toBe(true);
    expect(mockObj.left).toBe(115);
    expect(mockObj.top).toBe(115);
    expect(mockObj.setCoords).toHaveBeenCalled();
  });

  it('handles objects at exact boundary with buffer', () => {
    mockObj.getBoundingRect.mockReturnValue({
      left: 20,
      top: 20,
      width: 50,
      height: 50
    });

    const result = constrainObjectToBounds(mockObj, mockCanvas);
    expect(result).toBe(false);
  });
});

describe('createNotificationManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates manager with show/subscribe/getNotifications methods', () => {
    const manager = createNotificationManager();
    expect(manager.show).toBeDefined();
    expect(manager.subscribe).toBeDefined();
    expect(manager.getNotifications).toBeDefined();
  });

  it('show() adds notification', () => {
    const manager = createNotificationManager();
    manager.show('Test message', 'info');

    const notifications = manager.getNotifications();
    expect(notifications).toHaveLength(1);
    expect(notifications[0].message).toBe('Test message');
    expect(notifications[0].type).toBe('info');
  });

  it('show() returns notification ID', () => {
    const manager = createNotificationManager();
    const id = manager.show('Test message');

    expect(typeof id).toBe('number');
    expect(id).toBeGreaterThan(0);
  });

  it('subscribe() receives updates when notification is added', () => {
    const manager = createNotificationManager();
    const listener = vi.fn();

    manager.subscribe(listener);
    manager.show('Test message');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          message: 'Test message',
          type: 'info'
        })
      ])
    );
  });

  it('multiple subscribers receive updates', () => {
    const manager = createNotificationManager();
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    manager.subscribe(listener1);
    manager.subscribe(listener2);
    manager.show('Test message');

    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(1);
  });

  it('notifications auto-remove after default timeout', () => {
    const manager = createNotificationManager();
    const listener = vi.fn();

    manager.subscribe(listener);
    manager.show('Test message');

    expect(manager.getNotifications()).toHaveLength(1);

    vi.advanceTimersByTime(3000);

    expect(manager.getNotifications()).toHaveLength(0);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('notifications auto-remove after custom timeout', () => {
    const manager = createNotificationManager();
    manager.show('Test message', 'info', 5000);

    expect(manager.getNotifications()).toHaveLength(1);

    vi.advanceTimersByTime(4000);
    expect(manager.getNotifications()).toHaveLength(1);

    vi.advanceTimersByTime(1000);
    expect(manager.getNotifications()).toHaveLength(0);
  });

  it('unsubscribe function removes listener', () => {
    const manager = createNotificationManager();
    const listener = vi.fn();

    const unsubscribe = manager.subscribe(listener);
    manager.show('Message 1');

    unsubscribe();
    manager.show('Message 2');

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('handles multiple notifications with different IDs', () => {
    const manager = createNotificationManager();
    const id1 = manager.show('Message 1');
    vi.advanceTimersByTime(1);
    const id2 = manager.show('Message 2');
    vi.advanceTimersByTime(1);
    const id3 = manager.show('Message 3');

    expect(id1).not.toBe(id2);
    expect(id2).not.toBe(id3);
    expect(manager.getNotifications()).toHaveLength(3);
  });

  it('removes only expired notifications', () => {
    const manager = createNotificationManager();

    manager.show('Message 1', 'info', 2000);
    vi.advanceTimersByTime(1000);
    manager.show('Message 2', 'info', 2000);

    vi.advanceTimersByTime(1000);

    expect(manager.getNotifications()).toHaveLength(1);
    expect(manager.getNotifications()[0].message).toBe('Message 2');
  });

  it('listener receives updates on notification removal', () => {
    const manager = createNotificationManager();
    const listener = vi.fn();

    manager.subscribe(listener);
    manager.show('Test message', 'info', 1000);

    expect(listener).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1000);

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenLastCalledWith([]);
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
