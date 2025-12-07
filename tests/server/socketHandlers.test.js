import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SHARING_MODES, SOCKET_EVENTS } from '../../server/config.js';

vi.mock('../../server/services/workspaceService.js');
vi.mock('../../server/services/permissionService.js');

import * as workspaceService from '../../server/services/workspaceService.js';
import * as permissionService from '../../server/services/permissionService.js';
import {
  handleJoinWorkspace,
  handleWhiteboardUpdate,
  handleWhiteboardClear,
  handleDeleteElement,
  handleDeleteDiagram,
  handleCodeUpdate,
  handleDiagramUpdate,
  handleGetEditToken,
  handleSetEditToken,
  handleChangeSharingMode,
  handleEndSession,
  handleDisconnect,
  handleInviteUser,
  MAX_ELEMENTS_PER_UPDATE,
  MAX_CODE_LENGTH,
  MAX_DIAGRAM_LENGTH
} from '../../server/handlers/socketHandlers.js';

function createMockSocket(workspaceId = null) {
  const broadcastTo = vi.fn().mockReturnValue({
    emit: vi.fn()
  });
  const to = vi.fn().mockReturnValue({
    emit: vi.fn()
  });

  const rooms = new Set();
  if (workspaceId) {
    rooms.add(workspaceId);
  }

  return {
    id: 'socket-123',
    emit: vi.fn(),
    join: vi.fn((roomId) => rooms.add(roomId)),
    leave: vi.fn((roomId) => rooms.delete(roomId)),
    rooms,
    broadcast: {
      to: broadcastTo
    },
    to
  };
}

