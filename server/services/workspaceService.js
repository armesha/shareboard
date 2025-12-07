import crypto from 'crypto';
import { config, SHARING_MODES } from '../config.js';

const workspaces = new Map();
const activeConnections = new Map();
const userSessions = new Map();

export function generateKey(length = config.workspace.keyLength) {
  const bytes = crypto.randomBytes(Math.ceil(length * 3 / 4));
  return bytes.toString('base64')
    .replace(/[+/]/g, '')
    .replace(/=+$/, '')
    .slice(0, length);
}

export function generateEditToken() {
  return `edit_${crypto.randomBytes(8).toString('hex')}`;
}

export function createWorkspace(workspaceId, ownerId) {
  const workspace = {
    id: workspaceId,
    created: Date.now(),
    lastActivity: Date.now(),
    diagrams: new Map(),
    drawingsMap: new Map(),
    allDrawingsMap: new Map(),
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

export function getWorkspace(workspaceId) {
  return workspaces.get(workspaceId);
}

export function workspaceExists(workspaceId) {
  return workspaces.has(workspaceId);
}

export function deleteWorkspace(workspaceId) {
  workspaces.delete(workspaceId);
  activeConnections.delete(workspaceId);
}

export function updateLastActivity(workspaceId) {
  const workspace = workspaces.get(workspaceId);
  if (workspace) {
    workspace.lastActivity = Date.now();
  }
}

export function getActiveConnections(workspaceId) {
  if (!activeConnections.has(workspaceId)) {
    activeConnections.set(workspaceId, new Set());
  }
  return activeConnections.get(workspaceId);
}

export function addConnection(workspaceId, socketId) {
  const connections = getActiveConnections(workspaceId);
  connections.add(socketId);
  return connections.size;
}

export function removeConnection(workspaceId, socketId) {
  const connections = activeConnections.get(workspaceId);
  if (connections) {
    connections.delete(socketId);
    return connections.size;
  }
  return 0;
}

export function getActiveUserCount(workspaceId) {
  const connections = activeConnections.get(workspaceId);
  if (!connections) return 0;

  const uniqueUsers = new Set();
  for (const socketId of connections) {
    const session = userSessions.get(socketId);
    if (session && session.userId) {
      uniqueUsers.add(session.userId);
    }
  }
  return uniqueUsers.size;
}

export function setUserSession(socketId, userInfo) {
  userSessions.set(socketId, userInfo);
}

export function getUserSession(socketId) {
  return userSessions.get(socketId);
}

export function removeUserSession(socketId) {
  userSessions.delete(socketId);
}

export function getWorkspaceUsers(workspaceId) {
  const workspace = workspaces.get(workspaceId);
  if (!workspace) return [];

  const connections = activeConnections.get(workspaceId) || new Set();
  const users = [];

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

export function cleanupInactiveWorkspaces() {
  const threshold = config.cleanup.inactiveThresholdMs;
  const now = Date.now();
  const removed = [];

  for (const [workspaceId, workspace] of workspaces.entries()) {
    const connections = activeConnections.get(workspaceId) || new Set();

    if (connections.size === 0 && now - workspace.lastActivity > threshold) {
      console.log(`Cleaning up inactive workspace: ${workspaceId}`);
      workspaces.delete(workspaceId);
      activeConnections.delete(workspaceId);
      removed.push(workspaceId);
    }
  }

  return removed;
}

export function getWorkspaceState(workspaceId) {
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

export function findWorkspaceIdByRef(workspaceRef) {
  return workspaceRef?.id || null;
}

export function updateSharingMode(workspaceId, newMode) {
  const workspace = workspaces.get(workspaceId);
  if (!workspace) return false;

  const validModes = Object.values(SHARING_MODES);
  if (!validModes.includes(newMode)) return false;

  workspace.sharingMode = newMode;
  updateLastActivity(workspaceId);
  return true;
}
