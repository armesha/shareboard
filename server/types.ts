import type { Socket, Server } from 'socket.io';
import type { SharingMode } from '../shared/constants';

// ===== Core Types =====

export interface CodeSnippets {
  language: string;
  content: string;
}

export interface WhiteboardElement {
  id: string;
  type: string;
  data: Record<string, unknown>;
  timestamp?: number;
}

export interface Workspace {
  id: string;
  created: number;
  lastActivity: number;
  diagrams: Map<string, unknown>;
  drawingsMap: Map<string, WhiteboardElement>;
  allDrawingsMap: Map<string, WhiteboardElement>;
  drawingOrder: string[];
  diagramContent: string;
  codeSnippets: CodeSnippets;
  owner: string;
  sharingMode: SharingMode;
  allowedUsers: string[];
  editToken: string;
}

export interface UserSession {
  id: string;
  joinedAt: number;
  userId?: string;
  workspaceId?: string;
  accessToken?: string | null;
  hasEditAccess?: boolean;
  isOwner?: boolean;
}

export interface WorkspaceUser {
  id: string | undefined;
  online: boolean;
  isOwner: boolean;
}

export interface WorkspaceState {
  whiteboardElements: WhiteboardElement[];
  diagrams: unknown[];
  activeUsers: number;
  allDrawings: WhiteboardElement[];
  codeSnippets: CodeSnippets;
  diagramContent: string;
}

// ===== Permission Types =====

export interface User {
  userId: string;
  accessToken?: string | null;
  hasEditAccess?: boolean;
  isOwner?: boolean;
}

export interface EditAccessResult {
  hasEditAccess: boolean;
  isOwner: boolean;
}

export interface SharingInfo {
  sharingMode: SharingMode;
  allowedUsers: string[];
  isOwner: boolean;
  currentUser: string | null;
  owner: string;
  hasEditAccess: boolean;
  editToken?: string;
}

// ===== Handler Types =====

export interface CurrentUser {
  id: string;
  joinedAt: number;
  userId?: string;
  workspaceId?: string;
  accessToken?: string | null;
  hasEditAccess?: boolean;
  isOwner?: boolean;
}

export interface CurrentWorkspaceRef {
  current: Workspace | null;
}

export interface HandlerContext {
  socket: Socket;
  io?: Server;
  currentUser: CurrentUser;
  currentWorkspaceRef?: CurrentWorkspaceRef;
  queueUpdate?: (workspaceId: string, elements: WhiteboardElement[], senderSocketId: string) => void;
  workspace?: Workspace;
}

export interface HandlerResult {
  success: boolean;
  reason?: string;
  error?: unknown;
  workspace?: Workspace;
  isNewWorkspace?: boolean;
  editToken?: string;
  userId?: string;
  disconnectedClients?: string[];
}

export interface HandlerData {
  workspaceId: string;
}

export type Handler<T extends HandlerData> = (
  data: T,
  context: HandlerContext
) => HandlerResult | Promise<HandlerResult>;

// ===== Socket Event Data Types =====

export interface JoinWorkspaceData extends HandlerData {
  userId?: string;
  accessToken?: string | null;
}

export interface WhiteboardUpdateData extends HandlerData {
  elements: WhiteboardElement[];
}

export interface DeleteElementData extends HandlerData {
  elementId: string;
}

export interface DeleteDiagramData extends HandlerData {
  diagramId: string;
}

export interface CodeUpdateData extends HandlerData {
  language: string;
  content?: string;
}

export interface DiagramUpdateData extends HandlerData {
  content: string;
}

export interface ChangeSharingModeData extends HandlerData {
  sharingMode: SharingMode;
}

export interface GetEditTokenData extends HandlerData {}

export interface SetEditTokenData extends HandlerData {
  editToken: string;
}

export interface InviteUserData extends HandlerData {
  email: string;
}

export interface EndSessionData extends HandlerData {}

// ===== Validation Types =====

export interface Position {
  x: number;
  y: number;
}

export interface UpdateQueue {
  elements: Map<string, WhiteboardElement>;
  senders: Set<string>;
}

export interface RateLimitRecord {
  count: number;
  windowStart: number;
}
