import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { SHARING_MODES, SOCKET_EVENTS } from '../../server/config';

vi.mock('../../server/services/workspaceService');
vi.mock('../../server/services/permissionService');

import * as workspaceService from '../../server/services/workspaceService';
import * as permissionService from '../../server/services/permissionService';
import {
  handleJoinWorkspace,
  handleWhiteboardUpdate,
  handleWhiteboardClear,
  handleDeleteElement,
  handleCodeUpdate,
  handleGetEditToken,
  handleSetEditToken,
  handleChangeSharingMode,
  handleEndSession,
  handleDisconnect,
  clearWorkspacesBeingCreated,
  MAX_ELEMENTS_PER_UPDATE,
  MAX_CODE_LENGTH
} from '../../server/handlers/socketHandlers';
import type { Workspace, CurrentUser, CurrentWorkspaceRef, HandlerContext } from '../../server/types';
import type { SharingMode } from '../../shared/constants';

interface MockSocket {
  id: string;
  emit: Mock;
  join: Mock;
  leave: Mock;
  rooms: Set<string>;
  broadcast: {
    to: Mock;
  };
  to: Mock;
}

interface MockIo {
  to: Mock;
  sockets: {
    sockets: Map<string, unknown>;
    adapter: {
      rooms: Map<string, unknown>;
    };
  };
  _toEmit: Mock;
}

function createMockSocket(workspaceId: string | null = null): MockSocket {
  const broadcastTo = vi.fn().mockReturnValue({
    emit: vi.fn()
  });
  const to = vi.fn().mockReturnValue({
    emit: vi.fn()
  });

  const rooms = new Set<string>();
  if (workspaceId) {
    rooms.add(workspaceId);
  }

  return {
    id: 'socket-123',
    emit: vi.fn(),
    join: vi.fn((roomId: string) => rooms.add(roomId)),
    leave: vi.fn((roomId: string) => rooms.delete(roomId)),
    rooms,
    broadcast: {
      to: broadcastTo
    },
    to
  };
}

function createMockIo(): MockIo {
  const toEmit = vi.fn();
  return {
    to: vi.fn().mockReturnValue({ emit: toEmit }),
    sockets: {
      sockets: new Map(),
      adapter: {
        rooms: new Map()
      }
    },
    _toEmit: toEmit
  };
}

function createMockWorkspace(overrides: Partial<Workspace> = {}): Workspace {
  return {
    id: 'ws-1',
    created: Date.now(),
    lastActivity: Date.now(),
    owner: 'owner-123',
    sharingMode: SHARING_MODES.READ_WRITE_SELECTED as SharingMode,
    editToken: 'edit_token123',
    drawingsMap: new Map(),
    allDrawingsMap: new Map(),
    drawingOrder: [],
    diagrams: new Map(),
    codeSnippets: { language: 'javascript', content: '' },
    diagramContent: '',
    allowedUsers: [],
    ...overrides
  };
}

