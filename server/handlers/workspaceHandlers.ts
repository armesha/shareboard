import { config, SOCKET_EVENTS } from '../config';
import * as workspaceService from '../services/workspaceService';
import * as permissionService from '../services/permissionService';
import { isValidWorkspaceId } from './elementValidation';
import { toUser } from '../utils/userUtils';
import type { HandlerContext, HandlerResult, JoinWorkspaceData, Workspace, CurrentUser } from '../types';
import type { Socket, Server } from 'socket.io';

const MAX_USERS_PER_WORKSPACE = config.validation.workspace.maxUsersPerWorkspace;

interface WorkspaceCreationLock {
  timestamp: number;
  promise: Promise<void>;
  resolve: () => void;
}

const workspacesBeingCreated = new Map<string, WorkspaceCreationLock>();

export function clearWorkspacesBeingCreated(): void {
  workspacesBeingCreated.clear();
}

function acquireLock(workspaceId: string): WorkspaceCreationLock | null {
  const existingLock = workspacesBeingCreated.get(workspaceId);
  if (existingLock) {
    const lockAge = Date.now() - existingLock.timestamp;
    if (lockAge > config.validation.lock.timeoutMs) {
      existingLock.resolve();
      workspacesBeingCreated.delete(workspaceId);
    } else {
      return null;
    }
  }

  let resolveFunc: () => void = () => {};
  const promise = new Promise<void>((resolve) => {
    resolveFunc = resolve;
  });

  const lock: WorkspaceCreationLock = {
    timestamp: Date.now(),
    promise,
    resolve: resolveFunc
  };

  workspacesBeingCreated.set(workspaceId, lock);
  return lock;
}

function releaseLock(workspaceId: string): void {
  const lock = workspacesBeingCreated.get(workspaceId);
  if (lock) {
    lock.resolve();
    workspacesBeingCreated.delete(workspaceId);
  }
}

interface EnsureWorkspaceResult {
  workspace: Workspace;
  isNewWorkspace: boolean;
}

async function ensureWorkspaceExists(
  workspaceId: string,
  userId: string
): Promise<EnsureWorkspaceResult | null> {
  let workspace = workspaceService.getWorkspace(workspaceId);

  if (workspace) {
    return { workspace, isNewWorkspace: false };
  }

  const existingLock = workspacesBeingCreated.get(workspaceId);

  if (existingLock) {
    await existingLock.promise;
    workspace = workspaceService.getWorkspace(workspaceId);
    return workspace ? { workspace, isNewWorkspace: false } : null;
  }

  const lock = acquireLock(workspaceId);

  if (lock) {
    try {
      workspace = workspaceService.getWorkspace(workspaceId);
      if (!workspace) {
        workspace = workspaceService.createWorkspace(workspaceId, userId);
        return { workspace, isNewWorkspace: true };
      }
      return { workspace, isNewWorkspace: false };
    } finally {
      releaseLock(workspaceId);
    }
  }

  const retryLock = workspacesBeingCreated.get(workspaceId);
  if (retryLock) {
    await retryLock.promise;
  }

  workspace = workspaceService.getWorkspace(workspaceId);
  return workspace ? { workspace, isNewWorkspace: false } : null;
}

function setupUserSession(
  workspace: Workspace,
  currentUser: CurrentUser,
  socketId: string,
  userId: string,
  accessToken: string | null,
  isNewWorkspace: boolean
): void {
  currentUser.userId = userId;
  currentUser.workspaceId = workspace.id;

  const { hasEditAccess, isOwner } = permissionService.calculateEditAccess(
    workspace,
    toUser(currentUser),
    accessToken
  );

  currentUser.hasEditAccess = hasEditAccess;
  currentUser.isOwner = isNewWorkspace || isOwner;

  if (isNewWorkspace) {
    workspace.owner = userId;
    currentUser.hasEditAccess = true;
  }

  workspaceService.setUserSession(socketId, { ...currentUser });
  permissionService.validateAndSetToken(workspace, accessToken, toUser(currentUser));
}

function leavePreviousWorkspace(
  socket: Socket,
  io: Server | undefined,
  currentWorkspace: Workspace | null
): void {
  if (!currentWorkspace) return;

  const prevWorkspaceId = workspaceService.findWorkspaceIdByRef(currentWorkspace);
  if (!prevWorkspaceId) return;

  socket.leave(prevWorkspaceId);
  workspaceService.removeConnection(prevWorkspaceId, socket.id);
  const activeUsers = workspaceService.getActiveUserCount(prevWorkspaceId);

  if (io) {
    io.to(prevWorkspaceId).emit(SOCKET_EVENTS.USER_LEFT, { userId: socket.id, activeUsers });
  }
}

