import { SOCKET_EVENTS, SHARING_MODES } from '../config.js';
import * as workspaceService from '../services/workspaceService.js';
import * as permissionService from '../services/permissionService.js';

export const MAX_ELEMENTS_PER_UPDATE = 100;
export const MAX_CODE_LENGTH = 500000;
export const MAX_DIAGRAM_LENGTH = 100000;
export const MAX_DRAWINGS = 5000;

export function handleJoinWorkspace(
  { workspaceId, userId, accessToken },
  { socket, io, currentUser, currentWorkspaceRef }
) {
  try {
    let workspace = workspaceService.getWorkspace(workspaceId);
    let isNewWorkspace = false;

    if (!workspace) {
      isNewWorkspace = true;
      workspace = workspaceService.createWorkspace(workspaceId, userId || socket.id);
    }

    currentUser.userId = userId || socket.id;
    currentUser.workspaceId = workspaceId;

    const { hasEditAccess, isOwner } = permissionService.calculateEditAccess(workspace, currentUser, accessToken);
    currentUser.hasEditAccess = hasEditAccess;
    currentUser.isOwner = isNewWorkspace || isOwner;

    if (isNewWorkspace) {
      workspace.owner = currentUser.userId;
      currentUser.hasEditAccess = true;
    }

    permissionService.validateAndSetToken(workspace, accessToken, currentUser);

    if (currentWorkspaceRef.current) {
      const prevWorkspaceId = workspaceService.findWorkspaceIdByRef(currentWorkspaceRef.current);
      if (prevWorkspaceId) {
        socket.leave(prevWorkspaceId);
        workspaceService.removeConnection(prevWorkspaceId, socket.id);
        const activeUsers = workspaceService.getActiveUserCount(prevWorkspaceId);
        io.to(prevWorkspaceId).emit(SOCKET_EVENTS.USER_LEFT, { userId: socket.id, activeUsers });
      }
    }

    workspaceService.addConnection(workspaceId, socket.id);
    const activeUsers = workspaceService.getActiveUserCount(workspaceId);
    socket.join(workspaceId);
    currentWorkspaceRef.current = workspace;
    workspaceService.updateLastActivity(workspaceId);

    socket.emit(SOCKET_EVENTS.WORKSPACE_STATE, {
      ...workspaceService.getWorkspaceState(workspaceId),
      isNewWorkspace
    });
    socket.emit(SOCKET_EVENTS.SHARING_INFO, permissionService.getSharingInfo(workspace, currentUser));
    io.to(workspaceId).emit(SOCKET_EVENTS.USER_JOINED, { userId: socket.id, activeUsers });

    return { success: true, workspace, isNewWorkspace };
  } catch (error) {
    socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to join workspace' });
    return { success: false, error };
  }
}

export function handleWhiteboardUpdate(
  { workspaceId, elements },
  { socket, currentUser, queueUpdate }
) {
  try {
    const workspace = workspaceService.getWorkspace(workspaceId);
    if (!workspace || !Array.isArray(elements)) {
      return { success: false, reason: 'invalid_input' };
    }

    if (elements.length > MAX_ELEMENTS_PER_UPDATE) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Too many elements in single update' });
      return { success: false, reason: 'too_many_elements' };
    }

    if (!permissionService.checkWritePermission(workspace, currentUser)) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'You do not have permission to edit' });
      return { success: false, reason: 'no_permission' };
    }

    workspaceService.updateLastActivity(workspaceId);

    const drawingsMap = workspace.drawingsMap;
    const allDrawingsMap = workspace.allDrawingsMap;
    const drawingOrder = workspace.drawingOrder;

    elements.forEach(element => {
      if (element?.id) {
        const newElement = { ...element, timestamp: Date.now() };
        const isNew = !drawingsMap.has(element.id);
        drawingsMap.set(element.id, newElement);
        allDrawingsMap.set(element.id, newElement);
        if (isNew) {
          drawingOrder.push(element.id);
        }
      }
    });

    while (allDrawingsMap.size > MAX_DRAWINGS && drawingOrder.length > 0) {
      const oldestId = drawingOrder.shift();
      allDrawingsMap.delete(oldestId);
    }

    queueUpdate(workspaceId, elements, socket.id);
    return { success: true };
  } catch (error) {
    socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to update whiteboard' });
    return { success: false, error };
  }
}

