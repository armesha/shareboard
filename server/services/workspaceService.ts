import crypto from 'crypto';
import { config, SHARING_MODES } from '../config';
import type { SharingMode } from '../../shared/constants';
import type {
  Workspace,
  UserSession,
  WorkspaceUser,
  WorkspaceState,
  WhiteboardElement
} from '../types';
import * as yjsUtils from '../yjs-utils';

const workspaces = new Map<string, Workspace>();
const activeConnections = new Map<string, Set<string>>();
const userSessions = new Map<string, UserSession>();

export function generateKey(length: number = config.workspace.keyLength): string {
  const bytes = crypto.randomBytes(Math.ceil(length * 3 / 4));
  return bytes.toString('base64')
    .replace(/[+/]/g, '')
    .replace(/=+$/, '')
    .slice(0, length);
}

export function generateEditToken(): string {
  return `edit_${crypto.randomBytes(32).toString('hex')}`;
}

export function createWorkspace(workspaceId: string, ownerId: string): Workspace {
  const workspace: Workspace = {
    id: workspaceId,
    created: Date.now(),
    lastActivity: Date.now(),
    diagrams: new Map(),
    drawingsMap: new Map<string, WhiteboardElement>(),
    allDrawingsMap: new Map<string, WhiteboardElement>(),
    drawingOrder: [],
    diagramContent: '',
    codeSnippets: { language: 'javascript', content: '' },
    owner: ownerId,
    sharingMode: SHARING_MODES.READ_WRITE_SELECTED,
    allowedUsers: [],
    editToken: generateEditToken()
  };

  workspaces.set(workspaceId, workspace);
  return workspace;
}

export function getWorkspace(workspaceId: string): Workspace | undefined {
  return workspaces.get(workspaceId);
}

export function workspaceExists(workspaceId: string): boolean {
  return workspaces.has(workspaceId);
}

export function deleteWorkspace(workspaceId: string): void {
  workspaces.delete(workspaceId);
  activeConnections.delete(workspaceId);

  yjsUtils.cleanupYjsDoc(workspaceId);
}

export function updateLastActivity(workspaceId: string): void {
  const workspace = workspaces.get(workspaceId);
  if (workspace) {
    workspace.lastActivity = Date.now();
  }
}

export function getActiveConnections(workspaceId: string): Set<string> {
  if (!activeConnections.has(workspaceId)) {
    activeConnections.set(workspaceId, new Set());
  }
  return activeConnections.get(workspaceId)!;
}

export function addConnection(workspaceId: string, socketId: string): number {
  const connections = getActiveConnections(workspaceId);
  connections.add(socketId);
  return connections.size;
}

export function removeConnection(workspaceId: string, socketId: string): number {
  const connections = activeConnections.get(workspaceId);
  if (connections) {
    connections.delete(socketId);
    return connections.size;
  }
  return 0;
}

export function getActiveUserCount(workspaceId: string): number {
  const connections = activeConnections.get(workspaceId);
  if (!connections) return 0;

  const uniqueUsers = new Set<string>();
  for (const socketId of connections) {
    const session = userSessions.get(socketId);
    if (session && session.userId) {
      uniqueUsers.add(session.userId);
    }
  }
  return uniqueUsers.size;
}

export function setUserSession(socketId: string, userInfo: UserSession): void {
  userSessions.set(socketId, userInfo);
}

export function getUserSession(socketId: string): UserSession | undefined {
  return userSessions.get(socketId);
}

export function removeUserSession(socketId: string): void {
  userSessions.delete(socketId);
}

export function getWorkspaceUsers(workspaceId: string): WorkspaceUser[] {
  const workspace = workspaces.get(workspaceId);
  if (!workspace) return [];

  const connections = activeConnections.get(workspaceId) || new Set();
  const users: WorkspaceUser[] = [];

  for (const socketId of connections) {
    const userInfo = userSessions.get(socketId);
    if (userInfo) {
      users.push({
        id: userInfo.userId,
        online: true,
        isOwner: workspace.owner === userInfo.userId
      });
    }
  }

  return users;
}

export function cleanupInactiveWorkspaces(): string[] {
  const threshold = config.cleanup.inactiveThresholdMs;
  const now = Date.now();
  const removed: string[] = [];

  for (const [workspaceId, workspace] of workspaces.entries()) {
    const connections = activeConnections.get(workspaceId) || new Set();

    if (connections.size === 0 && now - workspace.lastActivity > threshold) {
      console.log(`Cleaning up inactive workspace: ${workspaceId}`);
      workspaces.delete(workspaceId);
      activeConnections.delete(workspaceId);

      yjsUtils.cleanupYjsDoc(workspaceId);

      removed.push(workspaceId);
    }
  }

  return removed;
}

export function getWorkspaceState(workspaceId: string): WorkspaceState | null {
  const workspace = workspaces.get(workspaceId);
  if (!workspace) return null;

  return {
    whiteboardElements: Array.from(workspace.drawingsMap.values()),
    diagrams: Array.from(workspace.diagrams.values()),
    activeUsers: getActiveUserCount(workspaceId),
    allDrawings: Array.from(workspace.allDrawingsMap.values()),
    codeSnippets: workspace.codeSnippets || { language: 'javascript', content: '' },
    diagramContent: workspace.diagramContent || ''
  };
}

export function findWorkspaceIdByRef(workspaceRef: { id?: string } | null | undefined): string | null {
  return workspaceRef?.id || null;
}

export function updateSharingMode(workspaceId: string, newMode: SharingMode): boolean {
  const workspace = workspaces.get(workspaceId);
  if (!workspace) return false;

  const validModes = Object.values(SHARING_MODES);
  if (!validModes.includes(newMode)) return false;

  workspace.sharingMode = newMode;
  updateLastActivity(workspaceId);
  return true;
}
