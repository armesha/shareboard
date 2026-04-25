import { SOCKET_EVENTS } from '../../shared/constants';
import * as workspaceService from '../services/workspaceService';
import * as permissionService from '../services/permissionService';
import { logger, logThrottled } from '../utils/logger';
import type {
  HandlerData,
  HandlerContext,
  HandlerResult,
  Handler,
  User
} from '../types';

interface AuthOptions {
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
      logThrottled(`${socket.id}:wsauth:notroom:${workspaceId}`, 10000, () => {
        logger.warn({ socketId: socket.id, workspaceId }, 'permission denied: not in room');
      });
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
      logThrottled(`${socket.id}:wsauth:nowrite:${workspaceId}`, 10000, () => {
        logger.warn({ socketId: socket.id, workspaceId, userId: user.userId }, 'permission denied: no write access');
      });
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
      logThrottled(`${socket.id}:roomauth:${workspaceId}`, 10000, () => {
        logger.warn({ socketId: socket.id, workspaceId }, 'permission denied: not in room');
      });
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
      logger.warn({ socketId: socket.id, workspaceId, userId }, 'permission denied: not owner');
      socket.emit(SOCKET_EVENTS.ERROR, { message: errorMessage });
      return { success: false, reason: 'not_owner' };
    }

    return await handler(data, { ...context, workspace });
  };
}
