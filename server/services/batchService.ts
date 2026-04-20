import type { Server } from 'socket.io';
import { config, SOCKET_EVENTS } from '../config';
import * as workspaceService from './workspaceService';
import type { WhiteboardElement, UpdateQueue } from '../types';

const updateQueues = new Map<string, UpdateQueue>();

export function queueUpdate(workspaceId: string, elements: WhiteboardElement[], senderSocketId: string): void {
  if (!workspaceService.workspaceExists(workspaceId)) {
    return;
  }
  if (!updateQueues.has(workspaceId)) {
    updateQueues.set(workspaceId, { elements: new Map(), senders: new Set() });
  }
  const queue = updateQueues.get(workspaceId)!;
  queue.senders.add(senderSocketId);
  elements.forEach(el => {
    if (el?.id) queue.elements.set(el.id, el);
  });
}

export function startBatchInterval(io: Server): NodeJS.Timeout {
  return setInterval(() => {
    try {
      for (const [workspaceId, queue] of updateQueues.entries()) {
        if (!workspaceService.workspaceExists(workspaceId)) {
          updateQueues.delete(workspaceId);
          continue;
        }
        if (queue.elements.size > 0) {
          const batchedElements = Array.from(queue.elements.values());
          const senders = new Set(queue.senders);
          const roomSockets = io.sockets.adapter.rooms.get(workspaceId);

          queue.elements.clear();
          queue.senders.clear();

          if (roomSockets) {
            setImmediate(() => {
              try {
                for (const socketId of roomSockets) {
                  if (!senders.has(socketId)) {
                    const socket = io.sockets.sockets.get(socketId);
                    if (socket) {
                      socket.emit(SOCKET_EVENTS.WHITEBOARD_UPDATE, batchedElements);
                    }
                  }
                }
              } catch (innerError) {
                console.error('Error in batched update emission:', innerError);
              }
            });
          }
        }
      }
    } catch (error) {
      console.error('Error in batched update interval:', error);
    }
  }, config.batch.interval);
}

export function cleanupWorkspaceQueues(workspaceIds: string[]): void {
  workspaceIds.forEach(id => updateQueues.delete(id));
}
