import { SOCKET_EVENTS, SHARING_MODES } from '../config';
import * as workspaceService from '../services/workspaceService';
import * as permissionService from '../services/permissionService';
import { withOwnerAuth } from '../middleware/socketAuth';
import { logger } from '../utils/logger';
import type {
  Handler,
  HandlerContext,
  HandlerResult,
  GetEditTokenData,
  ChangeSharingModeData,
  EndSessionData
} from '../types';

export function handleGetEditToken(
  { workspaceId }: GetEditTokenData,
  callback: ((response: { error?: string; editToken?: string | null }) => void) | undefined,
  { socket, currentUser }: HandlerContext
): HandlerResult {
  try {
    const workspace = workspaceService.getWorkspace(workspaceId);
    if (!workspace) {
      callback?.({ error: 'Workspace not found' });
      return { success: false, reason: 'workspace_not_found' };
    }

    const userId = currentUser.userId || currentUser.id;
    if (!permissionService.checkOwnership(workspace, userId)) {
      logger.warn({ socketId: socket.id, workspaceId, userId }, 'permission denied: not owner (get edit token)');
      callback?.({ error: 'Permission denied' });
      return { success: false, reason: 'not_owner' };
    }

    callback?.({ editToken: workspace.editToken || null });
    return { success: true, editToken: workspace.editToken };
  } catch (error) {
    logger.error({ err: error, socketId: socket.id, workspaceId }, 'get edit token failed');
    callback?.({ error: 'Failed to get edit token' });
    return { success: false, error };
  }
}


const handleChangeSharingModeCore: Handler<ChangeSharingModeData> = (
  { workspaceId, sharingMode },
  { socket, io }
): HandlerResult => {
  try {
    const validModes = Object.values(SHARING_MODES);
    if (!validModes.includes(sharingMode)) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid sharing mode' });
      return { success: false, reason: 'invalid_mode' };
    }

    const success = workspaceService.updateSharingMode(workspaceId, sharingMode);
    if (success) {
      if (io) {
        io.to(workspaceId).emit(SOCKET_EVENTS.SHARING_MODE_CHANGED, { sharingMode });
      }
      return { success: true };
    }

    return { success: false, reason: 'update_failed' };
  } catch (error) {
    logger.error({ err: error, socketId: socket.id, workspaceId }, 'change sharing mode failed');
    socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to change sharing mode' });
    return { success: false, error };
  }
};

export const handleChangeSharingMode = withOwnerAuth(handleChangeSharingModeCore, {
  errorMessage: 'Only the workspace owner can change sharing mode'
});

const handleEndSessionCore: Handler<EndSessionData> = (
  { workspaceId },
  { socket, io }
): HandlerResult => {
  try {
    if (io) {
      io.to(workspaceId).emit(SOCKET_EVENTS.SESSION_ENDED, { message: 'The workspace owner has ended this session' });

      const connections = workspaceService.getActiveConnections(workspaceId);
      for (const socketId of connections) {
        const clientSocket = io.sockets?.sockets?.get(socketId);
        if (clientSocket && clientSocket.id !== socket.id) {
          workspaceService.removeConnection(workspaceId, socketId);
          clientSocket.leave(workspaceId);
        }
      }
      return { success: true };
    }

    return { success: false, reason: 'io_not_available' };
  } catch (error) {
    logger.error({ err: error, socketId: socket.id, workspaceId }, 'end session failed');
    socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to end session' });
    return { success: false, error };
  }
};

export const handleEndSession = withOwnerAuth(handleEndSessionCore, {
  errorMessage: 'Only the workspace owner can end the session'
});
