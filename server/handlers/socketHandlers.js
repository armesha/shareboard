import { SOCKET_EVENTS, SHARING_MODES } from '../config.js';
import * as workspaceService from '../services/workspaceService.js';
import * as permissionService from '../services/permissionService.js';
import { withWorkspaceAuth, withOwnerAuth } from '../middleware/socketAuth.js';

// Set to track workspaces currently being created (for race condition prevention)
const workspacesBeingCreated = new Set();

const WORKSPACE_ID_REGEX = /^[a-zA-Z0-9_-]{1,32}$/;
function isValidWorkspaceId(id) {
  return typeof id === 'string' && WORKSPACE_ID_REGEX.test(id);
}

const ELEMENT_TYPES = new Set([
  'rect',
  'circle',
  'triangle',
  'line',
  'arrow',
  'path',
  'text',
  'diagram',
  'polygon',
  'star',
  'diamond',
  'pentagon',
  'hexagon',
  'octagon',
  'cross'
]);

const MAX_ELEMENT_ID_LENGTH = 100;
const MAX_TEXT_LENGTH = 2000;
const MAX_SRC_LENGTH = 512000;

function isValidElementData(data) {
  if (typeof data !== 'object' || data === null) return false;
  const numericKeys = [
    'left', 'top', 'width', 'height', 'scaleX', 'scaleY',
    'angle', 'strokeWidth', 'fontSize', 'x1', 'y1', 'x2', 'y2'
  ];
  for (const key of numericKeys) {
    if (data[key] !== undefined && (typeof data[key] !== 'number' || !Number.isFinite(data[key]))) {
      return false;
    }
  }
  if (data.text !== undefined && (typeof data.text !== 'string' || data.text.length > MAX_TEXT_LENGTH)) {
    return false;
  }
  if (data.src !== undefined && (typeof data.src !== 'string' || data.src.length > MAX_SRC_LENGTH)) {
    return false;
  }
  return true;
}

function isValidElement(element) {
  if (typeof element !== 'object' || element === null) return false;
  if (typeof element.id !== 'string' || element.id.length === 0 || element.id.length > MAX_ELEMENT_ID_LENGTH) return false;
  if (!ELEMENT_TYPES.has(element.type)) return false;
  if (!isValidElementData(element.data)) return false;
  return true;
}

export const MAX_ELEMENTS_PER_UPDATE = 100;
export const MAX_CODE_LENGTH = 500000;
export const MAX_DIAGRAM_LENGTH = 100000;
export const MAX_DRAWINGS = 5000;
export const MAX_USERS_PER_WORKSPACE = 100;
export const MAX_LANGUAGE_LENGTH = 32;

// Basic email format validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isValidEmail(email) {
  return typeof email === 'string' && email.length <= 254 && EMAIL_REGEX.test(email);
}

export async function handleJoinWorkspace(
  { workspaceId, userId, accessToken },
  { socket, io, currentUser, currentWorkspaceRef }
) {
  try {
    if (!isValidWorkspaceId(workspaceId)) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid workspace ID' });
      return { success: false, reason: 'invalid_workspace_id' };
    }
    currentUser.accessToken = accessToken || null;

    let workspace = workspaceService.getWorkspace(workspaceId);
    let isNewWorkspace = false;

    if (!workspace) {
      // Check if workspace is currently being created by another user (race condition prevention)
      if (workspacesBeingCreated.has(workspaceId)) {
        // Wait briefly and retry to get the workspace
        await new Promise(resolve => setTimeout(resolve, 50));
        workspace = workspaceService.getWorkspace(workspaceId);
        if (!workspace) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: 'Workspace creation in progress, please retry' });
          return { success: false, reason: 'workspace_creation_in_progress' };
        }
      } else {
        // Mark workspace as being created
        workspacesBeingCreated.add(workspaceId);
        try {
          // Double-check after acquiring the lock
          workspace = workspaceService.getWorkspace(workspaceId);
          if (!workspace) {
            isNewWorkspace = true;
            workspace = workspaceService.createWorkspace(workspaceId, userId || socket.id);
          }
        } finally {
          workspacesBeingCreated.delete(workspaceId);
        }
      }
    }

    // Check if workspace has reached maximum user limit
    if (!isNewWorkspace) {
      const currentUserCount = workspaceService.getActiveUserCount(workspaceId);
      if (currentUserCount >= MAX_USERS_PER_WORKSPACE) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          message: 'Workspace is full. Maximum of 100 users allowed per workspace.'
        });
        return { success: false, reason: 'workspace_full' };
      }
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

