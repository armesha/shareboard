import { SOCKET_EVENTS } from '../../shared/constants.js';
import * as workspaceService from '../services/workspaceService.js';
import * as permissionService from '../services/permissionService.js';

export function withWorkspaceAuth(handler, options = {}) {
  const { permissionErrorMessage = 'You do not have permission to edit' } = options;

  return function wrappedHandler(data, context) {
    const { workspaceId } = data;
    const { socket, currentUser } = context;

    if (!socket.rooms.has(workspaceId)) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Not authorized for this workspace' });
      return { success: false, reason: 'not_authorized' };
    }

    const workspace = workspaceService.getWorkspace(workspaceId);
    if (!workspace) {
      return { success: false, reason: 'workspace_not_found' };
    }

    if (!permissionService.checkWritePermission(workspace, currentUser)) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: permissionErrorMessage });
      return { success: false, reason: 'no_permission' };
    }

    workspaceService.updateLastActivity(workspaceId);

    return handler(data, { ...context, workspace });
  };
}

export function withRoomAuth(handler) {
  return function wrappedHandler(data, context) {
    const { workspaceId } = data;
    const { socket } = context;

    if (!socket.rooms.has(workspaceId)) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Not authorized for this workspace' });
      return { success: false, reason: 'not_authorized' };
    }

    const workspace = workspaceService.getWorkspace(workspaceId);
    if (!workspace) {
      return { success: false, reason: 'workspace_not_found' };
    }

    return handler(data, { ...context, workspace });
  };
}

export function withOwnerAuth(handler, options = {}) {
  const { errorMessage = 'Only the workspace owner can perform this action' } = options;

  return function wrappedHandler(data, context) {
    const { workspaceId } = data;
    const { socket, currentUser } = context;

    const workspace = workspaceService.getWorkspace(workspaceId);
    if (!workspace) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Workspace not found' });
      return { success: false, reason: 'workspace_not_found' };
    }

    if (!permissionService.checkOwnership(workspace, currentUser.userId)) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: errorMessage });
      return { success: false, reason: 'not_owner' };
    }

    return handler(data, { ...context, workspace });
  };
}
