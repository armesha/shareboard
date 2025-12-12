/**
 * Minimal Y-websocket server utilities
 * Replaces y-websocket/bin/utils to avoid deprecated level-* dependencies
 */

import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import type { IncomingMessage } from 'http';
import type WebSocket from 'ws';
import * as workspaceService from './services/workspaceService';
import * as permissionService from './services/permissionService';
import { SHARING_MODES } from './config';
import type { User } from './types';

const messageSync = 0;
const messageAwareness = 1;
const messageSyncStep2 = 1;
const messageSyncUpdate = 2;

const docs = new Map<string, WSSharedDoc>();
const connPermissions = new WeakMap<WebSocket, boolean>();
const persistTimers = new Map<string, ReturnType<typeof setTimeout>>();
const PERSIST_DEBOUNCE_MS = 250;

const PING_TIMEOUT = 30000;

const connectionAttempts = new Map<string, { count: number; windowStart: number }>();
const MAX_ATTEMPTS_PER_MINUTE = 10;
const RATE_LIMIT_WINDOW = 60000;

export class WSSharedDoc extends Y.Doc {
  name: string;
  conns: Map<WebSocket, Set<number>>;
  awareness: awarenessProtocol.Awareness;

  constructor(name: string) {
    super({ gc: true });
    this.name = name;
    this.conns = new Map();
    this.awareness = new awarenessProtocol.Awareness(this);
    this.awareness.setLocalState(null);

    this.awareness.on('update', ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, conn: WebSocket | null) => {
      const changedClients = added.concat(updated, removed);
      if (conn !== null) {
        const connControlledIDs = this.conns.get(conn);
        if (connControlledIDs !== undefined) {
          added.forEach((clientID) => connControlledIDs.add(clientID));
          removed.forEach((clientID) => connControlledIDs.delete(clientID));
        }
      }
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageAwareness);
      encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients));
      const buff = encoding.toUint8Array(encoder);
      this.conns.forEach((_, c) => {
        send(this, c, buff);
      });
    });

    this.on('update', (update: Uint8Array, _origin: unknown) => {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageSync);
      syncProtocol.writeUpdate(encoder, update);
      const message = encoding.toUint8Array(encoder);
      this.conns.forEach((_, conn) => send(this, conn, message));

      schedulePersist(this.name, this);
    });
  }
}

function schedulePersist(workspaceId: string, doc: WSSharedDoc): void {
  const existing = persistTimers.get(workspaceId);
  if (existing) {
    clearTimeout(existing);
  }
  const timeoutId = setTimeout(() => {
    persistTimers.delete(workspaceId);
    const workspace = workspaceService.getWorkspace(workspaceId);
    if (!workspace) {
      return;
    }
    try {
      const codeText = doc.getText('code').toString();
      const diagramText = doc.getText('diagram').toString();
      if (!workspace.codeSnippets) {
        workspace.codeSnippets = { language: 'javascript', content: '' };
      }
      workspace.codeSnippets.content = codeText;
      workspace.diagramContent = diagramText;
      workspaceService.updateLastActivity(workspaceId);
    } catch (err) {
      console.error('Failed to persist Yjs content:', err);
    }
  }, PERSIST_DEBOUNCE_MS);
  persistTimers.set(workspaceId, timeoutId);
}

function getYDoc(docname: string): WSSharedDoc {
  let doc = docs.get(docname);
  if (!doc) {
    doc = new WSSharedDoc(docname);
    docs.set(docname, doc);
  }
  return doc;
}

function messageListener(conn: WebSocket, doc: WSSharedDoc, message: Uint8Array): void {
  try {
    const encoder = encoding.createEncoder();
    const decoder = decoding.createDecoder(message);
    const messageType = decoding.readVarUint(decoder);

    switch (messageType) {
      case messageSync: {
        const syncMessageType = decoding.readVarUint(decoder);
        const hasWriteAccess = connPermissions.get(conn) ?? false;

        // Allow full sync handshake for read-only users.
        // Only block client-originated updates.
        if (syncMessageType === messageSyncUpdate && !hasWriteAccess) return;

        const syncDecoder = decoding.createDecoder(message);
        decoding.readVarUint(syncDecoder);

        encoding.writeVarUint(encoder, messageSync);
        syncProtocol.readSyncMessage(syncDecoder, encoder, doc, conn);
        if (encoding.length(encoder) > 1) {
          send(doc, conn, encoding.toUint8Array(encoder));
        }
        break;
      }
      case messageAwareness:
        awarenessProtocol.applyAwarenessUpdate(
          doc.awareness,
          decoding.readVarUint8Array(decoder),
          conn
        );
        break;
    }
  } catch (err) {
    console.error('Y-websocket message error:', err);
  }
}