const handleWhiteboardUpdateCore = (
  { workspaceId, elements },
  { socket, workspace, queueUpdate }
) => {
  try {
    if (!isValidWorkspaceId(workspaceId)) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid workspace ID' });
      return { success: false, reason: 'invalid_workspace_id' };
    }

    if (!Array.isArray(elements)) {
      return { success: false, reason: 'invalid_input' };
    }

    if (elements.length > MAX_ELEMENTS_PER_UPDATE) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Too many elements in single update' });
      return { success: false, reason: 'too_many_elements' };
    }

    if (!elements.every(isValidElement)) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid element payload' });
      return { success: false, reason: 'invalid_element' };
    }

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
};

export const handleWhiteboardUpdate = withWorkspaceAuth(handleWhiteboardUpdateCore);

const handleWhiteboardClearCore = (
  { workspaceId },
  { socket, workspace }
) => {
  try {
    workspace.drawingsMap.clear();
    workspace.allDrawingsMap.clear();
    workspace.drawingOrder.length = 0;
    socket.broadcast.to(workspaceId).emit(SOCKET_EVENTS.WHITEBOARD_CLEAR);

    return { success: true };
  } catch (error) {
    socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to clear whiteboard' });
    return { success: false, error };
  }
};

export const handleWhiteboardClear = withWorkspaceAuth(handleWhiteboardClearCore, {
  permissionErrorMessage: 'You do not have permission to clear'
});

const handleDeleteElementCore = (
  { workspaceId, elementId },
  { socket, workspace }
) => {
  try {
    if (!elementId) {
      return { success: false, reason: 'invalid_input' };
    }

    workspace.drawingsMap.delete(elementId);
    workspace.allDrawingsMap.delete(elementId);
    // Also remove from drawingOrder array to maintain consistency
    const orderIndex = workspace.drawingOrder.indexOf(elementId);
    if (orderIndex !== -1) {
      workspace.drawingOrder.splice(orderIndex, 1);
    }

    socket.broadcast.to(workspaceId).emit(SOCKET_EVENTS.DELETE_ELEMENT, { workspaceId, elementId });

    return { success: true };
  } catch (error) {
    socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to delete element' });
    return { success: false, error };
  }
};

export const handleDeleteElement = withWorkspaceAuth(handleDeleteElementCore, {
  permissionErrorMessage: 'You do not have permission to delete'
});

const handleDeleteDiagramCore = (
  { workspaceId, diagramId },
  { socket, workspace }
) => {
  try {
    workspace.diagrams.delete(diagramId);
    // Also remove from drawing maps and order array if present
    workspace.drawingsMap.delete(diagramId);
    workspace.allDrawingsMap.delete(diagramId);
    const orderIndex = workspace.drawingOrder.indexOf(diagramId);
    if (orderIndex !== -1) {
      workspace.drawingOrder.splice(orderIndex, 1);
    }
    socket.broadcast.to(workspaceId).emit(SOCKET_EVENTS.DELETE_DIAGRAM, { diagramId });

    return { success: true };
  } catch (error) {
    socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to delete diagram' });
    return { success: false, error };
  }
};

export const handleDeleteDiagram = withWorkspaceAuth(handleDeleteDiagramCore, {
  permissionErrorMessage: 'You do not have permission to delete diagram'
});

const handleCodeUpdateCore = (
  { workspaceId, language, content },
  { socket, workspace }
) => {
  try {
    if (typeof content !== 'string' || content.length > MAX_CODE_LENGTH) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid code content' });
      return { success: false, reason: 'invalid_content' };
    }

    if (typeof language !== 'string' || language.length > MAX_LANGUAGE_LENGTH) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid language' });
      return { success: false, reason: 'invalid_language' };
    }

    workspace.codeSnippets = { language, content };
    socket.broadcast.to(workspaceId).emit(SOCKET_EVENTS.CODE_UPDATE, { language, content });

    return { success: true };
  } catch (error) {
    socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to update code' });
    return { success: false, error };
  }
};

export const handleCodeUpdate = withWorkspaceAuth(handleCodeUpdateCore, {
  permissionErrorMessage: 'You do not have permission to edit code'
});

const handleDiagramUpdateCore = (
  { workspaceId, content },
  { socket, workspace }
) => {
  try {
    if (typeof content !== 'string' || content.length > MAX_DIAGRAM_LENGTH) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid diagram content' });
      return { success: false, reason: 'invalid_content' };
    }

    workspace.diagramContent = content;
    socket.to(workspaceId).emit(SOCKET_EVENTS.DIAGRAM_UPDATE, { content });

    return { success: true };
  } catch (error) {
    socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to update diagram' });
    return { success: false, error };
  }
};

export const handleDiagramUpdate = withWorkspaceAuth(handleDiagramUpdateCore, {
  permissionErrorMessage: 'You do not have permission to edit diagram'
});

