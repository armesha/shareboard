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

function emitLocks(workspaceId: string, workspace: { textEditLocks: Map<string, { userId: string }> }, io: unknown, socket: unknown): void {
  const locksObj: Record<string, string> = {};
  for (const [id, lock] of workspace.textEditLocks.entries()) {
    locksObj[id] = lock.userId;
  }
  // @ts-expect-error io/socket are socket.io instances in runtime
  (io ?? socket)?.to?.(workspaceId)?.emit?.(SOCKET_EVENTS.TEXT_EDIT_LOCKS, { workspaceId, locks: locksObj });
}

const handleTextEditStartCore: Handler<TextEditStartData> = (
  { workspaceId, elementId },
  { socket, io, currentUser, workspace }
): HandlerResult => {
  if (!isValidWorkspaceId(workspaceId) || !elementId || !workspace) {
    return { success: false, reason: 'invalid_input' };
  }

  cleanupExpiredLocks(workspace);

  const userId = currentUser.userId || currentUser.id;
  const existing = workspace.textEditLocks.get(elementId);
  if (existing && existing.socketId !== socket.id) {
    // Already locked by someone else; just re-emit current locks to requester
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

  if (io) {
    emitLocks(workspaceId, workspace, io, socket);
  } else {
    socket.to(workspaceId).emit(SOCKET_EVENTS.TEXT_EDIT_LOCKS, {
      workspaceId,
      locks: Object.fromEntries(Array.from(workspace.textEditLocks.entries()).map(([k, v]) => [k, v.userId]))
    });
    socket.emit(SOCKET_EVENTS.TEXT_EDIT_LOCKS, {
      workspaceId,
      locks: Object.fromEntries(Array.from(workspace.textEditLocks.entries()).map(([k, v]) => [k, v.userId]))
    });
  }

  return { success: true };
};

export const handleTextEditStart = withWorkspaceAuth(handleTextEditStartCore);

const handleTextEditEndCore: Handler<TextEditEndData> = (
  { workspaceId, elementId },
  { socket, io, workspace }
): HandlerResult => {
  if (!isValidWorkspaceId(workspaceId) || !elementId || !workspace) {
    return { success: false, reason: 'invalid_input' };
  }

  cleanupExpiredLocks(workspace);

  const existing = workspace.textEditLocks.get(elementId);
  if (existing && existing.socketId === socket.id) {
    workspace.textEditLocks.delete(elementId);
  }

  if (io) {
    emitLocks(workspaceId, workspace, io, socket);
  } else {
    socket.to(workspaceId).emit(SOCKET_EVENTS.TEXT_EDIT_LOCKS, {
      workspaceId,
      locks: Object.fromEntries(Array.from(workspace.textEditLocks.entries()).map(([k, v]) => [k, v.userId]))
    });
    socket.emit(SOCKET_EVENTS.TEXT_EDIT_LOCKS, {
      workspaceId,
      locks: Object.fromEntries(Array.from(workspace.textEditLocks.entries()).map(([k, v]) => [k, v.userId]))
    });
  }

  return { success: true };
};

export const handleTextEditEnd = withRoomAuth(handleTextEditEndCore);

