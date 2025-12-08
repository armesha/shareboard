import { STORAGE_KEYS, CANVAS } from '../constants';
import type { Canvas as FabricCanvas, FabricObject } from 'fabric';

export function getWorkspaceId(): string | null {
  const parts = window.location.pathname.split('/');
  if (parts.length < 3 || !parts[2]) {
    return null;
  }
  return parts[2];
}

export function generateUserId(): string {
  return `user-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

export function getPersistentUserId(): string {
  let userId = localStorage.getItem(STORAGE_KEYS.USER_ID);
  if (!userId) {
    userId = generateUserId();
    localStorage.setItem(STORAGE_KEYS.USER_ID, userId);
  }
  return userId;
}

export function getAccessToken(workspaceId: string): string | null {
  return localStorage.getItem(STORAGE_KEYS.accessToken(workspaceId));
}

export function setAccessToken(workspaceId: string, token: string): void {
  localStorage.setItem(STORAGE_KEYS.accessToken(workspaceId), token);
}

export function removeAccessToken(workspaceId: string): void {
  localStorage.removeItem(STORAGE_KEYS.accessToken(workspaceId));
}

interface ViewportBoundaries {
  tl: { x: number; y: number };
  tr: { x: number; y: number };
  bl: { x: number; y: number };
  br: { x: number; y: number };
}

interface BoundingRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type ConstrainableObject = FabricObject & {
  left: number;
  top: number;
  getBoundingRect(): BoundingRect;
  setCoords(): void;
};

export type ConstrainableCanvas = FabricCanvas & {
  calcViewportBoundaries(): ViewportBoundaries;
};

export function constrainObjectToBounds(
  obj: ConstrainableObject,
  canvas: ConstrainableCanvas,
  buffer: number = CANVAS.EDGE_BUFFER
): boolean {
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