describe('socketHandlers', () => {
  let socket: MockSocket;
  let io: MockIo;
  let currentUser: CurrentUser;
  let currentWorkspaceRef: CurrentWorkspaceRef;
  let queueUpdate: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    clearWorkspacesBeingCreated();
    socket = createMockSocket('ws-1');
    io = createMockIo();
    currentUser = { id: 'socket-123', joinedAt: Date.now() };
    currentWorkspaceRef = { current: null };
    queueUpdate = vi.fn();

    vi.mocked(workspaceService.getWorkspace).mockReturnValue(undefined);
    vi.mocked(workspaceService.createWorkspace).mockReturnValue(createMockWorkspace());
    vi.mocked(workspaceService.addConnection).mockReturnValue(1);
    vi.mocked(workspaceService.removeConnection).mockReturnValue(0);
    vi.mocked(workspaceService.getActiveUserCount).mockReturnValue(1);
    vi.mocked(workspaceService.updateLastActivity).mockReturnValue(undefined);
    vi.mocked(workspaceService.getWorkspaceState).mockReturnValue({
      whiteboardElements: [],
      diagrams: [],
      activeUsers: 1,
      allDrawings: [],
      codeSnippets: { language: 'javascript', content: '' },
      diagramContent: ''
    });
    vi.mocked(workspaceService.findWorkspaceIdByRef).mockReturnValue(null);
    vi.mocked(workspaceService.setUserSession).mockReturnValue(undefined);
    vi.mocked(workspaceService.removeUserSession).mockReturnValue(undefined);
    vi.mocked(workspaceService.updateSharingMode).mockReturnValue(true);
    vi.mocked(workspaceService.getActiveConnections).mockReturnValue(new Set());

    vi.mocked(permissionService.calculateEditAccess).mockReturnValue({ hasEditAccess: true, isOwner: false });
    vi.mocked(permissionService.checkWritePermission).mockReturnValue(true);
    vi.mocked(permissionService.checkOwnership).mockReturnValue(false);
    vi.mocked(permissionService.validateAndSetToken).mockReturnValue(false);
    vi.mocked(permissionService.getSharingInfo).mockReturnValue({
      sharingMode: SHARING_MODES.READ_WRITE_SELECTED as SharingMode,
      allowedUsers: [],
      isOwner: false,
      currentUser: null,
      owner: 'owner-123',
      hasEditAccess: true
    });
  });

  describe('handleJoinWorkspace', () => {
    beforeEach(() => {
      socket = createMockSocket();
    });

    it('should create new workspace, join existing, and set owner', async () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(undefined);
      vi.mocked(workspaceService.createWorkspace).mockReturnValue(workspace);

      const result = await handleJoinWorkspace(
        { workspaceId: 'ws-1', userId: 'user-1', accessToken: null },
        { socket, io, currentUser, currentWorkspaceRef, queueUpdate } as unknown as HandlerContext
      );

      expect(result.success).toBe(true);
      expect(result.isNewWorkspace).toBe(true);
      expect(workspaceService.createWorkspace).toHaveBeenCalledWith('ws-1', 'user-1');
      expect(socket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.WORKSPACE_STATE, expect.any(Object));
      expect(socket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.SHARING_INFO, expect.any(Object));
    });

    it('should leave previous workspace and validate token', async () => {
      const prevWorkspace = createMockWorkspace();
      const newWorkspace = createMockWorkspace();
      currentWorkspaceRef.current = prevWorkspace;
      vi.mocked(workspaceService.findWorkspaceIdByRef).mockReturnValue('prev-ws');
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(newWorkspace);

      await handleJoinWorkspace(
        { workspaceId: 'ws-1', userId: 'user-1', accessToken: 'edit_token123' },
        { socket, io, currentUser, currentWorkspaceRef, queueUpdate } as unknown as HandlerContext
      );

      expect(socket.leave).toHaveBeenCalledWith('prev-ws');
      expect(workspaceService.removeConnection).toHaveBeenCalledWith('prev-ws', 'socket-123');
      expect(permissionService.validateAndSetToken).toHaveBeenCalledWith(newWorkspace, 'edit_token123', expect.any(Object));
    });

    it('should handle errors and use default userId', async () => {
      vi.mocked(workspaceService.getWorkspace).mockImplementationOnce(() => { throw new Error('Test error'); });
      const result = await handleJoinWorkspace(
        { workspaceId: 'ws-1', accessToken: null },
        { socket, io, currentUser, currentWorkspaceRef, queueUpdate } as unknown as HandlerContext
      );

      expect(result.success).toBe(false);
      expect(socket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ERROR, { message: 'Failed to join workspace' });
    });
  });

  describe('handleWhiteboardUpdate', () => {
    it('should update whiteboard and validate inputs', async () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);

      const result = await handleWhiteboardUpdate(
        { workspaceId: 'ws-1', elements: [{ id: 'el-1', type: 'rect', data: { left: 10 } }] },
        { socket, currentUser, queueUpdate } as unknown as HandlerContext
      );

      expect(result.success).toBe(true);
      expect(workspace.drawingsMap.has('el-1')).toBe(true);
      expect(queueUpdate).toHaveBeenCalledWith('ws-1', [{ id: 'el-1', type: 'rect', data: { left: 10 } }], 'socket-123');
      expect(workspace.drawingsMap.get('el-1')).toHaveProperty('timestamp');
    });

    it('should reject invalid inputs and permissions', async () => {
      const workspace = createMockWorkspace();
      const tooManyElements = Array(MAX_ELEMENTS_PER_UPDATE + 1).fill({ id: 'el', type: 'rect', data: {} });

      vi.mocked(workspaceService.getWorkspace).mockReturnValue(undefined);
      expect((await handleWhiteboardUpdate({ workspaceId: 'ws-1', elements: [] }, { socket, currentUser, queueUpdate } as unknown as HandlerContext)).reason).toBe('workspace_not_found');

      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);
      expect((await handleWhiteboardUpdate({ workspaceId: 'ws-1', elements: 'not-array' as unknown as [] }, { socket, currentUser, queueUpdate } as unknown as HandlerContext)).reason).toBe('invalid_input');
      expect((await handleWhiteboardUpdate({ workspaceId: 'ws-1', elements: tooManyElements }, { socket, currentUser, queueUpdate } as unknown as HandlerContext)).reason).toBe('too_many_elements');

      vi.mocked(permissionService.checkWritePermission).mockReturnValue(false);
      expect((await handleWhiteboardUpdate({ workspaceId: 'ws-1', elements: [{ id: 'el-1', type: 'rect', data: {} }] }, { socket, currentUser, queueUpdate } as unknown as HandlerContext)).reason).toBe('no_permission');
      vi.mocked(permissionService.checkWritePermission).mockReturnValue(true);
    });

    it('should update existing elements and track new ones', async () => {
      const workspace = createMockWorkspace();
      workspace.drawingsMap.set('el-1', { id: 'el-1', type: 'rect', data: { left: 0 } });
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);

      await handleWhiteboardUpdate(
        { workspaceId: 'ws-1', elements: [{ id: 'el-1', type: 'rect', data: { left: 100 } }, { id: 'el-2', type: 'rect', data: {} }] },
        { socket, currentUser, queueUpdate } as unknown as HandlerContext
      );

      expect((workspace.drawingsMap.get('el-1')?.data as { left: number }).left).toBe(100);
      expect(workspace.drawingOrder).toContain('el-2');
      expect(workspace.drawingOrder.filter(id => id === 'el-1').length).toBe(0);
    });
  });

  describe('handleWhiteboardClear', () => {
    it('should clear drawings and check permissions', async () => {
      const workspace = createMockWorkspace();
      workspace.drawingsMap.set('el-1', { id: 'el-1', type: 'rect', data: {} });
      workspace.allDrawingsMap.set('el-1', { id: 'el-1', type: 'rect', data: {} });
      workspace.drawingOrder.push('el-1');
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);

      const result = await handleWhiteboardClear({ workspaceId: 'ws-1' }, { socket, currentUser } as unknown as HandlerContext);
      expect(result.success).toBe(true);
      expect(workspace.drawingsMap.size).toBe(0);
      expect(socket.broadcast.to).toHaveBeenCalledWith('ws-1');

      vi.mocked(permissionService.checkWritePermission).mockReturnValue(false);
      const noPermResult = await handleWhiteboardClear({ workspaceId: 'ws-1' }, { socket, currentUser } as unknown as HandlerContext);
      expect(noPermResult.reason).toBe('no_permission');
      vi.mocked(permissionService.checkWritePermission).mockReturnValue(true);
    });
  });

  describe('handleDeleteElement', () => {
    it('should delete element and validate', async () => {
      const workspace = createMockWorkspace();
      workspace.drawingsMap.set('el-1', { id: 'el-1', type: 'rect', data: {} });
      workspace.allDrawingsMap.set('el-1', { id: 'el-1', type: 'rect', data: {} });
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);

      const result = await handleDeleteElement({ workspaceId: 'ws-1', elementId: 'el-1' }, { socket, currentUser } as unknown as HandlerContext);
      expect(result.success).toBe(true);
      expect(workspace.drawingsMap.has('el-1')).toBe(false);
      expect(socket.broadcast.to).toHaveBeenCalledWith('ws-1');

      expect((await handleDeleteElement({ workspaceId: 'ws-1', elementId: '' }, { socket, currentUser } as unknown as HandlerContext)).reason).toBe('invalid_input');
    });
  });

  describe('handleCodeUpdate', () => {
    it('should update code and validate content', async () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);

      const result = await handleCodeUpdate({ workspaceId: 'ws-1', language: 'javascript', content: 'console.log("test")' }, { socket, currentUser } as unknown as HandlerContext);
      expect(result.success).toBe(true);
      expect(workspace.codeSnippets).toEqual({ language: 'javascript', content: 'console.log("test")' });
      expect(socket.broadcast.to).toHaveBeenCalledWith('ws-1');

      expect((await handleCodeUpdate({ workspaceId: 'ws-1', language: 'javascript', content: 12345 as unknown as string }, { socket, currentUser } as unknown as HandlerContext)).reason).toBe('invalid_content');
      expect((await handleCodeUpdate({ workspaceId: 'ws-1', language: 'javascript', content: 'x'.repeat(MAX_CODE_LENGTH + 1) }, { socket, currentUser } as unknown as HandlerContext)).reason).toBe('invalid_content');
      expect((await handleCodeUpdate({ workspaceId: 'ws-1', language: 'javascript', content: 'x'.repeat(MAX_CODE_LENGTH) }, { socket, currentUser } as unknown as HandlerContext)).success).toBe(true);
    });
  });

  describe('handleGetEditToken', () => {
    it('should return token for owner and handle errors', () => {
      const workspace = createMockWorkspace({ editToken: 'edit_secret' });
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);
      vi.mocked(permissionService.checkOwnership).mockReturnValue(true);
      const callback = vi.fn();

      expect(handleGetEditToken({ workspaceId: 'ws-1' }, callback, { socket, currentUser } as unknown as HandlerContext).success).toBe(true);
      expect(callback).toHaveBeenCalledWith({ editToken: 'edit_secret' });

      vi.mocked(permissionService.checkOwnership).mockReturnValue(false);
      expect(handleGetEditToken({ workspaceId: 'ws-1' }, callback, { socket, currentUser } as unknown as HandlerContext).reason).toBe('not_owner');
    });
  });

  describe('handleSetEditToken', () => {
    it('should set token for owner and validate format', () => {
      const workspace = createMockWorkspace({ editToken: '' });
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);
      vi.mocked(permissionService.checkOwnership).mockReturnValue(true);

      const result = handleSetEditToken({ workspaceId: 'ws-1', editToken: 'edit_newtoken' }, { socket, io, currentUser } as unknown as HandlerContext);
      expect(result.success).toBe(true);
      expect(workspace.editToken).toBe('edit_newtoken');
      expect(socket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.EDIT_TOKEN_UPDATED, { editToken: 'edit_newtoken' });

      expect(handleSetEditToken({ workspaceId: 'ws-1', editToken: 'invalid_token' }, { socket, io, currentUser } as unknown as HandlerContext).reason).toBe('invalid_token_format');
      expect(handleSetEditToken({ workspaceId: 'ws-1', editToken: '' }, { socket, io, currentUser } as unknown as HandlerContext).reason).toBe('invalid_token_format');
    });
  });

  describe('handleChangeSharingMode', () => {
    it('should change mode and validate', async () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);
      vi.mocked(permissionService.checkOwnership).mockReturnValue(true);

      const result = await handleChangeSharingMode({ workspaceId: 'ws-1', sharingMode: SHARING_MODES.READ_WRITE_ALL as SharingMode }, { socket, io, currentUser } as unknown as HandlerContext);
      expect(result.success).toBe(true);
      expect(workspaceService.updateSharingMode).toHaveBeenCalledWith('ws-1', SHARING_MODES.READ_WRITE_ALL);
      expect(io.to).toHaveBeenCalledWith('ws-1');

      expect((await handleChangeSharingMode({ workspaceId: 'ws-1', sharingMode: 'invalid-mode' as SharingMode }, { socket, io, currentUser } as unknown as HandlerContext)).reason).toBe('invalid_mode');
    });
  });

  describe('handleEndSession', () => {
    it('should end session and disconnect other clients', async () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);
      vi.mocked(permissionService.checkOwnership).mockReturnValue(true);

      const otherSocket = { id: 'other-socket', leave: vi.fn() };
      io.sockets.sockets.set('other-socket', otherSocket);
      vi.mocked(workspaceService.getActiveConnections).mockReturnValue(new Set(['other-socket', 'socket-123']));

      const result = await handleEndSession({ workspaceId: 'ws-1' }, { socket, io, currentUser } as unknown as HandlerContext);
      expect(result.success).toBe(true);
      expect(otherSocket.leave).toHaveBeenCalledWith('ws-1');
      expect(io._toEmit).toHaveBeenCalledWith(SOCKET_EVENTS.SESSION_ENDED, { message: 'The workspace owner has ended this session' });
    });
  });

  describe('handleDisconnect', () => {
    it('should clean up and emit USER_LEFT', () => {
      const workspace = createMockWorkspace();
      currentWorkspaceRef.current = workspace;
      vi.mocked(workspaceService.findWorkspaceIdByRef).mockReturnValue('ws-1');
      vi.mocked(workspaceService.getActiveUserCount).mockReturnValue(3);

      handleDisconnect({ socket, io, currentUser, currentWorkspaceRef } as unknown as HandlerContext);
      expect(workspaceService.removeConnection).toHaveBeenCalledWith('ws-1', 'socket-123');
      expect(io._toEmit).toHaveBeenCalledWith(SOCKET_EVENTS.USER_LEFT, { userId: 'socket-123', activeUsers: 3 });
    });
  });
});
