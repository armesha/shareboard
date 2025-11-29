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

export function shallowEqual(obj1, obj2) {
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (obj1[key] !== obj2[key]) return false;
  }

  return true;
}

export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function createNotificationManager() {
  let notifications = [];
  let listeners = [];

  return {
    show(message, type = 'info', duration = 3000) {
      const id = Date.now();
      const notification = { id, message, type };
      notifications.push(notification);
      listeners.forEach(l => l(notifications));

      setTimeout(() => {
        notifications = notifications.filter(n => n.id !== id);
        listeners.forEach(l => l(notifications));
      }, duration);

      return id;
    },
    subscribe(listener) {
      listeners.push(listener);
      return () => {
        listeners = listeners.filter(l => l !== listener);
      };
    },
    getNotifications() {
      return notifications;
    }
  };
}
