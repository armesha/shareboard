import { STORAGE_KEYS } from '../constants';

export function getWorkspaceId() {
  const parts = window.location.pathname.split('/');
  if (parts.length < 3 || !parts[2]) {
    return null;
  }
  return parts[2];
}

export function generateUserId() {
  return `user-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

export function getPersistentUserId() {
  let userId = localStorage.getItem(STORAGE_KEYS.USER_ID);
  if (!userId) {
    userId = generateUserId();
    localStorage.setItem(STORAGE_KEYS.USER_ID, userId);
  }
  return userId;
}

export function getAccessToken(workspaceId) {
  return localStorage.getItem(STORAGE_KEYS.accessToken(workspaceId));
}

export function setAccessToken(workspaceId, token) {
  localStorage.setItem(STORAGE_KEYS.accessToken(workspaceId), token);
}

export function removeAccessToken(workspaceId) {
  localStorage.removeItem(STORAGE_KEYS.accessToken(workspaceId));
}

export function constrainObjectToBounds(obj, canvas, buffer = 20) {
  const boundingRect = canvas.calcViewportBoundaries();
  const objBoundingRect = obj.getBoundingRect();

  let needsUpdate = false;

  if (objBoundingRect.left < boundingRect.tl.x + buffer) {
    obj.left += (boundingRect.tl.x + buffer - objBoundingRect.left);
    needsUpdate = true;
  }

  if (objBoundingRect.top < boundingRect.tl.y + buffer) {
    obj.top += (boundingRect.tl.y + buffer - objBoundingRect.top);
    needsUpdate = true;
  }

  if (objBoundingRect.left + objBoundingRect.width > boundingRect.br.x - buffer) {
    obj.left -= (objBoundingRect.left + objBoundingRect.width - (boundingRect.br.x - buffer));
    needsUpdate = true;
  }

  if (objBoundingRect.top + objBoundingRect.height > boundingRect.br.y - buffer) {
    obj.top -= (objBoundingRect.top + objBoundingRect.height - (boundingRect.br.y - buffer));
    needsUpdate = true;
  }

  if (needsUpdate) {
    obj.setCoords();
  }

  return needsUpdate;
}

