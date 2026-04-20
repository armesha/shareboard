import { SOCKET_EVENTS, config } from '../config';
import { withRoomAuth, withWorkspaceAuth } from '../middleware/socketAuth';
import { isValidWorkspaceId } from './elementValidation';
import type { Handler, HandlerResult, TextEditStartData, TextEditEndData } from '../types';

const LOCK_TIMEOUT_MS = config.validation.lock?.timeoutMs ?? 30000;

function cleanupExpiredLocks(workspace: { textEditLocks: Map<string, { timestamp: number }> }): void {
  const now = Date.now();
  for (const [id, lock] of workspace.textEditLocks.entries()) {
    if (now - lock.timestamp > LOCK_TIMEOUT_MS) {
      workspace.textEditLocks.delete(id);
    }
  }
}

const handleTextEditStartCore: Handler<TextEditStartData> = (
  { workspaceId, elementId },
  { socket, currentUser, workspace }
): HandlerResult => {
  if (!isValidWorkspaceId(workspaceId) || !elementId || !workspace) {
    return { success: false, reason: 'invalid_input' };
  }

  cleanupExpiredLocks(workspace);

  const userId = currentUser.userId || currentUser.id;
  const existing = workspace.textEditLocks.get(elementId);
  if (existing && existing.socketId !== socket.id) {
    socket.emit(SOCKET_EVENTS.TEXT_EDIT_LOCKS, {
      workspaceId,
      locks: Object.fromEntries(Array.from(workspace.textEditLocks.entries()).map(([k, v]) => [k, v.userId]))
    });
    return { success: false, reason: 'locked' };
  }

  workspace.textEditLocks.set(elementId, {
    userId,
    socketId: socket.id,
    timestamp: Date.now()
  });

  socket.to(workspaceId).emit(SOCKET_EVENTS.TEXT_EDIT_LOCKS, {
    workspaceId,
    locks: Object.fromEntries(Array.from(workspace.textEditLocks.entries()).map(([k, v]) => [k, v.userId]))
  });
  socket.emit(SOCKET_EVENTS.TEXT_EDIT_LOCKS, {
    workspaceId,
    locks: Object.fromEntries(Array.from(workspace.textEditLocks.entries()).map(([k, v]) => [k, v.userId]))
  });

  return { success: true };
};

export const handleTextEditStart = withWorkspaceAuth(handleTextEditStartCore);

const handleTextEditEndCore: Handler<TextEditEndData> = (
  { workspaceId, elementId },
  { socket, workspace }
): HandlerResult => {
  if (!isValidWorkspaceId(workspaceId) || !elementId || !workspace) {
    return { success: false, reason: 'invalid_input' };
  }

  cleanupExpiredLocks(workspace);

  const existing = workspace.textEditLocks.get(elementId);
  if (existing && existing.socketId === socket.id) {
    workspace.textEditLocks.delete(elementId);
  }

  socket.to(workspaceId).emit(SOCKET_EVENTS.TEXT_EDIT_LOCKS, {
    workspaceId,
    locks: Object.fromEntries(Array.from(workspace.textEditLocks.entries()).map(([k, v]) => [k, v.userId]))
  });
  socket.emit(SOCKET_EVENTS.TEXT_EDIT_LOCKS, {
    workspaceId,
    locks: Object.fromEntries(Array.from(workspace.textEditLocks.entries()).map(([k, v]) => [k, v.userId]))
  });

  return { success: true };
};

export const handleTextEditEnd = withRoomAuth(handleTextEditEndCore);

