import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  generateKey,
  generateEditToken,
  createWorkspace,
  workspaceExists,
  getWorkspace,
  deleteWorkspace,
  updateLastActivity,
  addConnection,
  removeConnection,
  getActiveUserCount,
  setUserSession,
  getUserSession,
  removeUserSession,
  getWorkspaceUsers,
  cleanupInactiveWorkspaces,
  getWorkspaceState,
  findWorkspaceIdByRef,
  updateSharingMode
} from '../../server/services/workspaceService.js';
import { SHARING_MODES, config } from '../../server/config.js';

describe('workspaceService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('generateKey', () => {
    it('returns string of default length (12)', () => {
      const key = generateKey();
      expect(key).toBeDefined();
      expect(typeof key).toBe('string');
      expect(key.length).toBeLessThanOrEqual(12);
      expect(key.length).toBeGreaterThan(0);
    });

    it('returns string of custom length', () => {
      const key8 = generateKey(8);
      expect(key8.length).toBeLessThanOrEqual(8);
      expect(key8.length).toBeGreaterThan(0);

      const key12 = generateKey(12);
      expect(key12.length).toBeLessThanOrEqual(12);
      expect(key12.length).toBeGreaterThan(0);

      const key4 = generateKey(4);
      expect(key4.length).toBeLessThanOrEqual(4);
      expect(key4.length).toBeGreaterThan(0);
    });

    it('returns alphanumeric string without special characters', () => {
      const key = generateKey(20);
      expect(key).toMatch(/^[A-Za-z0-9]+$/);
    });

    it('generates different keys on subsequent calls', () => {
      const key1 = generateKey();
      const key2 = generateKey();
      expect(key1).not.toBe(key2);
    });
  });

  describe('generateEditToken', () => {
    it('returns string starting with "edit_"', () => {
      const token = generateEditToken();
      expect(token).toBeDefined();
      expect(token.startsWith('edit_')).toBe(true);
    });

    it('has correct format (edit_ + 16 hex chars)', () => {
      const token = generateEditToken();
      expect(token).toMatch(/^edit_[a-f0-9]{16}$/);
    });

    it('generates different tokens on subsequent calls', () => {
      const token1 = generateEditToken();
      const token2 = generateEditToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe('createWorkspace', () => {
    afterEach(() => {
      const workspace = getWorkspace('test-workspace');
      if (workspace) {
        deleteWorkspace('test-workspace');
      }
    });

    it('creates workspace with all required fields', () => {
      const workspaceId = 'test-workspace';
      const ownerId = 'owner-123';

      const workspace = createWorkspace(workspaceId, ownerId);

      expect(workspace).toBeDefined();
      expect(workspace.id).toBe(workspaceId);
      expect(workspace.owner).toBe(ownerId);
      expect(workspace.created).toBeDefined();
      expect(workspace.lastActivity).toBeDefined();
      expect(workspace.diagrams).toBeInstanceOf(Map);
      expect(workspace.drawingsMap).toBeInstanceOf(Map);
      expect(workspace.allDrawingsMap).toBeInstanceOf(Map);
      expect(workspace.drawingOrder).toEqual([]);
      expect(workspace.diagramContent).toBe('');
      expect(workspace.codeSnippets).toEqual({ language: 'javascript', content: '' });
      expect(workspace.sharingMode).toBe(SHARING_MODES.READ_WRITE_SELECTED);
      expect(workspace.allowedUsers).toEqual([]);
      expect(workspace.editToken).toMatch(/^edit_[a-f0-9]{16}$/);
    });

    it('sets owner correctly', () => {
      const workspace = createWorkspace('ws-1', 'owner-abc');
      expect(workspace.owner).toBe('owner-abc');
      deleteWorkspace('ws-1');
    });

    it('initializes empty Maps and arrays for drawings', () => {
      const workspace = createWorkspace('ws-2', 'owner-xyz');
      expect(workspace.drawingsMap).toBeInstanceOf(Map);
      expect(workspace.drawingsMap.size).toBe(0);
      expect(workspace.allDrawingsMap).toBeInstanceOf(Map);
      expect(workspace.allDrawingsMap.size).toBe(0);
      expect(Array.isArray(workspace.drawingOrder)).toBe(true);
      expect(workspace.drawingOrder.length).toBe(0);
      deleteWorkspace('ws-2');
    });

    it('sets created and lastActivity timestamps', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      const workspace = createWorkspace('ws-3', 'owner-1');
      expect(workspace.created).toBe(now);
      expect(workspace.lastActivity).toBe(now);
      deleteWorkspace('ws-3');
    });

    it('should generate unique editToken for each workspace', () => {
      const workspace1 = createWorkspace('ws-unique-1', 'owner-1');
      const workspace2 = createWorkspace('ws-unique-2', 'owner-2');
      const workspace3 = createWorkspace('ws-unique-3', 'owner-3');

      expect(workspace1.editToken).not.toBe(workspace2.editToken);
      expect(workspace1.editToken).not.toBe(workspace3.editToken);
      expect(workspace2.editToken).not.toBe(workspace3.editToken);

      deleteWorkspace('ws-unique-1');
      deleteWorkspace('ws-unique-2');
      deleteWorkspace('ws-unique-3');
    });
  });

  describe('workspaceExists', () => {
    afterEach(() => {
      const workspace = getWorkspace('test-exists');
      if (workspace) {
        deleteWorkspace('test-exists');
      }
    });

    it('returns true for existing workspace', () => {
      createWorkspace('test-exists', 'owner-1');
      expect(workspaceExists('test-exists')).toBe(true);
    });

    it('returns false for non-existing workspace', () => {
      expect(workspaceExists('does-not-exist')).toBe(false);
    });

    it('returns false after workspace deletion', () => {
      createWorkspace('test-exists', 'owner-1');
      expect(workspaceExists('test-exists')).toBe(true);
      deleteWorkspace('test-exists');
      expect(workspaceExists('test-exists')).toBe(false);
    });
  });

  describe('getWorkspace', () => {
    afterEach(() => {
      const workspace = getWorkspace('test-get');
      if (workspace) {
        deleteWorkspace('test-get');
      }
    });

    it('returns workspace object for existing workspace', () => {
      const created = createWorkspace('test-get', 'owner-1');
      const retrieved = getWorkspace('test-get');
      expect(retrieved).toBeDefined();
      expect(retrieved).toBe(created);
      expect(retrieved.id).toBe('test-get');
    });

    it('returns undefined for non-existing workspace', () => {
      const workspace = getWorkspace('non-existing');
      expect(workspace).toBeUndefined();
    });
  });

  describe('deleteWorkspace', () => {
    afterEach(() => {
      removeUserSession('socket-1');
    });

    it('removes workspace and connections', () => {
      createWorkspace('test-delete', 'owner-1');
      addConnection('test-delete', 'socket-1');
      setUserSession('socket-1', { userId: 'user-1', workspaceId: 'test-delete' });

      expect(workspaceExists('test-delete')).toBe(true);
      expect(getActiveUserCount('test-delete')).toBe(1);

      deleteWorkspace('test-delete');

      expect(workspaceExists('test-delete')).toBe(false);
      expect(getActiveUserCount('test-delete')).toBe(0);
    });
  });

  describe('updateLastActivity', () => {
    afterEach(() => {
      const workspace = getWorkspace('test-activity');
      if (workspace) {
        deleteWorkspace('test-activity');
      }
    });

    it('updates lastActivity timestamp', () => {
      const initialTime = 1000000;
      vi.setSystemTime(initialTime);

      createWorkspace('test-activity', 'owner-1');
      const workspace = getWorkspace('test-activity');
      expect(workspace.lastActivity).toBe(initialTime);

      const newTime = 2000000;
      vi.setSystemTime(newTime);
      updateLastActivity('test-activity');

      expect(workspace.lastActivity).toBe(newTime);
    });

    it('does nothing for non-existing workspace', () => {
      expect(() => updateLastActivity('non-existing')).not.toThrow();
    });
  });

  describe('Connection management', () => {
    afterEach(() => {
      const workspace = getWorkspace('test-conn');
      if (workspace) {
        deleteWorkspace('test-conn');
      }
    });

    describe('addConnection', () => {
      it('adds connection and returns count', () => {
        createWorkspace('test-conn', 'owner-1');

        const count1 = addConnection('test-conn', 'socket-1');
        expect(count1).toBe(1);

        const count2 = addConnection('test-conn', 'socket-2');
        expect(count2).toBe(2);

        const count3 = addConnection('test-conn', 'socket-3');
        expect(count3).toBe(3);
      });

      it('does not add duplicate socket IDs', () => {
        createWorkspace('test-conn', 'owner-1');

        addConnection('test-conn', 'socket-1');
        const count = addConnection('test-conn', 'socket-1');
        expect(count).toBe(1);
      });

      it('works for workspace without prior connections', () => {
        createWorkspace('test-conn', 'owner-1');
        const count = addConnection('test-conn', 'socket-first');
        expect(count).toBe(1);
      });
    });

    describe('removeConnection', () => {
      it('removes connection and returns remaining count', () => {
        createWorkspace('test-conn', 'owner-1');
        addConnection('test-conn', 'socket-1');
        addConnection('test-conn', 'socket-2');
        addConnection('test-conn', 'socket-3');

        const count1 = removeConnection('test-conn', 'socket-2');
        expect(count1).toBe(2);

        const count2 = removeConnection('test-conn', 'socket-1');
        expect(count2).toBe(1);

        const count3 = removeConnection('test-conn', 'socket-3');
        expect(count3).toBe(0);
      });

      it('returns 0 for non-existing workspace', () => {
        const count = removeConnection('non-existing', 'socket-1');
        expect(count).toBe(0);
      });

      it('returns count for removing non-existing socket', () => {
        createWorkspace('test-conn', 'owner-1');
        addConnection('test-conn', 'socket-1');

        const count = removeConnection('test-conn', 'socket-999');
        expect(count).toBe(1);
      });
    });

    describe('getActiveUserCount', () => {
      afterEach(() => {
        removeUserSession('socket-1');
        removeUserSession('socket-2');
      });

      it('returns correct count of active users', () => {
        createWorkspace('test-conn', 'owner-1');

        expect(getActiveUserCount('test-conn')).toBe(0);

        addConnection('test-conn', 'socket-1');
        setUserSession('socket-1', { userId: 'user-1', workspaceId: 'test-conn' });
        expect(getActiveUserCount('test-conn')).toBe(1);

        addConnection('test-conn', 'socket-2');
        setUserSession('socket-2', { userId: 'user-2', workspaceId: 'test-conn' });
        expect(getActiveUserCount('test-conn')).toBe(2);

        removeConnection('test-conn', 'socket-1');
        expect(getActiveUserCount('test-conn')).toBe(1);
      });

      it('returns 0 for non-existing workspace', () => {
        expect(getActiveUserCount('non-existing')).toBe(0);
      });
    });
  });

  describe('User session management', () => {
    afterEach(() => {
      removeUserSession('socket-1');
      removeUserSession('socket-2');
    });

    describe('setUserSession', () => {
      it('stores user session information', () => {
        const userInfo = { userId: 'user-1', workspaceId: 'ws-1' };
        setUserSession('socket-1', userInfo);

        const retrieved = getUserSession('socket-1');
        expect(retrieved).toEqual(userInfo);
      });

      it('overwrites existing session', () => {
        const userInfo1 = { userId: 'user-1', workspaceId: 'ws-1' };
        const userInfo2 = { userId: 'user-2', workspaceId: 'ws-2' };

        setUserSession('socket-1', userInfo1);
        setUserSession('socket-1', userInfo2);

        const retrieved = getUserSession('socket-1');
        expect(retrieved).toEqual(userInfo2);
      });
    });

    describe('getUserSession', () => {
      it('retrieves stored user session', () => {
        const userInfo = { userId: 'user-1', workspaceId: 'ws-1' };
        setUserSession('socket-1', userInfo);

        const retrieved = getUserSession('socket-1');
        expect(retrieved).toBeDefined();
        expect(retrieved.userId).toBe('user-1');
        expect(retrieved.workspaceId).toBe('ws-1');
      });

      it('returns undefined for non-existing session', () => {
        const session = getUserSession('non-existing-socket');
        expect(session).toBeUndefined();
      });
    });

    describe('removeUserSession', () => {
      it('removes user session', () => {
        const userInfo = { userId: 'user-1', workspaceId: 'ws-1' };
        setUserSession('socket-1', userInfo);

        expect(getUserSession('socket-1')).toBeDefined();

        removeUserSession('socket-1');

        expect(getUserSession('socket-1')).toBeUndefined();
      });

      it('does nothing for non-existing session', () => {
        expect(() => removeUserSession('non-existing')).not.toThrow();
      });
    });
  });

  describe('getWorkspaceUsers', () => {
    afterEach(() => {
      deleteWorkspace('test-users');
      removeUserSession('socket-1');
      removeUserSession('socket-2');
      removeUserSession('socket-3');
    });

    it('returns list of active users with owner flag', () => {
      createWorkspace('test-users', 'owner-123');

      setUserSession('socket-1', { userId: 'owner-123', workspaceId: 'test-users' });
      setUserSession('socket-2', { userId: 'user-456', workspaceId: 'test-users' });
      setUserSession('socket-3', { userId: 'user-789', workspaceId: 'test-users' });

      addConnection('test-users', 'socket-1');
      addConnection('test-users', 'socket-2');
      addConnection('test-users', 'socket-3');

      const users = getWorkspaceUsers('test-users');

      expect(users).toHaveLength(3);
      expect(users[0]).toEqual({ id: 'owner-123', online: true, isOwner: true });
      expect(users[1]).toEqual({ id: 'user-456', online: true, isOwner: false });
      expect(users[2]).toEqual({ id: 'user-789', online: true, isOwner: false });
    });

    it('returns empty array for non-existing workspace', () => {
      const users = getWorkspaceUsers('non-existing');
      expect(users).toEqual([]);
    });

    it('returns empty array for workspace with no connections', () => {
      createWorkspace('test-users', 'owner-1');
      const users = getWorkspaceUsers('test-users');
      expect(users).toEqual([]);
    });

    it('excludes connections without user sessions', () => {
      createWorkspace('test-users', 'owner-1');

      setUserSession('socket-1', { userId: 'user-1', workspaceId: 'test-users' });
      addConnection('test-users', 'socket-1');
      addConnection('test-users', 'socket-2');

      const users = getWorkspaceUsers('test-users');
      expect(users).toHaveLength(1);
      expect(users[0].id).toBe('user-1');
    });
  });

  describe('cleanupInactiveWorkspaces', () => {
    afterEach(() => {
      deleteWorkspace('active-ws');
      deleteWorkspace('inactive-ws-1');
      deleteWorkspace('inactive-ws-2');
    });

    it('removes workspaces with 0 connections older than threshold', () => {
      const now = Date.now();
      const threshold = config.cleanup.inactiveThresholdMs;

      vi.setSystemTime(now - threshold - 1000);
      createWorkspace('inactive-ws-1', 'owner-1');
      createWorkspace('inactive-ws-2', 'owner-2');

      vi.setSystemTime(now);
      createWorkspace('active-ws', 'owner-3');
      addConnection('active-ws', 'socket-1');

      expect(workspaceExists('inactive-ws-1')).toBe(true);
      expect(workspaceExists('inactive-ws-2')).toBe(true);
      expect(workspaceExists('active-ws')).toBe(true);

      cleanupInactiveWorkspaces();

      expect(workspaceExists('inactive-ws-1')).toBe(false);
      expect(workspaceExists('inactive-ws-2')).toBe(false);
      expect(workspaceExists('active-ws')).toBe(true);
    });

    it('keeps workspaces with active connections regardless of age', () => {
      const now = Date.now();
      const threshold = config.cleanup.inactiveThresholdMs;

      vi.setSystemTime(now - threshold - 1000);
      createWorkspace('old-but-active', 'owner-1');
      addConnection('old-but-active', 'socket-1');

      vi.setSystemTime(now);
      cleanupInactiveWorkspaces();

      expect(workspaceExists('old-but-active')).toBe(true);
      deleteWorkspace('old-but-active');
    });

    it('keeps inactive workspaces younger than threshold', () => {
      const now = Date.now();
      const threshold = config.cleanup.inactiveThresholdMs;

      vi.setSystemTime(now - threshold + 1000);
      createWorkspace('recent-ws', 'owner-1');

      vi.setSystemTime(now);
      cleanupInactiveWorkspaces();

      expect(workspaceExists('recent-ws')).toBe(true);
      deleteWorkspace('recent-ws');
    });
  });

  describe('getWorkspaceState', () => {
    afterEach(() => {
      deleteWorkspace('test-state');
      removeUserSession('socket-1');
      removeUserSession('socket-2');
    });

    it('returns complete workspace state', () => {
      createWorkspace('test-state', 'owner-1');
      const workspace = getWorkspace('test-state');

      workspace.drawingsMap.set('rect-1', { type: 'rect', x: 10, y: 20 });
      workspace.allDrawingsMap.set('circle-1', { type: 'circle', x: 30, y: 40 });
      workspace.codeSnippets = { language: 'python', content: 'print("hello")' };
      workspace.diagramContent = 'graph TD; A-->B';
      workspace.diagrams.set('diagram-1', { id: 'diagram-1', content: 'test' });

      addConnection('test-state', 'socket-1');
      setUserSession('socket-1', { userId: 'user-1', workspaceId: 'test-state' });
      addConnection('test-state', 'socket-2');
      setUserSession('socket-2', { userId: 'user-2', workspaceId: 'test-state' });

      const state = getWorkspaceState('test-state');

      expect(state).toBeDefined();
      expect(state.whiteboardElements).toEqual([{ type: 'rect', x: 10, y: 20 }]);
      expect(state.allDrawings).toEqual([{ type: 'circle', x: 30, y: 40 }]);
      expect(state.codeSnippets).toEqual({ language: 'python', content: 'print("hello")' });
      expect(state.diagramContent).toBe('graph TD; A-->B');
      expect(state.diagrams).toEqual([{ id: 'diagram-1', content: 'test' }]);
      expect(state.activeUsers).toBe(2);
    });

    it('returns null for non-existing workspace', () => {
      const state = getWorkspaceState('non-existing');
      expect(state).toBe(null);
    });

    it('returns default values for empty workspace', () => {
      createWorkspace('test-state', 'owner-1');
      const state = getWorkspaceState('test-state');

      expect(state.whiteboardElements).toEqual([]);
      expect(state.diagrams).toEqual([]);
      expect(state.activeUsers).toBe(0);
      expect(state.allDrawings).toEqual([]);
      expect(state.codeSnippets).toEqual({ language: 'javascript', content: '' });
      expect(state.diagramContent).toBe('');
    });
  });

  describe('findWorkspaceIdByRef', () => {
    afterEach(() => {
      deleteWorkspace('test-find-1');
      deleteWorkspace('test-find-2');
    });

    it('returns workspace ID for matching reference', () => {
      const workspace1 = createWorkspace('test-find-1', 'owner-1');
      createWorkspace('test-find-2', 'owner-2');

      const foundId = findWorkspaceIdByRef(workspace1);
      expect(foundId).toBe('test-find-1');
    });

    it('returns id from workspace object even if not in Map', () => {
      createWorkspace('test-find-1', 'owner-1');

      const fakeWorkspace = { id: 'fake', owner: 'fake-owner' };
      const foundId = findWorkspaceIdByRef(fakeWorkspace);

      expect(foundId).toBe('fake');
    });

    it('returns null for null or undefined reference', () => {
      expect(findWorkspaceIdByRef(null)).toBe(null);
      expect(findWorkspaceIdByRef(undefined)).toBe(null);
    });

    it('returns null for object without id', () => {
      const noIdWorkspace = { owner: 'fake-owner' };
      const foundId = findWorkspaceIdByRef(noIdWorkspace);
      expect(foundId).toBe(null);
    });
  });

  describe('updateSharingMode', () => {
    afterEach(() => {
      deleteWorkspace('test-sharing-mode');
    });

    it('should update sharing mode for existing workspace', () => {
      createWorkspace('test-sharing-mode', 'owner-1');
      const workspace = getWorkspace('test-sharing-mode');

      expect(workspace.sharingMode).toBe(SHARING_MODES.READ_WRITE_SELECTED);

      const result = updateSharingMode('test-sharing-mode', SHARING_MODES.READ_ONLY);
      expect(result).toBe(true);
      expect(workspace.sharingMode).toBe(SHARING_MODES.READ_ONLY);
    });

    it('should return false for non-existent workspace', () => {
      const result = updateSharingMode('non-existent', SHARING_MODES.READ_ONLY);
      expect(result).toBe(false);
    });

    it('should return false for invalid mode', () => {
      createWorkspace('test-sharing-mode', 'owner-1');
      const workspace = getWorkspace('test-sharing-mode');
      const originalMode = workspace.sharingMode;

      const result = updateSharingMode('test-sharing-mode', 'invalid-mode');
      expect(result).toBe(false);
      expect(workspace.sharingMode).toBe(originalMode);
    });

    it('should update lastActivity when changing mode', () => {
      const initialTime = 1000000;
      vi.setSystemTime(initialTime);

      createWorkspace('test-sharing-mode', 'owner-1');
      const workspace = getWorkspace('test-sharing-mode');
      expect(workspace.lastActivity).toBe(initialTime);

      const newTime = 2000000;
      vi.setSystemTime(newTime);

      updateSharingMode('test-sharing-mode', SHARING_MODES.READ_ONLY);
      expect(workspace.lastActivity).toBe(newTime);
    });

    it('should update from READ_WRITE_SELECTED to READ_WRITE_ALL', () => {
      createWorkspace('test-sharing-mode', 'owner-1');
      const workspace = getWorkspace('test-sharing-mode');

      expect(workspace.sharingMode).toBe(SHARING_MODES.READ_WRITE_SELECTED);

      const result = updateSharingMode('test-sharing-mode', SHARING_MODES.READ_WRITE_ALL);
      expect(result).toBe(true);
      expect(workspace.sharingMode).toBe(SHARING_MODES.READ_WRITE_ALL);
    });

    it('should update from READ_WRITE_ALL to READ_ONLY', () => {
      createWorkspace('test-sharing-mode', 'owner-1');
      const workspace = getWorkspace('test-sharing-mode');

      updateSharingMode('test-sharing-mode', SHARING_MODES.READ_WRITE_ALL);
      expect(workspace.sharingMode).toBe(SHARING_MODES.READ_WRITE_ALL);

      const result = updateSharingMode('test-sharing-mode', SHARING_MODES.READ_ONLY);
      expect(result).toBe(true);
      expect(workspace.sharingMode).toBe(SHARING_MODES.READ_ONLY);
    });

    it('should update from READ_ONLY to READ_WRITE_SELECTED', () => {
      createWorkspace('test-sharing-mode', 'owner-1');
      const workspace = getWorkspace('test-sharing-mode');

      updateSharingMode('test-sharing-mode', SHARING_MODES.READ_ONLY);
      expect(workspace.sharingMode).toBe(SHARING_MODES.READ_ONLY);

      const result = updateSharingMode('test-sharing-mode', SHARING_MODES.READ_WRITE_SELECTED);
      expect(result).toBe(true);
      expect(workspace.sharingMode).toBe(SHARING_MODES.READ_WRITE_SELECTED);
    });

    it('should handle setting same mode twice', () => {
      createWorkspace('test-sharing-mode', 'owner-1');
      const workspace = getWorkspace('test-sharing-mode');

      const result1 = updateSharingMode('test-sharing-mode', SHARING_MODES.READ_ONLY);
      expect(result1).toBe(true);
      expect(workspace.sharingMode).toBe(SHARING_MODES.READ_ONLY);

      const result2 = updateSharingMode('test-sharing-mode', SHARING_MODES.READ_ONLY);
      expect(result2).toBe(true);
      expect(workspace.sharingMode).toBe(SHARING_MODES.READ_ONLY);
    });

    it('should not modify other workspace properties', () => {
      createWorkspace('test-sharing-mode', 'owner-1');
      const workspace = getWorkspace('test-sharing-mode');
      const originalOwner = workspace.owner;
      const originalEditToken = workspace.editToken;
      const originalId = workspace.id;

      updateSharingMode('test-sharing-mode', SHARING_MODES.READ_ONLY);

      expect(workspace.owner).toBe(originalOwner);
      expect(workspace.editToken).toBe(originalEditToken);
      expect(workspace.id).toBe(originalId);
    });

    it('should reject null as sharing mode', () => {
      createWorkspace('test-sharing-mode', 'owner-1');
      const workspace = getWorkspace('test-sharing-mode');
      const originalMode = workspace.sharingMode;

      const result = updateSharingMode('test-sharing-mode', null);
      expect(result).toBe(false);
      expect(workspace.sharingMode).toBe(originalMode);
    });

    it('should reject undefined as sharing mode', () => {
      createWorkspace('test-sharing-mode', 'owner-1');
      const workspace = getWorkspace('test-sharing-mode');
      const originalMode = workspace.sharingMode;

      const result = updateSharingMode('test-sharing-mode', undefined);
      expect(result).toBe(false);
      expect(workspace.sharingMode).toBe(originalMode);
    });

    it('should reject empty string as sharing mode', () => {
      createWorkspace('test-sharing-mode', 'owner-1');
      const workspace = getWorkspace('test-sharing-mode');
      const originalMode = workspace.sharingMode;

      const result = updateSharingMode('test-sharing-mode', '');
      expect(result).toBe(false);
      expect(workspace.sharingMode).toBe(originalMode);
    });
  });
});
