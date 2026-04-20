import { config, SOCKET_EVENTS } from '../config';
import { withWorkspaceAuth } from '../middleware/socketAuth';
import { isValidWorkspaceId, isValidElement } from './elementValidation';
import type { Handler, WhiteboardUpdateData, DeleteElementData, HandlerResult, HandlerData } from '../types';

export const MAX_ELEMENTS_PER_UPDATE = config.validation.workspace.maxElementsPerUpdate;
const MAX_DRAWINGS = config.validation.workspace.maxDrawings;

interface WhiteboardClearData extends HandlerData {
  workspaceId: string;
}

const handleWhiteboardUpdateCore: Handler<WhiteboardUpdateData> = (
  { workspaceId, elements },
  { socket, workspace, queueUpdate }
): HandlerResult => {
  try {
    if (!isValidWorkspaceId(workspaceId)) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid workspace ID' });
      return { success: false, reason: 'invalid_workspace_id' };
    }

    if (!Array.isArray(elements)) {
      return { success: false, reason: 'invalid_input' };
    }

    if (elements.length > MAX_ELEMENTS_PER_UPDATE) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Too many elements in single update' });
      return { success: false, reason: 'too_many_elements' };
    }

    if (!elements.every(isValidElement)) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid element payload' });
      return { success: false, reason: 'invalid_element' };
    }

    if (!workspace) {
      return { success: false, reason: 'workspace_not_found' };
    }

    const drawingsMap = workspace.drawingsMap;
    const allDrawingsMap = workspace.allDrawingsMap;
    const drawingOrder = workspace.drawingOrder;

    elements.forEach(element => {
      if (element?.id) {
        const newElement = { ...element, timestamp: Date.now() };
        const isNew = !drawingsMap.has(element.id);
        drawingsMap.set(element.id, newElement);
        allDrawingsMap.set(element.id, newElement);
        if (isNew) {
          drawingOrder.push(element.id);
        }
      }
    });

    while (allDrawingsMap.size > MAX_DRAWINGS && drawingOrder.length > 0) {
      const oldestId = drawingOrder.shift();
      if (oldestId) {
        allDrawingsMap.delete(oldestId);
      }
    }

    if (drawingOrder.length > MAX_DRAWINGS) {
      const excess = drawingOrder.length - MAX_DRAWINGS;
      const removedIds = drawingOrder.splice(0, excess);
      removedIds.forEach(id => {
        allDrawingsMap.delete(id);
        drawingsMap.delete(id);
      });
    }

    if (queueUpdate) {
      queueUpdate(workspaceId, elements, socket.id);
    }
    return { success: true };
  } catch (error) {
    socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to update whiteboard' });
    return { success: false, error };
  }
};

export const handleWhiteboardUpdate = withWorkspaceAuth(handleWhiteboardUpdateCore);

const handleWhiteboardClearCore: Handler<WhiteboardClearData> = (
  { workspaceId },
  { socket, workspace }
): HandlerResult => {
  try {
    if (!workspace) {
      return { success: false, reason: 'workspace_not_found' };
    }

    workspace.drawingsMap.clear();
    workspace.allDrawingsMap.clear();
    workspace.drawingOrder.length = 0;
    socket.broadcast.to(workspaceId).emit(SOCKET_EVENTS.WHITEBOARD_CLEAR);

    return { success: true };
  } catch (error) {
    socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to clear whiteboard' });
    return { success: false, error };
  }
};

export const handleWhiteboardClear = withWorkspaceAuth(handleWhiteboardClearCore, {
  permissionErrorMessage: 'You do not have permission to clear'
});

const handleDeleteElementCore: Handler<DeleteElementData> = (
  { workspaceId, elementId },
  { socket, workspace }
): HandlerResult => {
  try {
    if (!elementId) {
      return { success: false, reason: 'invalid_input' };
    }

    if (!workspace) {
      return { success: false, reason: 'workspace_not_found' };
    }

    workspace.drawingsMap.delete(elementId);
    workspace.allDrawingsMap.delete(elementId);
    const orderIndex = workspace.drawingOrder.indexOf(elementId);
    if (orderIndex !== -1) {
      workspace.drawingOrder.splice(orderIndex, 1);
    }

    socket.broadcast.to(workspaceId).emit(SOCKET_EVENTS.DELETE_ELEMENT, { workspaceId, elementId });

    return { success: true };
  } catch (error) {
    socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to delete element' });
    return { success: false, error };
  }
};

export const handleDeleteElement = withWorkspaceAuth(handleDeleteElementCore, {
  permissionErrorMessage: 'You do not have permission to delete'
});