function createMockIo() {
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

function createMockWorkspace(overrides = {}) {
  return {
    owner: 'owner-123',
    sharingMode: SHARING_MODES.READ_WRITE_SELECTED,
    editToken: 'edit_token123',
    drawingsMap: new Map(),
    allDrawingsMap: new Map(),
    drawingOrder: [],
    diagrams: new Map(),
    codeSnippets: null,
    diagramContent: '',
    allowedUsers: [],
    ...overrides
  };
}

describe('socketHandlers', () => {
  let socket;
  let io;
  let currentUser;
  let currentWorkspaceRef;
  let queueUpdate;

  beforeEach(() => {
    vi.clearAllMocks();
    socket = createMockSocket('ws-1');
    io = createMockIo();
    currentUser = { id: 'socket-123', joinedAt: Date.now() };
    currentWorkspaceRef = { current: null };
    queueUpdate = vi.fn();

    vi.mocked(workspaceService.getWorkspace).mockReturnValue(null);
    vi.mocked(workspaceService.createWorkspace).mockReturnValue(null);
    vi.mocked(workspaceService.addConnection).mockReturnValue(undefined);
    vi.mocked(workspaceService.removeConnection).mockReturnValue(undefined);
    vi.mocked(workspaceService.getActiveUserCount).mockReturnValue(1);
    vi.mocked(workspaceService.updateLastActivity).mockReturnValue(undefined);
    vi.mocked(workspaceService.getWorkspaceState).mockReturnValue({ drawings: [], code: null });
    vi.mocked(workspaceService.findWorkspaceIdByRef).mockReturnValue(null);
    vi.mocked(workspaceService.setUserSession).mockReturnValue(undefined);
    vi.mocked(workspaceService.removeUserSession).mockReturnValue(undefined);
    vi.mocked(workspaceService.updateSharingMode).mockReturnValue(true);
    vi.mocked(workspaceService.getActiveConnections).mockReturnValue([]);

    vi.mocked(permissionService.calculateEditAccess).mockReturnValue({ hasEditAccess: true, isOwner: false });
    vi.mocked(permissionService.checkWritePermission).mockReturnValue(true);
    vi.mocked(permissionService.checkOwnership).mockReturnValue(false);
    vi.mocked(permissionService.validateAndSetToken).mockReturnValue(undefined);
    vi.mocked(permissionService.getSharingInfo).mockReturnValue({});
  });

  describe('handleJoinWorkspace', () => {
    it('should create new workspace if not exists', async () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(null);
      vi.mocked(workspaceService.createWorkspace).mockReturnValue(workspace);

      const result = await handleJoinWorkspace(
        { workspaceId: 'ws-1', userId: 'user-1', accessToken: null },
        { socket, io, currentUser, currentWorkspaceRef, queueUpdate }
      );

      expect(result.success).toBe(true);
      expect(result.isNewWorkspace).toBe(true);
      expect(workspaceService.createWorkspace).toHaveBeenCalledWith('ws-1', 'user-1');
    });

    it('should join existing workspace', async () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);

      const result = await handleJoinWorkspace(
        { workspaceId: 'ws-1', userId: 'user-1', accessToken: null },
        { socket, io, currentUser, currentWorkspaceRef, queueUpdate }
      );

      expect(result.success).toBe(true);
      expect(result.isNewWorkspace).toBe(false);
      expect(workspaceService.createWorkspace).not.toHaveBeenCalled();
    });

    it('should set owner for new workspace', async () => {
      const workspace = createMockWorkspace({ owner: null });
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(null);
      vi.mocked(workspaceService.createWorkspace).mockReturnValue(workspace);

      await handleJoinWorkspace(
        { workspaceId: 'ws-1', userId: 'user-1', accessToken: null },
        { socket, io, currentUser, currentWorkspaceRef, queueUpdate }
      );

      expect(workspace.owner).toBe('user-1');
      expect(currentUser.isOwner).toBe(true);
      expect(currentUser.hasEditAccess).toBe(true);
    });

    it('should emit WORKSPACE_STATE and SHARING_INFO', async () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);

      await handleJoinWorkspace(
        { workspaceId: 'ws-1', userId: 'user-1', accessToken: null },
        { socket, io, currentUser, currentWorkspaceRef, queueUpdate }
      );

      expect(socket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.WORKSPACE_STATE, expect.any(Object));
      expect(socket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.SHARING_INFO, expect.any(Object));
    });

    it('should leave previous workspace if exists', async () => {
      const prevWorkspace = createMockWorkspace();
      const newWorkspace = createMockWorkspace();
      currentWorkspaceRef.current = prevWorkspace;
      vi.mocked(workspaceService.findWorkspaceIdByRef).mockReturnValue('prev-ws');
      workspaceService.getWorkspace.mockReturnValue(newWorkspace);

      await handleJoinWorkspace(
        { workspaceId: 'ws-1', userId: 'user-1', accessToken: null },
        { socket, io, currentUser, currentWorkspaceRef, queueUpdate }
      );

      expect(socket.leave).toHaveBeenCalledWith('prev-ws');
      expect(workspaceService.removeConnection).toHaveBeenCalledWith('prev-ws', 'socket-123');
    });

    it('should validate access token', async () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);

      await handleJoinWorkspace(
        { workspaceId: 'ws-1', userId: 'user-1', accessToken: 'edit_token123' },
        { socket, io, currentUser, currentWorkspaceRef, queueUpdate }
      );

      expect(permissionService.validateAndSetToken).toHaveBeenCalledWith(workspace, 'edit_token123', currentUser);
    });

    it('should emit error on exception', async () => {
      vi.mocked(workspaceService.getWorkspace).mockImplementation(() => { throw new Error('Test error'); });

      const result = await handleJoinWorkspace(
        { workspaceId: 'ws-1', userId: 'user-1', accessToken: null },
        { socket, io, currentUser, currentWorkspaceRef, queueUpdate }
      );

      expect(result.success).toBe(false);
      expect(socket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ERROR, { message: 'Failed to join workspace' });
    });

    it('should use socket.id as userId if not provided', async () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(null);
      vi.mocked(workspaceService.createWorkspace).mockReturnValue(workspace);

      await handleJoinWorkspace(
        { workspaceId: 'ws-1', userId: null, accessToken: null },
        { socket, io, currentUser, currentWorkspaceRef, queueUpdate }
      );

      expect(workspaceService.createWorkspace).toHaveBeenCalledWith('ws-1', 'socket-123');
    });

    it('should broadcast USER_JOINED event', async () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);
      vi.mocked(workspaceService.getActiveUserCount).mockReturnValue(5);

      await handleJoinWorkspace(
        { workspaceId: 'ws-1', userId: 'user-1', accessToken: null },
        { socket, io, currentUser, currentWorkspaceRef, queueUpdate }
      );

      expect(io.to).toHaveBeenCalledWith('ws-1');
      expect(io._toEmit).toHaveBeenCalledWith(SOCKET_EVENTS.USER_JOINED, { userId: 'socket-123', activeUsers: 5 });
    });
  });

  describe('handleWhiteboardUpdate', () => {
    it('should update whiteboard with valid elements', () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);

      const result = handleWhiteboardUpdate(
        { workspaceId: 'ws-1', elements: [{ id: 'el-1', type: 'rect', data: { left: 10 } }] },
        { socket, currentUser, queueUpdate }
      );

      expect(result.success).toBe(true);
      expect(workspace.drawingsMap.has('el-1')).toBe(true);
      expect(queueUpdate).toHaveBeenCalledWith('ws-1', [{ id: 'el-1', type: 'rect', data: { left: 10 } }], 'socket-123');
    });

    it('should reject if workspace not found', () => {
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(null);

      const result = handleWhiteboardUpdate(
        { workspaceId: 'ws-1', elements: [{ id: 'el-1' }] },
        { socket, currentUser, queueUpdate }
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe('workspace_not_found');
    });

    it('should reject if elements is not array', () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);

      const result = handleWhiteboardUpdate(
        { workspaceId: 'ws-1', elements: 'not-array' },
        { socket, currentUser, queueUpdate }
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe('invalid_input');
    });

    it('should reject if too many elements', () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);
      const tooManyElements = Array(MAX_ELEMENTS_PER_UPDATE + 1).fill({ id: 'el' });

      const result = handleWhiteboardUpdate(
        { workspaceId: 'ws-1', elements: tooManyElements },
        { socket, currentUser, queueUpdate }
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe('too_many_elements');
      expect(socket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ERROR, { message: 'Too many elements in single update' });
    });

    it('should reject if no write permission', () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);
      vi.mocked(permissionService.checkWritePermission).mockReturnValue(false);

      const result = handleWhiteboardUpdate(
        { workspaceId: 'ws-1', elements: [{ id: 'el-1' }] },
        { socket, currentUser, queueUpdate }
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe('no_permission');
      expect(socket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ERROR, { message: 'You do not have permission to edit' });
    });

    it('should add timestamp to elements', () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);

      handleWhiteboardUpdate(
        { workspaceId: 'ws-1', elements: [{ id: 'el-1', type: 'rect', data: { left: 0, top: 0 } }] },
        { socket, currentUser, queueUpdate }
      );

      const storedElement = workspace.drawingsMap.get('el-1');
      expect(storedElement).toHaveProperty('timestamp');
      expect(typeof storedElement.timestamp).toBe('number');
    });

    it('should skip elements without id', () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);

      handleWhiteboardUpdate(
        { workspaceId: 'ws-1', elements: [{ id: 'el-1', type: 'rect', data: { left: 0, top: 0 } }] },
        { socket, currentUser, queueUpdate }
      );

      expect(workspace.drawingsMap.size).toBe(1);
      expect(workspace.drawingsMap.has('el-1')).toBe(true);
    });

    it('should update existing elements', () => {
      const workspace = createMockWorkspace();
      workspace.drawingsMap.set('el-1', { id: 'el-1', type: 'rect', data: { left: 0 } });
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);

      handleWhiteboardUpdate(
        { workspaceId: 'ws-1', elements: [{ id: 'el-1', type: 'rect', data: { left: 100 } }] },
        { socket, currentUser, queueUpdate }
      );

      expect(workspace.drawingsMap.get('el-1').data.left).toBe(100);
    });

    it('should add to drawingOrder for new elements only', () => {
      const workspace = createMockWorkspace();
      workspace.drawingsMap.set('el-1', { id: 'el-1', type: 'rect', data: {} });
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);

      handleWhiteboardUpdate(
        { workspaceId: 'ws-1', elements: [{ id: 'el-1', type: 'rect', data: {} }, { id: 'el-2', type: 'rect', data: {} }] },
        { socket, currentUser, queueUpdate }
      );

      expect(workspace.drawingOrder).toContain('el-2');
      expect(workspace.drawingOrder.filter(id => id === 'el-1').length).toBe(0);
    });
  });

  describe('handleWhiteboardClear', () => {
    it('should clear all drawings with permission', () => {
      const workspace = createMockWorkspace();
      workspace.drawingsMap.set('el-1', { id: 'el-1' });
      workspace.allDrawingsMap.set('el-1', { id: 'el-1' });
      workspace.drawingOrder.push('el-1');
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);

      const result = handleWhiteboardClear({ workspaceId: 'ws-1' }, { socket, currentUser });

      expect(result.success).toBe(true);
      expect(workspace.drawingsMap.size).toBe(0);
      expect(workspace.allDrawingsMap.size).toBe(0);
      expect(workspace.drawingOrder.length).toBe(0);
    });

    it('should broadcast WHITEBOARD_CLEAR event', () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);

      handleWhiteboardClear({ workspaceId: 'ws-1' }, { socket, currentUser });

      expect(socket.broadcast.to).toHaveBeenCalledWith('ws-1');
    });

    it('should reject if workspace not found', () => {
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(null);

      const result = handleWhiteboardClear({ workspaceId: 'ws-1' }, { socket, currentUser });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('workspace_not_found');
    });

    it('should reject if no write permission', () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);
      vi.mocked(permissionService.checkWritePermission).mockReturnValue(false);

      const result = handleWhiteboardClear({ workspaceId: 'ws-1' }, { socket, currentUser });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('no_permission');
      expect(socket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ERROR, { message: 'You do not have permission to clear' });
    });
  });

  describe('handleDeleteElement', () => {
    it('should delete element with permission', () => {
      const workspace = createMockWorkspace();
      workspace.drawingsMap.set('el-1', { id: 'el-1' });
      workspace.allDrawingsMap.set('el-1', { id: 'el-1' });
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);

      const result = handleDeleteElement({ workspaceId: 'ws-1', elementId: 'el-1' }, { socket, currentUser });

      expect(result.success).toBe(true);
      expect(workspace.drawingsMap.has('el-1')).toBe(false);
      expect(workspace.allDrawingsMap.has('el-1')).toBe(false);
    });

    it('should broadcast DELETE_ELEMENT event', () => {
      const workspace = createMockWorkspace();
      workspace.drawingsMap.set('el-1', { id: 'el-1' });
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);

      handleDeleteElement({ workspaceId: 'ws-1', elementId: 'el-1' }, { socket, currentUser });

      expect(socket.broadcast.to).toHaveBeenCalledWith('ws-1');
    });

    it('should reject if workspace not found', () => {
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(null);

      const result = handleDeleteElement({ workspaceId: 'ws-1', elementId: 'el-1' }, { socket, currentUser });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('workspace_not_found');
    });

    it('should reject if elementId is missing', () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);

      const result = handleDeleteElement({ workspaceId: 'ws-1', elementId: null }, { socket, currentUser });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('invalid_input');
    });

    it('should reject if no write permission', () => {
      const workspace = createMockWorkspace();
      workspace.drawingsMap.set('el-1', { id: 'el-1' });
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);
      vi.mocked(permissionService.checkWritePermission).mockReturnValue(false);

      const result = handleDeleteElement({ workspaceId: 'ws-1', elementId: 'el-1' }, { socket, currentUser });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('no_permission');
    });
  });

  describe('handleDeleteDiagram', () => {
    it('should delete diagram with permission', () => {
      const workspace = createMockWorkspace();
      workspace.diagrams.set('diag-1', { id: 'diag-1' });
      workspace.drawingsMap.set('diag-1', { id: 'diag-1' });
      workspace.allDrawingsMap.set('diag-1', { id: 'diag-1' });
      workspace.drawingOrder.push('diag-1');
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);

      const result = handleDeleteDiagram({ workspaceId: 'ws-1', diagramId: 'diag-1' }, { socket, currentUser });

      expect(result.success).toBe(true);
      expect(workspace.diagrams.has('diag-1')).toBe(false);
      expect(workspace.drawingsMap.has('diag-1')).toBe(false);
      expect(workspace.allDrawingsMap.has('diag-1')).toBe(false);
      expect(workspace.drawingOrder).not.toContain('diag-1');
    });

    it('should broadcast DELETE_DIAGRAM event', () => {
      const workspace = createMockWorkspace();
      workspace.diagrams.set('diag-1', { id: 'diag-1' });
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);

      handleDeleteDiagram({ workspaceId: 'ws-1', diagramId: 'diag-1' }, { socket, currentUser });

      expect(socket.broadcast.to).toHaveBeenCalledWith('ws-1');
    });

    it('should reject if no write permission', () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);
      vi.mocked(permissionService.checkWritePermission).mockReturnValue(false);

      const result = handleDeleteDiagram({ workspaceId: 'ws-1', diagramId: 'diag-1' }, { socket, currentUser });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('no_permission');
    });
  });

  describe('handleCodeUpdate', () => {
    it('should update code with valid content', () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);

      const result = handleCodeUpdate(
        { workspaceId: 'ws-1', language: 'javascript', content: 'console.log("test")' },
        { socket, currentUser }
      );

      expect(result.success).toBe(true);
      expect(workspace.codeSnippets).toEqual({ language: 'javascript', content: 'console.log("test")' });
    });

    it('should broadcast CODE_UPDATE event', () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);

      handleCodeUpdate(
        { workspaceId: 'ws-1', language: 'javascript', content: 'code' },
        { socket, currentUser }
      );

      expect(socket.broadcast.to).toHaveBeenCalledWith('ws-1');
    });

    it('should reject if content is not string', () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);

      const result = handleCodeUpdate(
        { workspaceId: 'ws-1', language: 'javascript', content: 12345 },
        { socket, currentUser }
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe('invalid_content');
      expect(socket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ERROR, { message: 'Invalid code content' });
    });

    it('should reject if content exceeds MAX_CODE_LENGTH', () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);
      const hugeContent = 'x'.repeat(MAX_CODE_LENGTH + 1);

      const result = handleCodeUpdate(
        { workspaceId: 'ws-1', language: 'javascript', content: hugeContent },
        { socket, currentUser }
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe('invalid_content');
    });

    it('should reject if no write permission', () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);
      vi.mocked(permissionService.checkWritePermission).mockReturnValue(false);

      const result = handleCodeUpdate(
        { workspaceId: 'ws-1', language: 'javascript', content: 'code' },
        { socket, currentUser }
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe('no_permission');
    });

    it('should accept content at exactly MAX_CODE_LENGTH', () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);
      const maxContent = 'x'.repeat(MAX_CODE_LENGTH);

      const result = handleCodeUpdate(
        { workspaceId: 'ws-1', language: 'javascript', content: maxContent },
        { socket, currentUser }
      );

      expect(result.success).toBe(true);
    });
  });

  describe('handleDiagramUpdate', () => {
    it('should update diagram with valid content', () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);

      const result = handleDiagramUpdate(
        { workspaceId: 'ws-1', content: 'graph TD\n  A-->B' },
        { socket, currentUser }
      );

      expect(result.success).toBe(true);
      expect(workspace.diagramContent).toBe('graph TD\n  A-->B');
    });

    it('should emit to room (excluding sender)', () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);

      handleDiagramUpdate(
        { workspaceId: 'ws-1', content: 'graph' },
        { socket, currentUser }
      );

      expect(socket.to).toHaveBeenCalledWith('ws-1');
    });

    it('should reject if content exceeds MAX_DIAGRAM_LENGTH', () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);
      const hugeContent = 'x'.repeat(MAX_DIAGRAM_LENGTH + 1);

      const result = handleDiagramUpdate(
        { workspaceId: 'ws-1', content: hugeContent },
        { socket, currentUser }
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe('invalid_content');
    });

    it('should reject if content is not string', () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);

      const result = handleDiagramUpdate(
        { workspaceId: 'ws-1', content: { mermaid: 'graph' } },
        { socket, currentUser }
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe('invalid_content');
    });

    it('should reject if no write permission', () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);
      vi.mocked(permissionService.checkWritePermission).mockReturnValue(false);

      const result = handleDiagramUpdate(
        { workspaceId: 'ws-1', content: 'graph' },
        { socket, currentUser }
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe('no_permission');
    });
  });

  describe('handleGetEditToken', () => {
    it('should return edit token for owner', () => {
      const workspace = createMockWorkspace({ editToken: 'edit_secret' });
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);
      currentUser.userId = 'owner-123';
      vi.mocked(permissionService.checkOwnership).mockReturnValue(true);
      const callback = vi.fn();

      const result = handleGetEditToken({ workspaceId: 'ws-1' }, callback, { currentUser });

      expect(result.success).toBe(true);
      expect(callback).toHaveBeenCalledWith({ editToken: 'edit_secret' });
    });

    it('should return edit token for user verified by checkOwnership', () => {
      const workspace = createMockWorkspace({ editToken: 'edit_secret' });
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);
      currentUser.userId = 'owner-123';
      vi.mocked(permissionService.checkOwnership).mockReturnValue(true);
      const callback = vi.fn();

      const result = handleGetEditToken({ workspaceId: 'ws-1' }, callback, { currentUser });

      expect(result.success).toBe(true);
      expect(callback).toHaveBeenCalledWith({ editToken: 'edit_secret' });
    });

    it('should reject if not owner', () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);
      currentUser.isOwner = false;
      vi.mocked(permissionService.checkOwnership).mockReturnValue(false);
      const callback = vi.fn();

      const result = handleGetEditToken({ workspaceId: 'ws-1' }, callback, { currentUser });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('not_owner');
      expect(callback).toHaveBeenCalledWith({ error: 'Permission denied' });
    });

    it('should handle workspace not found', () => {
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(null);
      const callback = vi.fn();

      const result = handleGetEditToken({ workspaceId: 'ws-1' }, callback, { currentUser });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('workspace_not_found');
      expect(callback).toHaveBeenCalledWith({ error: 'Workspace not found' });
    });

    it('should handle null edit token', () => {
      const workspace = createMockWorkspace({ editToken: null });
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);
      vi.mocked(permissionService.checkOwnership).mockReturnValue(true);
      const callback = vi.fn();

      handleGetEditToken({ workspaceId: 'ws-1' }, callback, { currentUser });

      expect(callback).toHaveBeenCalledWith({ editToken: null });
    });
  });

  describe('handleSetEditToken', () => {
    it('should set edit token for owner', () => {
      const workspace = createMockWorkspace({ editToken: null });
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);
      vi.mocked(permissionService.checkOwnership).mockReturnValue(true);

      const result = handleSetEditToken(
        { workspaceId: 'ws-1', editToken: 'edit_newtoken' },
        { socket, io, currentUser }
      );

      expect(result.success).toBe(true);
      expect(workspace.editToken).toBe('edit_newtoken');
    });

    it('should emit EDIT_TOKEN_UPDATED event to owner socket', () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);
      vi.mocked(permissionService.checkOwnership).mockReturnValue(true);

      handleSetEditToken(
        { workspaceId: 'ws-1', editToken: 'edit_newtoken' },
        { socket, io, currentUser }
      );

      // SECURITY: Token should only be emitted to owner's socket, not broadcast to all users
      expect(socket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.EDIT_TOKEN_UPDATED, { editToken: 'edit_newtoken' });
    });

    it('should reject if not owner', () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);
      currentUser.isOwner = false;
      vi.mocked(permissionService.checkOwnership).mockReturnValue(false);

      const result = handleSetEditToken(
        { workspaceId: 'ws-1', editToken: 'edit_token' },
        { socket, io, currentUser }
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe('not_owner');
    });

    it('should reject token not starting with edit_', () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);
      vi.mocked(permissionService.checkOwnership).mockReturnValue(true);

      const result = handleSetEditToken(
        { workspaceId: 'ws-1', editToken: 'invalid_token' },
        { socket, io, currentUser }
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe('invalid_token_format');
    });

    it('should reject null token', () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);
      vi.mocked(permissionService.checkOwnership).mockReturnValue(true);

      const result = handleSetEditToken(
        { workspaceId: 'ws-1', editToken: null },
        { socket, io, currentUser }
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe('invalid_token_format');
    });
  });

  describe('handleChangeSharingMode', () => {
    it('should change sharing mode for owner', () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);
      vi.mocked(permissionService.checkOwnership).mockReturnValue(true);

      const result = handleChangeSharingMode(
        { workspaceId: 'ws-1', sharingMode: SHARING_MODES.READ_WRITE_ALL },
        { socket, io, currentUser }
      );

      expect(result.success).toBe(true);
      expect(workspaceService.updateSharingMode).toHaveBeenCalledWith('ws-1', SHARING_MODES.READ_WRITE_ALL);
    });

    it('should broadcast SHARING_MODE_CHANGED event', () => {
      const workspace = createMockWorkspace({ editToken: 'edit_token' });
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);
      vi.mocked(permissionService.checkOwnership).mockReturnValue(true);

      handleChangeSharingMode(
        { workspaceId: 'ws-1', sharingMode: SHARING_MODES.READ_ONLY },
        { socket, io, currentUser }
      );

      expect(io.to).toHaveBeenCalledWith('ws-1');
      // SECURITY: editToken is no longer included in broadcast
      expect(io._toEmit).toHaveBeenCalledWith(SOCKET_EVENTS.SHARING_MODE_CHANGED, {
        sharingMode: SHARING_MODES.READ_ONLY
      });
    });

    it('should reject if not owner', () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);
      vi.mocked(permissionService.checkOwnership).mockReturnValue(false);

      const result = handleChangeSharingMode(
        { workspaceId: 'ws-1', sharingMode: SHARING_MODES.READ_ONLY },
        { socket, io, currentUser }
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe('not_owner');
      expect(socket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ERROR, { message: 'Only the workspace owner can change sharing mode' });
    });

    it('should reject invalid sharing mode', () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);
      vi.mocked(permissionService.checkOwnership).mockReturnValue(true);

      const result = handleChangeSharingMode(
        { workspaceId: 'ws-1', sharingMode: 'invalid-mode' },
        { socket, io, currentUser }
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe('invalid_mode');
      expect(socket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ERROR, { message: 'Invalid sharing mode' });
    });

    it('should handle workspace not found', () => {
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(null);

      const result = handleChangeSharingMode(
        { workspaceId: 'ws-1', sharingMode: SHARING_MODES.READ_ONLY },
        { socket, io, currentUser }
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe('workspace_not_found');
    });

    it('should accept all valid sharing modes', () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);
      vi.mocked(permissionService.checkOwnership).mockReturnValue(true);

      for (const mode of Object.values(SHARING_MODES)) {
        const result = handleChangeSharingMode(
          { workspaceId: 'ws-1', sharingMode: mode },
          { socket, io, currentUser }
        );
        expect(result.success).toBe(true);
      }
    });
  });

  describe('handleEndSession', () => {
    it('should end session for owner', () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);
      vi.mocked(permissionService.checkOwnership).mockReturnValue(true);
      vi.mocked(workspaceService.getActiveConnections).mockReturnValue([]);

      const result = handleEndSession({ workspaceId: 'ws-1' }, { socket, io, currentUser });

      expect(result.success).toBe(true);
    });

    it('should emit SESSION_ENDED to all clients', () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);
      vi.mocked(permissionService.checkOwnership).mockReturnValue(true);

      handleEndSession({ workspaceId: 'ws-1' }, { socket, io, currentUser });

      expect(io.to).toHaveBeenCalledWith('ws-1');
      expect(io._toEmit).toHaveBeenCalledWith(SOCKET_EVENTS.SESSION_ENDED, { message: 'The workspace owner has ended this session' });
    });

    it('should disconnect other clients from workspace', () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);
      vi.mocked(permissionService.checkOwnership).mockReturnValue(true);

      const otherSocket = { id: 'other-socket', leave: vi.fn() };
      io.sockets.sockets.set('other-socket', otherSocket);
      vi.mocked(workspaceService.getActiveConnections).mockReturnValue(['other-socket', 'socket-123']);

      const result = handleEndSession({ workspaceId: 'ws-1' }, { socket, io, currentUser });

      expect(otherSocket.leave).toHaveBeenCalledWith('ws-1');
      expect(result.disconnectedClients).toContain('other-socket');
    });

    it('should not disconnect owner socket', () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);
      vi.mocked(permissionService.checkOwnership).mockReturnValue(true);

      const ownerSocketInMap = { id: 'socket-123', leave: vi.fn() };
      io.sockets.sockets.set('socket-123', ownerSocketInMap);
      vi.mocked(workspaceService.getActiveConnections).mockReturnValue(['socket-123']);

      handleEndSession({ workspaceId: 'ws-1' }, { socket, io, currentUser });

      expect(ownerSocketInMap.leave).not.toHaveBeenCalled();
    });

    it('should reject if not owner', () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);
      vi.mocked(permissionService.checkOwnership).mockReturnValue(false);

      const result = handleEndSession({ workspaceId: 'ws-1' }, { socket, io, currentUser });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('not_owner');
      expect(socket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ERROR, { message: 'Only the workspace owner can end the session' });
    });

    it('should handle workspace not found', () => {
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(null);

      const result = handleEndSession({ workspaceId: 'ws-1' }, { socket, io, currentUser });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('workspace_not_found');
    });
  });

  describe('handleDisconnect', () => {
    it('should clean up user session', () => {
      currentWorkspaceRef.current = null;

      const result = handleDisconnect({ socket, io, currentWorkspaceRef });

      expect(result.success).toBe(true);
      expect(workspaceService.removeUserSession).toHaveBeenCalledWith('socket-123');
    });

    it('should remove connection from workspace', () => {
      const workspace = createMockWorkspace();
      currentWorkspaceRef.current = workspace;
      vi.mocked(workspaceService.findWorkspaceIdByRef).mockReturnValue('ws-1');

      handleDisconnect({ socket, io, currentWorkspaceRef });

      expect(workspaceService.removeConnection).toHaveBeenCalledWith('ws-1', 'socket-123');
    });

    it('should emit USER_LEFT event', () => {
      const workspace = createMockWorkspace();
      currentWorkspaceRef.current = workspace;
      vi.mocked(workspaceService.findWorkspaceIdByRef).mockReturnValue('ws-1');
      vi.mocked(workspaceService.getActiveUserCount).mockReturnValue(3);

      handleDisconnect({ socket, io, currentWorkspaceRef });

      expect(io.to).toHaveBeenCalledWith('ws-1');
      expect(io._toEmit).toHaveBeenCalledWith(SOCKET_EVENTS.USER_LEFT, { userId: 'socket-123', activeUsers: 3 });
    });

    it('should handle null currentWorkspace', () => {
      currentWorkspaceRef.current = null;

      const result = handleDisconnect({ socket, io, currentWorkspaceRef });

      expect(result.success).toBe(true);
      expect(workspaceService.removeConnection).not.toHaveBeenCalled();
    });

    it('should handle workspace not found by ref', () => {
      const workspace = createMockWorkspace();
      currentWorkspaceRef.current = workspace;
      vi.mocked(workspaceService.findWorkspaceIdByRef).mockReturnValue(null);

      const result = handleDisconnect({ socket, io, currentWorkspaceRef });

      expect(result.success).toBe(true);
      expect(workspaceService.removeConnection).not.toHaveBeenCalled();
    });
  });

  describe('handleInviteUser', () => {
    it('should generate userId from email', () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);
      vi.mocked(permissionService.checkOwnership).mockReturnValue(true);
      const callback = vi.fn();

      const result = handleInviteUser(
        { workspaceId: 'ws-1', email: 'Test.User@Example.com' },
        callback,
        { socket, currentUser, io }
      );

      expect(result.success).toBe(true);
      expect(callback).toHaveBeenCalledWith({ userId: 'test-user-example-com' });
    });

    it('should reject if email is not string', () => {
      const callback = vi.fn();

      const result = handleInviteUser(
        { workspaceId: 'ws-1', email: 12345 },
        callback,
        { socket, currentUser, io }
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe('invalid_email');
      expect(callback).toHaveBeenCalledWith({ error: 'Invalid email format' });
    });

    it('should handle workspace not found', () => {
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(null);
      const callback = vi.fn();

      const result = handleInviteUser(
        { workspaceId: 'ws-1', email: 'test@example.com' },
        callback,
        { socket, currentUser, io }
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe('workspace_not_found');
      expect(callback).toHaveBeenCalledWith({ error: 'Workspace not found' });
    });

    it('should handle special characters in email', () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);
      vi.mocked(permissionService.checkOwnership).mockReturnValue(true);
      const callback = vi.fn();

      handleInviteUser(
        { workspaceId: 'ws-1', email: 'user+tag@example.com' },
        callback,
        { socket, currentUser, io }
      );

      expect(callback).toHaveBeenCalledWith({ userId: 'user-tag-example-com' });
    });
  });

  describe('security: permission checks', () => {
    it('should always check write permission before whiteboard update', () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);
      vi.mocked(permissionService.checkWritePermission).mockReturnValue(false);

      handleWhiteboardUpdate(
        { workspaceId: 'ws-1', elements: [{ id: 'el-1' }] },
        { socket, currentUser, queueUpdate }
      );

      expect(permissionService.checkWritePermission).toHaveBeenCalledWith(workspace, currentUser);
      expect(queueUpdate).not.toHaveBeenCalled();
    });

    it('should always check write permission before code update', () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);
      vi.mocked(permissionService.checkWritePermission).mockReturnValue(false);

      handleCodeUpdate(
        { workspaceId: 'ws-1', language: 'js', content: 'code' },
        { socket, currentUser }
      );

      expect(permissionService.checkWritePermission).toHaveBeenCalledWith(workspace, currentUser);
      expect(workspace.codeSnippets).toBeNull();
    });

    it('should always check ownership before changing sharing mode', () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);
      vi.mocked(permissionService.checkOwnership).mockReturnValue(false);

      handleChangeSharingMode(
        { workspaceId: 'ws-1', sharingMode: SHARING_MODES.READ_ONLY },
        { socket, io, currentUser }
      );

      expect(permissionService.checkOwnership).toHaveBeenCalledWith(workspace, currentUser.userId);
      expect(workspaceService.updateSharingMode).not.toHaveBeenCalled();
    });

    it('should always check ownership before ending session', () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);
      vi.mocked(permissionService.checkOwnership).mockReturnValue(false);

      handleEndSession({ workspaceId: 'ws-1' }, { socket, io, currentUser });

      expect(permissionService.checkOwnership).toHaveBeenCalledWith(workspace, currentUser.userId);
    });
  });

  describe('input validation', () => {
    it('should validate elements array in whiteboard update', () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);

      const result1 = handleWhiteboardUpdate({ workspaceId: 'ws-1', elements: null }, { socket, currentUser, queueUpdate });
      expect(result1.success).toBe(false);

      const result2 = handleWhiteboardUpdate({ workspaceId: 'ws-1', elements: {} }, { socket, currentUser, queueUpdate });
      expect(result2.success).toBe(false);

      const result3 = handleWhiteboardUpdate({ workspaceId: 'ws-1', elements: 'string' }, { socket, currentUser, queueUpdate });
      expect(result3.success).toBe(false);
    });

    it('should validate content type in code update', () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);

      const result1 = handleCodeUpdate({ workspaceId: 'ws-1', language: 'js', content: null }, { socket, currentUser });
      expect(result1.success).toBe(false);

      const result2 = handleCodeUpdate({ workspaceId: 'ws-1', language: 'js', content: undefined }, { socket, currentUser });
      expect(result2.success).toBe(true);

      const result3 = handleCodeUpdate({ workspaceId: 'ws-1', language: 'js', content: [] }, { socket, currentUser });
      expect(result3.success).toBe(false);
    });

    it('should validate content length in diagram update', () => {
      const workspace = createMockWorkspace();
      vi.mocked(workspaceService.getWorkspace).mockReturnValue(workspace);

      const validContent = 'x'.repeat(MAX_DIAGRAM_LENGTH);
      const result1 = handleDiagramUpdate({ workspaceId: 'ws-1', content: validContent }, { socket, currentUser });
      expect(result1.success).toBe(true);

      const invalidContent = 'x'.repeat(MAX_DIAGRAM_LENGTH + 1);
      const result2 = handleDiagramUpdate({ workspaceId: 'ws-1', content: invalidContent }, { socket, currentUser });
      expect(result2.success).toBe(false);
    });
  });
});