export function handleWhiteboardClear({ workspaceId }, { socket, currentUser }) {
  try {
    const workspace = workspaceService.getWorkspace(workspaceId);
    if (!workspace) {
      return { success: false, reason: 'workspace_not_found' };
    }

    if (!permissionService.checkWritePermission(workspace, currentUser)) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'You do not have permission to clear' });
      return { success: false, reason: 'no_permission' };
    }

    workspaceService.updateLastActivity(workspaceId);
    workspace.drawings = [];
    workspace.allDrawings = [];
    workspace.drawingsMap.clear();
    workspace.allDrawingsMap.clear();
    workspace.drawingOrder.length = 0;
    socket.broadcast.to(workspaceId).emit(SOCKET_EVENTS.WHITEBOARD_CLEAR);

    return { success: true };
  } catch (error) {
    socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to clear whiteboard' });
    return { success: false, error };
  }
}

export function handleDeleteElement({ workspaceId, elementId }, { socket, currentUser }) {
  try {
    const workspace = workspaceService.getWorkspace(workspaceId);
    if (!workspace || !elementId) {
      return { success: false, reason: 'invalid_input' };
    }

    if (!permissionService.checkWritePermission(workspace, currentUser)) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'You do not have permission to delete' });
      return { success: false, reason: 'no_permission' };
    }

    workspaceService.updateLastActivity(workspaceId);

    workspace.drawingsMap.delete(elementId);
    workspace.allDrawingsMap.delete(elementId);

    socket.broadcast.to(workspaceId).emit(SOCKET_EVENTS.DELETE_ELEMENT, { workspaceId, elementId });

    return { success: true };
  } catch (error) {
    socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to delete element' });
    return { success: false, error };
  }
}

export function handleDeleteDiagram({ workspaceId, diagramId }, { socket, currentUser }) {
  try {
    const workspace = workspaceService.getWorkspace(workspaceId);
    if (!workspace) {
      return { success: false, reason: 'workspace_not_found' };
    }

    if (!permissionService.checkWritePermission(workspace, currentUser)) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'You do not have permission to delete diagram' });
      return { success: false, reason: 'no_permission' };
    }

    workspaceService.updateLastActivity(workspaceId);
    workspace.diagrams.delete(diagramId);
    workspace.drawings = workspace.drawings.filter(el => el.id !== diagramId);
    socket.broadcast.to(workspaceId).emit(SOCKET_EVENTS.DELETE_DIAGRAM, { diagramId });

    return { success: true };
  } catch (error) {
    socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to delete diagram' });
    return { success: false, error };
  }
}

export function handleCodeUpdate({ workspaceId, language, content }, { socket, currentUser }) {
  try {
    const workspace = workspaceService.getWorkspace(workspaceId);
    if (!workspace) {
      return { success: false, reason: 'workspace_not_found' };
    }

    if (typeof content !== 'string' || content.length > MAX_CODE_LENGTH) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid code content' });
      return { success: false, reason: 'invalid_content' };
    }

    if (!permissionService.checkWritePermission(workspace, currentUser)) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'You do not have permission to edit code' });
      return { success: false, reason: 'no_permission' };
    }

    workspaceService.updateLastActivity(workspaceId);
    workspace.codeSnippets = { language, content };
    socket.broadcast.to(workspaceId).emit(SOCKET_EVENTS.CODE_UPDATE, { language, content });

    return { success: true };
  } catch (error) {
    socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to update code' });
    return { success: false, error };
  }
}

export function handleDiagramUpdate({ workspaceId, content }, { socket, currentUser }) {
  try {
    const workspace = workspaceService.getWorkspace(workspaceId);
    if (!workspace) {
      return { success: false, reason: 'workspace_not_found' };
    }

    if (typeof content !== 'string' || content.length > MAX_DIAGRAM_LENGTH) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid diagram content' });
      return { success: false, reason: 'invalid_content' };
    }

    if (!permissionService.checkWritePermission(workspace, currentUser)) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'You do not have permission to edit diagram' });
      return { success: false, reason: 'no_permission' };
    }

    workspaceService.updateLastActivity(workspaceId);
    workspace.diagramContent = content;
    socket.to(workspaceId).emit(SOCKET_EVENTS.DIAGRAM_UPDATE, { content });

    return { success: true };
  } catch (error) {
    socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to update diagram' });
    return { success: false, error };
  }
}

export function handleGetEditToken({ workspaceId }, callback, { currentUser }) {
  try {
    const workspace = workspaceService.getWorkspace(workspaceId);
    if (!workspace) {
      callback?.({ error: 'Workspace not found' });
      return { success: false, reason: 'workspace_not_found' };
    }

    if (!permissionService.checkOwnership(workspace, currentUser.userId) && !currentUser.isOwner) {
      callback?.({ error: 'Permission denied' });
      return { success: false, reason: 'not_owner' };
    }

    callback?.({ editToken: workspace.editToken || null });
    return { success: true, editToken: workspace.editToken };
  } catch (error) {
    callback?.({ error: 'Failed to get edit token' });
    return { success: false, error };
  }
}