function closeConn(doc: WSSharedDoc, conn: WebSocket): void {
  if (doc.conns.has(conn)) {
    const controlledIds = doc.conns.get(conn)!;
    doc.conns.delete(conn);
    awarenessProtocol.removeAwarenessStates(
      doc.awareness,
      Array.from(controlledIds),
      null
    );
    if (doc.conns.size === 0) {
      docs.delete(doc.name);
    }
  }
  try {
    conn.close();
  } catch {
  }
}

function send(doc: WSSharedDoc, conn: WebSocket, message: Uint8Array): void {
  if (conn.readyState !== conn.OPEN) {
    closeConn(doc, conn);
    return;
  }
  try {
    conn.send(message, (err) => {
      if (err) closeConn(doc, conn);
    });
  } catch {
    closeConn(doc, conn);
  }
}

export function cleanupYjsDoc(workspaceId: string): void {
  const doc = docs.get(workspaceId);
  if (!doc) {
    return;
  }

  const connections = Array.from(doc.conns.keys());
  connections.forEach((conn) => {
    closeConn(doc, conn);
  });

  docs.delete(workspaceId);

  console.log(`Cleaned up Yjs document for workspace: ${workspaceId}`);
}

export function setupWSConnection(
  conn: WebSocket,
  req: IncomingMessage,
  options?: { docName?: string; gc?: boolean }
): void {
  conn.binaryType = 'arraybuffer';
  const opts = options ?? {};

  const forwardedFor = req.headers['x-forwarded-for'];
  const clientIp = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor?.toString())
    || req.socket.remoteAddress
    || 'unknown';

  const now = Date.now();
  const attempts = connectionAttempts.get(clientIp) || { count: 0, windowStart: now };

  if (now - attempts.windowStart > RATE_LIMIT_WINDOW) {
    attempts.count = 0;
    attempts.windowStart = now;
  }

  if (attempts.count >= MAX_ATTEMPTS_PER_MINUTE) {
    console.log(`Yjs connection rejected: rate limit exceeded for IP ${clientIp}`);
    conn.close(4429, 'Too many connection attempts');
    connectionAttempts.set(clientIp, attempts);
    return;
  }

  attempts.count++;
  connectionAttempts.set(clientIp, attempts);

  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const pathname = url.pathname;
  const pathPart = pathname.slice(1).split('?')[0] ?? '';
  const workspaceId = opts.docName ?? (pathPart.replace(/^yjs\//, '') || 'default');

  const userId = url.searchParams.get('userId') || 'yjs-connection';
  const accessToken = url.searchParams.get('accessToken');

  const workspace = workspaceService.getWorkspace(workspaceId);
  if (!workspace) {
    console.log(`Yjs connection rejected: workspace ${workspaceId} not found`);
    conn.close(4404, 'Workspace not found');
    return;
  }

  const user: User = {
    userId,
    accessToken: accessToken || null,
    hasEditAccess: false,
    isOwner: userId === workspace.owner
  };

  const mode = workspace.sharingMode || SHARING_MODES.READ_WRITE_SELECTED;
  let hasWriteAccess = false;

  if (mode === SHARING_MODES.READ_WRITE_ALL) {
    hasWriteAccess = true;
  } else if (mode === SHARING_MODES.READ_ONLY) {
    hasWriteAccess = false;
  } else {
    hasWriteAccess = permissionService.checkWritePermission(workspace, user);
  }

  if (hasWriteAccess) {
    user.hasEditAccess = true;
  }

  connPermissions.set(conn, hasWriteAccess);

  const doc = getYDoc(workspaceId);

  doc.conns.set(conn, new Set());

  conn.on('message', (message: ArrayBuffer | Buffer) => {
    const data = message instanceof ArrayBuffer
      ? new Uint8Array(message)
      : new Uint8Array(message.buffer, message.byteOffset, message.byteLength);
    messageListener(conn, doc, data);
  });

  let pongReceived = true;
  const pingInterval = setInterval(() => {
    if (!pongReceived) {
      if (doc.conns.has(conn)) {
        closeConn(doc, conn);
      }
      clearInterval(pingInterval);
    } else if (doc.conns.has(conn)) {
      pongReceived = false;
      try {
        conn.ping();
      } catch {
        closeConn(doc, conn);
        clearInterval(pingInterval);
      }
    }
  }, PING_TIMEOUT);

  conn.on('close', () => {
    closeConn(doc, conn);
    clearInterval(pingInterval);
  });

  conn.on('pong', () => {
    pongReceived = true;
  });

  {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeSyncStep1(encoder, doc);
    send(doc, conn, encoding.toUint8Array(encoder));
  }

  const awarenessStates = doc.awareness.getStates();
  if (awarenessStates.size > 0) {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageAwareness);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(doc.awareness, Array.from(awarenessStates.keys()))
    );
    send(doc, conn, encoding.toUint8Array(encoder));
  }
}
