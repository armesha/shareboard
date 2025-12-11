import { SOCKET_EVENTS } from '../../shared/constants';
import * as workspaceService from '../services/workspaceService';
import * as permissionService from '../services/permissionService';
import type {
  HandlerData,
  HandlerContext,
  HandlerResult,
  Handler,
  User
} from '../types';

export interface AuthOptions {
  permissionErrorMessage?: string;
  errorMessage?: string;
}

export function withWorkspaceAuth<T extends HandlerData>(
  handler: Handler<T>,
  options: AuthOptions = {}
): Handler<T> {
  const { permissionErrorMessage = 'You do not have permission to edit' } = options;

  return async function wrappedHandler(data: T, context: HandlerContext): Promise<HandlerResult> {
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

    const user: User = {
      userId: currentUser.userId || currentUser.id,
      accessToken: currentUser.accessToken,
      hasEditAccess: currentUser.hasEditAccess,
      isOwner: currentUser.isOwner,
    };

    if (!permissionService.checkWritePermission(workspace, user)) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: permissionErrorMessage });
      return { success: false, reason: 'no_permission' };
    }

    workspaceService.updateLastActivity(workspaceId);

    return await handler(data, { ...context, workspace });
  };
}

export function withRoomAuth<T extends HandlerData>(
  handler: Handler<T>
): Handler<T> {
  return async function wrappedHandler(data: T, context: HandlerContext): Promise<HandlerResult> {
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

    return await handler(data, { ...context, workspace });
  };
}

export function withOwnerAuth<T extends HandlerData>(
  handler: Handler<T>,
  options: AuthOptions = {}
): Handler<T> {
  const { errorMessage = 'Only the workspace owner can perform this action' } = options;

  return async function wrappedHandler(data: T, context: HandlerContext): Promise<HandlerResult> {
    const { workspaceId } = data;
    const { socket, currentUser } = context;

    const workspace = workspaceService.getWorkspace(workspaceId);
    if (!workspace) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Workspace not found' });
      return { success: false, reason: 'workspace_not_found' };
    }

    const userId = currentUser.userId || currentUser.id;
    if (!permissionService.checkOwnership(workspace, userId)) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: errorMessage });
      return { success: false, reason: 'not_owner' };
    }

    return await handler(data, { ...context, workspace });
  };
}
