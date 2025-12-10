import { config, SOCKET_EVENTS, SHARING_MODES } from '../config';
import * as workspaceService from '../services/workspaceService';
import * as permissionService from '../services/permissionService';
import { withOwnerAuth } from '../middleware/socketAuth';
import type {
  Handler,
  HandlerContext,
  HandlerResult,
  GetEditTokenData,
  SetEditTokenData,
  ChangeSharingModeData,
  EndSessionData
} from '../types';

export function handleGetEditToken(
  { workspaceId }: GetEditTokenData,
  callback: ((response: { error?: string; editToken?: string | null }) => void) | undefined,
  { currentUser }: HandlerContext
): HandlerResult {
  try {
    const workspace = workspaceService.getWorkspace(workspaceId);
    if (!workspace) {
      callback?.({ error: 'Workspace not found' });
      return { success: false, reason: 'workspace_not_found' };
    }

    if (!permissionService.checkOwnership(workspace, currentUser.userId || currentUser.id)) {
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

export function handleSetEditToken(
  { workspaceId, editToken }: SetEditTokenData,
  { socket, currentUser }: HandlerContext
): HandlerResult {
  try {
    const workspace = workspaceService.getWorkspace(workspaceId);
    if (!workspace) {
      return { success: false, reason: 'workspace_not_found' };
    }

    if (!permissionService.checkOwnership(workspace, currentUser.userId || currentUser.id)) {
      return { success: false, reason: 'not_owner' };
    }

    if (editToken?.startsWith('edit_') && editToken.length >= config.validation.workspace.minEditTokenLength) {
      workspace.editToken = editToken;
      socket.emit(SOCKET_EVENTS.EDIT_TOKEN_UPDATED, { editToken });
      return { success: true };
    }

    return { success: false, reason: 'invalid_token_format' };
  } catch (error) {
    socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to set edit token' });
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
      const disconnectedClients: string[] = [];
      for (const socketId of connections) {
        const clientSocket = io.sockets?.sockets?.get(socketId);
        if (clientSocket && clientSocket.id !== socket.id) {
          workspaceService.removeConnection(workspaceId, socketId);
          clientSocket.leave(workspaceId);
          disconnectedClients.push(socketId);
        }
      }
      return { success: true, disconnectedClients };
    }

    return { success: false, reason: 'io_not_available' };
  } catch (error) {
    socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to end session' });
    return { success: false, error };
  }
};

export const handleEndSession = withOwnerAuth(handleEndSessionCore, {
  errorMessage: 'Only the workspace owner can end the session'
});
