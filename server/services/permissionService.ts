import { SHARING_MODES } from '../config';
import type { Workspace, User, EditAccessResult, SharingInfo } from '../types';
import { safeCompareTokens } from '../utils/securityUtils';

export function checkWritePermission(workspace: Workspace | null | undefined, user: User | null | undefined): boolean {
  if (!workspace || !user) return false;
  if (workspace.owner === user.userId) return true;

  const mode = workspace.sharingMode || SHARING_MODES.READ_WRITE_ALL;
  const token = user.accessToken;

  if (mode === SHARING_MODES.READ_ONLY) {
    return false;
  }

  if (mode === SHARING_MODES.READ_WRITE_ALL) {
    return true;
  }

  if (mode === SHARING_MODES.READ_WRITE_SELECTED) {
    if (safeCompareTokens(token, workspace.editToken)) return true;
    if (Array.isArray(workspace.allowedUsers) && workspace.allowedUsers.includes(user.userId)) return true;
    return false;
  }

  return false;
}

export function checkOwnership(workspace: Workspace | null | undefined, userId: string): boolean {
  return workspace?.owner === userId;
}

export function calculateEditAccess(
  workspace: Workspace | null | undefined,
  user: User | null | undefined,
  accessToken?: string | null
): EditAccessResult {
  if (!workspace || !user) {
    return { hasEditAccess: false, isOwner: false };
  }

  const isOwner = workspace.owner === user.userId;
  const token = accessToken || user.accessToken || null;
  let hasEditAccess = false;

  if (isOwner) {
    hasEditAccess = true;
  } else {
    const mode = workspace.sharingMode || SHARING_MODES.READ_WRITE_ALL;

    if (mode === SHARING_MODES.READ_ONLY) {
      hasEditAccess = false;
    } else if (mode === SHARING_MODES.READ_WRITE_ALL) {
      hasEditAccess = true;
    } else if (mode === SHARING_MODES.READ_WRITE_SELECTED) {
      if (safeCompareTokens(token, workspace.editToken)) {
        hasEditAccess = true;
      } else if (Array.isArray(workspace.allowedUsers) && workspace.allowedUsers.includes(user.userId)) {
        hasEditAccess = true;
      }
    }
  }

  return { hasEditAccess, isOwner };
}

export function validateAndSetToken(
  workspace: Workspace | null | undefined,
  accessToken: string | null | undefined,
  user?: User | null
): boolean {
  if (!workspace || !accessToken) return false;

  if (safeCompareTokens(accessToken, workspace.editToken)) {
    if (user) {
      user.hasEditAccess = true;
    }
    return true;
  }

  return false;
}

export function getSharingInfo(
  workspace: Workspace | null | undefined,
  user?: User | null
): SharingInfo | null {
  if (!workspace) return null;

  const isOwner = user ? workspace.owner === user.userId : false;
  const hasEditAccess = user ? checkWritePermission(workspace, user) : false;

  return {
    sharingMode: workspace.sharingMode,
    allowedUsers: workspace.allowedUsers,
    isOwner,
    currentUser: user?.userId || null,
    owner: workspace.owner,
    hasEditAccess,
    editToken: isOwner ? workspace.editToken : undefined
  };
}
