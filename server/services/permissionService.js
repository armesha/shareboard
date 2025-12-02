import { SHARING_MODES } from '../config.js';

export function checkWritePermission(workspace, user) {
  if (!workspace || !user) return false;
  if (workspace.owner === user.userId) return true;

  const mode = workspace.sharingMode || SHARING_MODES.READ_WRITE_SELECTED;

  if (mode === SHARING_MODES.READ_ONLY) {
    return false;
  }

  if (mode === SHARING_MODES.READ_WRITE_ALL) {
    return true;
  }

  if (mode === SHARING_MODES.READ_WRITE_SELECTED) {
    return user.hasEditAccess === true;
  }

  return false;
}

export function checkOwnership(workspace, userId) {
  return workspace?.owner === userId;
}

export function calculateEditAccess(workspace, user, accessToken) {
  if (!workspace || !user) {
    return { hasEditAccess: false, isOwner: false };
  }

  const isOwner = workspace.owner === user.userId;
  let hasEditAccess = false;

  if (isOwner) {
    hasEditAccess = true;
  } else {
    const mode = workspace.sharingMode || SHARING_MODES.READ_WRITE_SELECTED;

    if (mode === SHARING_MODES.READ_ONLY) {
      hasEditAccess = false;
    } else if (mode === SHARING_MODES.READ_WRITE_ALL) {
      hasEditAccess = true;
    } else if (mode === SHARING_MODES.READ_WRITE_SELECTED) {
      if (accessToken && workspace.editToken && accessToken === workspace.editToken) {
        hasEditAccess = true;
      }
    }
  }

  return { hasEditAccess, isOwner };
}

export function validateAndSetToken(workspace, accessToken, user) {
  if (!workspace || !accessToken) return false;

  if (accessToken.startsWith('edit_') && !workspace.editToken) {
    workspace.editToken = accessToken;

    if (user) {
      user.hasEditAccess = true;
    }

    return true;
  }

  return false;
}

export function getSharingInfo(workspace, user) {
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