function emitJoinEvents(
  socket: Socket,
  io: Server | undefined,
  workspace: Workspace,
  workspaceId: string,
  currentUser: CurrentUser,
  isNewWorkspace: boolean
): void {
  const activeUsers = workspaceService.getActiveUserCount(workspaceId);

  socket.emit(SOCKET_EVENTS.WORKSPACE_STATE, {
    ...workspaceService.getWorkspaceState(workspaceId),
    isNewWorkspace
  });

  socket.emit(SOCKET_EVENTS.SHARING_INFO, permissionService.getSharingInfo(workspace, toUser(currentUser)));

  if (workspace.textEditLocks && workspace.textEditLocks.size > 0) {
    const locksObj: Record<string, string> = {};
    for (const [id, lock] of workspace.textEditLocks.entries()) {
      locksObj[id] = lock.userId;
    }
    socket.emit(SOCKET_EVENTS.TEXT_EDIT_LOCKS, { workspaceId, locks: locksObj });
  }

  if (io) {
    io.to(workspaceId).emit(SOCKET_EVENTS.USER_JOINED, { userId: socket.id, activeUsers });
  }
}

export async function handleJoinWorkspace(
  { workspaceId, userId, accessToken }: JoinWorkspaceData,
  { socket, io, currentUser, currentWorkspaceRef }: HandlerContext
): Promise<HandlerResult> {
  try {
    if (!isValidWorkspaceId(workspaceId)) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid workspace ID' });
      return { success: false, reason: 'invalid_workspace_id' };
    }

    if (socket.rooms.has(workspaceId)) {
      const workspace = workspaceService.getWorkspace(workspaceId);
      if (workspace) {
        emitJoinEvents(socket, io, workspace, workspaceId, currentUser, false);
        return { success: true, workspace, isNewWorkspace: false };
      }
    }

    currentUser.accessToken = accessToken || null;
    const effectiveUserId = userId || socket.id;

    const result = await ensureWorkspaceExists(workspaceId, effectiveUserId);

    if (!result) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Workspace creation failed, please retry' });
      return { success: false, reason: 'workspace_creation_failed' };
    }

    const { workspace, isNewWorkspace } = result;

    if (!isNewWorkspace) {
      const currentUserCount = workspaceService.getActiveUserCount(workspaceId);
      if (currentUserCount >= MAX_USERS_PER_WORKSPACE) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Workspace is full. Maximum of 100 users allowed per workspace.' });
        return { success: false, reason: 'workspace_full' };
      }
    }

    setupUserSession(workspace, currentUser, socket.id, effectiveUserId, accessToken || null, isNewWorkspace);
    leavePreviousWorkspace(socket, io, currentWorkspaceRef?.current || null);

    workspaceService.addConnection(workspaceId, socket.id);
    socket.join(workspaceId);

    if (currentWorkspaceRef) {
      currentWorkspaceRef.current = workspace;
    }

    workspaceService.updateLastActivity(workspaceId);
    emitJoinEvents(socket, io, workspace, workspaceId, currentUser, isNewWorkspace);

    return { success: true, workspace, isNewWorkspace };
  } catch (error) {
    socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to join workspace' });
    return { success: false, error };
  }
}

export function handleDisconnect({ socket, io, currentWorkspaceRef }: HandlerContext): HandlerResult {
  try {
    if (currentWorkspaceRef?.current) {
      const workspaceId = workspaceService.findWorkspaceIdByRef(currentWorkspaceRef.current);
      if (workspaceId) {
        workspaceService.releaseTextLocksForSocket(workspaceId, socket.id);
        const workspace = workspaceService.getWorkspace(workspaceId);
        if (workspace && io) {
          const locksObj: Record<string, string> = {};
          for (const [id, lock] of workspace.textEditLocks.entries()) {
            locksObj[id] = lock.userId;
          }
          io.to(workspaceId).emit(SOCKET_EVENTS.TEXT_EDIT_LOCKS, { workspaceId, locks: locksObj });
        }
        workspaceService.removeConnection(workspaceId, socket.id);
        const activeUsers = workspaceService.getActiveUserCount(workspaceId);
        if (io) {
          io.to(workspaceId).emit(SOCKET_EVENTS.USER_LEFT, { userId: socket.id, activeUsers });
        }
      }
    }

    workspaceService.removeUserSession(socket.id);
    return { success: true };
  } catch (error) {
    return { success: false, error };
  }
}