export function handleGetEditToken({ workspaceId }, callback, { currentUser }) {
  try {
    const workspace = workspaceService.getWorkspace(workspaceId);
    if (!workspace) {
      callback?.({ error: 'Workspace not found' });
      return { success: false, reason: 'workspace_not_found' };
    }

    // Use checkOwnership as single source of truth for ownership verification
    if (!permissionService.checkOwnership(workspace, currentUser.userId)) {
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

// Minimum token length: edit_ (5 chars) + 8 chars = 13 total
const MIN_EDIT_TOKEN_LENGTH = 13;

export function handleSetEditToken({ workspaceId, editToken }, { socket, currentUser }) {
  try {
    const workspace = workspaceService.getWorkspace(workspaceId);
    if (!workspace) {
      return { success: false, reason: 'workspace_not_found' };
    }

    // Use checkOwnership as single source of truth for ownership verification
    if (!permissionService.checkOwnership(workspace, currentUser.userId)) {
      return { success: false, reason: 'not_owner' };
    }

    // Validate token format and minimum length for security
    if (editToken?.startsWith('edit_') && editToken.length >= MIN_EDIT_TOKEN_LENGTH) {
      workspace.editToken = editToken;
      // SECURITY: Only emit token to the owner's socket, not to all users in the workspace
      socket.emit(SOCKET_EVENTS.EDIT_TOKEN_UPDATED, { editToken });
      return { success: true };
    }

    return { success: false, reason: 'invalid_token_format' };
  } catch (error) {
    socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to set edit token' });
    return { success: false, error };
  }
}

const handleChangeSharingModeCore = (
  { workspaceId, sharingMode },
  { socket, io }
) => {
  try {
    const validModes = Object.values(SHARING_MODES);
    if (!validModes.includes(sharingMode)) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid sharing mode' });
      return { success: false, reason: 'invalid_mode' };
    }

    const success = workspaceService.updateSharingMode(workspaceId, sharingMode);
    if (success) {
      // SECURITY: Do not include editToken in broadcast - it should only be known to the owner
      io.to(workspaceId).emit(SOCKET_EVENTS.SHARING_MODE_CHANGED, {
        sharingMode
      });
      return { success: true };
    }

    return { success: false, reason: 'update_failed' };
  } catch (error) {
    socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to change sharing mode' });
    return { success: false, error };
  }
};

export const handleChangeSharingMode = withOwnerAuth(handleChangeSharingModeCore, {
  errorMessage: 'Only the workspace owner can change sharing mode'
});

const handleEndSessionCore = (
  { workspaceId },
  { socket, io }
) => {
  try {
    io.to(workspaceId).emit(SOCKET_EVENTS.SESSION_ENDED, { message: 'The workspace owner has ended this session' });

    const connections = workspaceService.getActiveConnections(workspaceId);
    const disconnectedClients = [];
    for (const socketId of connections) {
      const clientSocket = io.sockets?.sockets?.get(socketId);
      if (clientSocket && clientSocket.id !== socket.id) {
        // Clean up connection state before removing from room to prevent stale state
        workspaceService.removeConnection(workspaceId, socketId);
        clientSocket.leave(workspaceId);
        disconnectedClients.push(socketId);
      }
    }

    return { success: true, disconnectedClients };
  } catch (error) {
    socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to end session' });
    return { success: false, error };
  }
};

export const handleEndSession = withOwnerAuth(handleEndSessionCore, {
  errorMessage: 'Only the workspace owner can end the session'
});

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

export function handleInviteUser({ workspaceId, email }, callback, { socket, currentUser, io }) {
  try {
    if (!isValidEmail(email)) {
      callback?.({ error: 'Invalid email format' });
      return { success: false, reason: 'invalid_email' };
    }

    const workspace = workspaceService.getWorkspace(workspaceId);
    if (!workspace) {
      callback?.({ error: 'Workspace not found' });
      return { success: false, reason: 'workspace_not_found' };
    }

    if (!permissionService.checkOwnership(workspace, currentUser.userId)) {
      callback?.({ error: 'Permission denied' });
      return { success: false, reason: 'not_owner' };
    }

    const userId = email.toLowerCase().replace(/[^a-z0-9]/g, '-');
    if (!workspace.allowedUsers.includes(userId)) {
      workspace.allowedUsers.push(userId);
    }
    workspaceService.updateLastActivity(workspaceId);

    const ownerInfo = permissionService.getSharingInfo(workspace, currentUser);
    if (socket) {
      socket.emit(SOCKET_EVENTS.SHARING_INFO, ownerInfo);
    }
    if (io) {
      io.to(workspaceId).emit(SOCKET_EVENTS.SHARING_MODE_CHANGED, {
        sharingMode: workspace.sharingMode,
        allowedUsers: workspace.allowedUsers
      });
    }
    callback?.({ userId });
    return { success: true, userId };
  } catch (error) {
    callback?.({ error: 'Failed to invite user' });
    return { success: false, error };
  }
}
