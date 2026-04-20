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
} from '../../server/services/workspaceService';
import { SHARING_MODES, config } from '../../server/config';
import type { Workspace, UserSession } from '../../server/types';
import type { SharingMode } from '../../shared/constants';

describe('workspaceService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('generateKey', () => {
    it('returns alphanumeric string with custom lengths', () => {
      const key = generateKey();
      expect(typeof key).toBe('string');
      expect(key.length).toBeLessThanOrEqual(12);
      expect(key).toMatch(/^[A-Za-z0-9]+$/);

      expect(generateKey(8).length).toBeLessThanOrEqual(8);
      expect(generateKey()).not.toBe(generateKey());
    });
  });

  describe('generateEditToken', () => {
    it('returns unique edit_ prefixed tokens', () => {
      const token = generateEditToken();
      expect(token).toMatch(/^edit_[a-f0-9]{64}$/);
      expect(generateEditToken()).not.toBe(generateEditToken());
    });
  });

  describe('createWorkspace', () => {
    afterEach(() => {
      ['test-workspace', 'ws-1', 'ws-2', 'ws-3'].forEach(id => {
        if (getWorkspace(id)) deleteWorkspace(id);
      });
    });

    it('creates workspace with all required fields and unique tokens', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      const workspace = createWorkspace('test-workspace', 'owner-123');
      expect(workspace.id).toBe('test-workspace');
      expect(workspace.owner).toBe('owner-123');
      expect(workspace.created).toBe(now);
      expect(workspace.diagrams).toBeInstanceOf(Map);
      expect(workspace.drawingsMap.size).toBe(0);
      expect(workspace.sharingMode).toBe(SHARING_MODES.READ_WRITE_ALL);
      expect(workspace.editToken).toMatch(/^edit_[a-f0-9]{64}$/);

      const workspace2 = createWorkspace('ws-2', 'owner-2');
      expect(workspace.editToken).not.toBe(workspace2.editToken);
      deleteWorkspace('ws-2');
    });
  });

  describe('workspaceExists and getWorkspace', () => {
    afterEach(() => {
      if (getWorkspace('test-ws')) deleteWorkspace('test-ws');
    });

    it('checks existence and retrieves workspaces', () => {
      expect(workspaceExists('test-ws')).toBe(false);
      expect(getWorkspace('test-ws')).toBeUndefined();

      const created = createWorkspace('test-ws', 'owner-1');
      expect(workspaceExists('test-ws')).toBe(true);
      expect(getWorkspace('test-ws')).toBe(created);

      deleteWorkspace('test-ws');
      expect(workspaceExists('test-ws')).toBe(false);
    });
  });

  describe('deleteWorkspace', () => {
    afterEach(() => {
      removeUserSession('socket-1');
    });

    it('removes workspace and connections', () => {
      createWorkspace('test-delete', 'owner-1');
      addConnection('test-delete', 'socket-1');
      setUserSession('socket-1', { id: 'socket-1', joinedAt: Date.now(), userId: 'user-1', workspaceId: 'test-delete' });

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
      expect(workspace?.lastActivity).toBe(initialTime);

      const newTime = 2000000;
      vi.setSystemTime(newTime);
      updateLastActivity('test-activity');

      expect(workspace?.lastActivity).toBe(newTime);
    });

    it('does nothing for non-existing workspace', () => {
      expect(() => updateLastActivity('non-existing')).not.toThrow();
    });
  });

  describe('Connection management', () => {
    afterEach(() => {
      if (getWorkspace('test-conn')) deleteWorkspace('test-conn');
      removeUserSession('socket-1');
      removeUserSession('socket-2');
    });

    it('adds, removes connections and counts users', () => {
      createWorkspace('test-conn', 'owner-1');

      expect(addConnection('test-conn', 'socket-1')).toBe(1);
      expect(addConnection('test-conn', 'socket-2')).toBe(2);
      expect(addConnection('test-conn', 'socket-1')).toBe(2);

      expect(removeConnection('test-conn', 'socket-2')).toBe(1);
      expect(removeConnection('test-conn', 'socket-1')).toBe(0);
      expect(removeConnection('non-existing', 'socket-1')).toBe(0);

      addConnection('test-conn', 'socket-1');
      setUserSession('socket-1', { id: 'socket-1', joinedAt: Date.now(), userId: 'user-1', workspaceId: 'test-conn' });
      expect(getActiveUserCount('test-conn')).toBe(1);
      expect(getActiveUserCount('non-existing')).toBe(0);
    });
  });

  describe('User session management', () => {
    afterEach(() => {
      removeUserSession('socket-1');
      removeUserSession('socket-2');
    });

    it('sets, gets, and removes sessions', () => {
      const userInfo: UserSession = { id: 'socket-1', joinedAt: Date.now(), userId: 'user-1', workspaceId: 'ws-1' };
      setUserSession('socket-1', userInfo);
      expect(getUserSession('socket-1')).toEqual(userInfo);

      const userInfo2: UserSession = { id: 'socket-1', joinedAt: Date.now(), userId: 'user-2', workspaceId: 'ws-2' };
      setUserSession('socket-1', userInfo2);
      expect(getUserSession('socket-1')).toEqual(userInfo2);

      removeUserSession('socket-1');
      expect(getUserSession('socket-1')).toBeUndefined();
      expect(getUserSession('non-existing')).toBeUndefined();
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

      setUserSession('socket-1', { id: 'socket-1', joinedAt: Date.now(), userId: 'owner-123', workspaceId: 'test-users' });
      setUserSession('socket-2', { id: 'socket-2', joinedAt: Date.now(), userId: 'user-456', workspaceId: 'test-users' });
      setUserSession('socket-3', { id: 'socket-3', joinedAt: Date.now(), userId: 'user-789', workspaceId: 'test-users' });

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

      setUserSession('socket-1', { id: 'socket-1', joinedAt: Date.now(), userId: 'user-1', workspaceId: 'test-users' });
      addConnection('test-users', 'socket-1');
      addConnection('test-users', 'socket-2');

      const users = getWorkspaceUsers('test-users');
      expect(users).toHaveLength(1);
      expect(users[0]?.id).toBe('user-1');
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

      workspace!.drawingsMap.set('rect-1', { id: 'rect-1', type: 'rect', data: { x: 10, y: 20 } });
      workspace!.allDrawingsMap.set('circle-1', { id: 'circle-1', type: 'circle', data: { x: 30, y: 40 } });
      workspace!.codeSnippets = { language: 'python', content: 'print("hello")' };
      workspace!.diagramContent = 'graph TD; A-->B';
      workspace!.diagrams.set('diagram-1', { id: 'diagram-1', content: 'test' });

      addConnection('test-state', 'socket-1');
      setUserSession('socket-1', { id: 'socket-1', joinedAt: Date.now(), userId: 'user-1', workspaceId: 'test-state' });
      addConnection('test-state', 'socket-2');
      setUserSession('socket-2', { id: 'socket-2', joinedAt: Date.now(), userId: 'user-2', workspaceId: 'test-state' });

      const state = getWorkspaceState('test-state');

      expect(state).toBeDefined();
      expect(state?.whiteboardElements).toEqual([{ id: 'rect-1', type: 'rect', data: { x: 10, y: 20 } }]);
      expect(state?.allDrawings).toEqual([{ id: 'circle-1', type: 'circle', data: { x: 30, y: 40 } }]);
      expect(state?.codeSnippets).toEqual({ language: 'python', content: 'print("hello")' });
      expect(state?.diagramContent).toBe('graph TD; A-->B');
      expect(state?.diagrams).toEqual([{ id: 'diagram-1', content: 'test' }]);
      expect(state?.activeUsers).toBe(2);
    });

    it('returns null for non-existing workspace', () => {
      const state = getWorkspaceState('non-existing');
      expect(state).toBe(null);
    });

    it('returns default values for empty workspace', () => {
      createWorkspace('test-state', 'owner-1');
      const state = getWorkspaceState('test-state');

      expect(state?.whiteboardElements).toEqual([]);
      expect(state?.diagrams).toEqual([]);
      expect(state?.activeUsers).toBe(0);
      expect(state?.allDrawings).toEqual([]);
      expect(state?.codeSnippets).toEqual({ language: 'javascript', content: '' });
      expect(state?.diagramContent).toBe('');
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

      const fakeWorkspace = { id: 'fake', owner: 'fake-owner' } as Partial<Workspace>;
      const foundId = findWorkspaceIdByRef(fakeWorkspace);

      expect(foundId).toBe('fake');
    });

    it('returns null for null or undefined reference', () => {
      expect(findWorkspaceIdByRef(null)).toBe(null);
      expect(findWorkspaceIdByRef(undefined)).toBe(null);
    });

    it('returns null for object without id', () => {
      const noIdWorkspace = { owner: 'fake-owner' } as Partial<Workspace>;
      const foundId = findWorkspaceIdByRef(noIdWorkspace);
      expect(foundId).toBe(null);
    });
  });

  describe('updateSharingMode', () => {
    afterEach(() => {
      if (getWorkspace('test-mode')) deleteWorkspace('test-mode');
    });

    it('updates modes and validates input', () => {
      const initialTime = 1000000;
      vi.setSystemTime(initialTime);

      createWorkspace('test-mode', 'owner-1');
      const workspace = getWorkspace('test-mode');
      expect(workspace?.sharingMode).toBe(SHARING_MODES.READ_WRITE_ALL);

      const newTime = 2000000;
      vi.setSystemTime(newTime);

      expect(updateSharingMode('test-mode', SHARING_MODES.READ_ONLY as SharingMode)).toBe(true);
      expect(workspace?.sharingMode).toBe(SHARING_MODES.READ_ONLY);
      expect(workspace?.lastActivity).toBe(newTime);

      expect(updateSharingMode('test-mode', SHARING_MODES.READ_WRITE_ALL as SharingMode)).toBe(true);
      expect(workspace?.sharingMode).toBe(SHARING_MODES.READ_WRITE_ALL);

      expect(updateSharingMode('non-existent', SHARING_MODES.READ_ONLY as SharingMode)).toBe(false);
      expect(updateSharingMode('test-mode', 'invalid' as SharingMode)).toBe(false);
      expect(updateSharingMode('test-mode', null as unknown as SharingMode)).toBe(false);
    });
  });
});