export function handleSetEditToken({ workspaceId, editToken }, { socket, io, currentUser }) {
  try {
    const workspace = workspaceService.getWorkspace(workspaceId);
    if (!workspace) {
      return { success: false, reason: 'workspace_not_found' };
    }

    if (!permissionService.checkOwnership(workspace, currentUser.userId) && !currentUser.isOwner) {
      return { success: false, reason: 'not_owner' };
    }

    if (editToken?.startsWith('edit_')) {
      workspace.editToken = editToken;
      io.to(workspaceId).emit(SOCKET_EVENTS.EDIT_TOKEN_UPDATED, { editToken });
      return { success: true };
    }

    return { success: false, reason: 'invalid_token_format' };
  } catch (error) {
    socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to set edit token' });
    return { success: false, error };
  }
}

export function handleChangeSharingMode({ workspaceId, sharingMode }, { socket, io, currentUser }) {
  try {
    const workspace = workspaceService.getWorkspace(workspaceId);
    if (!workspace) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Workspace not found' });
      return { success: false, reason: 'workspace_not_found' };
    }

    if (!permissionService.checkOwnership(workspace, currentUser.userId)) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Only the workspace owner can change sharing mode' });
      return { success: false, reason: 'not_owner' };
    }

    const validModes = Object.values(SHARING_MODES);
    if (!validModes.includes(sharingMode)) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid sharing mode' });
      return { success: false, reason: 'invalid_mode' };
    }

    const success = workspaceService.updateSharingMode(workspaceId, sharingMode);
    if (success) {
      io.to(workspaceId).emit(SOCKET_EVENTS.SHARING_MODE_CHANGED, {
        sharingMode,
        editToken: workspace.editToken
      });
      return { success: true };
    }

    return { success: false, reason: 'update_failed' };
  } catch (error) {
    socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to change sharing mode' });
    return { success: false, error };
  }
}

export function handleEndSession({ workspaceId }, { socket, io, currentUser }) {
  try {
    const workspace = workspaceService.getWorkspace(workspaceId);
    if (!workspace) {
      return { success: false, reason: 'workspace_not_found' };
    }

    if (!permissionService.checkOwnership(workspace, currentUser.userId)) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Only the workspace owner can end the session' });
      return { success: false, reason: 'not_owner' };
    }

    io.to(workspaceId).emit(SOCKET_EVENTS.SESSION_ENDED, { message: 'The workspace owner has ended this session' });

    const connections = workspaceService.getActiveConnections(workspaceId);
    const disconnectedClients = [];
    for (const socketId of connections) {
      const clientSocket = io.sockets?.sockets?.get(socketId);
      if (clientSocket && clientSocket.id !== socket.id) {
        clientSocket.leave(workspaceId);
        disconnectedClients.push(socketId);
      }
    }

    return { success: true, disconnectedClients };
  } catch (error) {
    socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to end session' });
    return { success: false, error };
  }
}

export function handleDisconnect({ socket, io, currentWorkspaceRef }) {
  try {
    if (currentWorkspaceRef.current) {
      const workspaceId = workspaceService.findWorkspaceIdByRef(currentWorkspaceRef.current);
      if (workspaceId) {
        workspaceService.removeConnection(workspaceId, socket.id);
        const activeUsers = workspaceService.getActiveUserCount(workspaceId);
        io.to(workspaceId).emit(SOCKET_EVENTS.USER_LEFT, { userId: socket.id, activeUsers });
      }
    }

    workspaceService.removeUserSession(socket.id);
    return { success: true };
  } catch (error) {
    return { success: false, error };
  }
}

export function handleInviteUser({ workspaceId, email }, callback) {
  try {
    if (typeof email !== 'string') {
      callback?.({ error: 'Invalid email' });
      return { success: false, reason: 'invalid_email' };
    }

    const workspace = workspaceService.getWorkspace(workspaceId);
    if (!workspace) {
      callback?.({ error: 'Workspace not found' });
      return { success: false, reason: 'workspace_not_found' };
    }

    const userId = email.toLowerCase().replace(/[^a-z0-9]/g, '-');
    callback?.({ userId });
    return { success: true, userId };
  } catch (error) {
    callback?.({ error: 'Failed to invite user' });
    return { success: false, error };
  }
}
