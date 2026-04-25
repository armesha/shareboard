import { SOCKET_EVENTS } from '../config';
import { withWorkspaceAuth } from '../middleware/socketAuth';
import {
  isValidDrawingId,
  isValidShapeId,
  isValidShapeType,
  isValidColor,
  isValidBrushWidth,
  isValidPoints,
  isValidShapeData
} from '../validation/validators';
import { logger } from '../utils/logger';
import type { Handler, HandlerData, HandlerResult } from '../types';

export interface DrawingStartData extends HandlerData {
  drawingId: unknown;
  color: unknown;
  brushWidth: unknown;
}

export interface DrawingStreamData extends HandlerData {
  drawingId: unknown;
  points: unknown;
}

export interface DrawingEndData extends HandlerData {
  drawingId: unknown;
}

export interface ShapeDrawingStartData extends HandlerData {
  shapeId: unknown;
  shapeType: unknown;
  data: unknown;
}

export interface ShapeDrawingUpdateData extends HandlerData {
  shapeId: unknown;
  data: unknown;
}

export interface ShapeDrawingEndData extends HandlerData {
  shapeId: unknown;
}

const PERMISSION_MESSAGE = 'You do not have permission to draw';

const handleDrawingStartCore: Handler<DrawingStartData> = (
  { workspaceId, drawingId, color, brushWidth },
  { socket }
): HandlerResult => {
  try {
    if (!isValidDrawingId(drawingId) || !isValidColor(color) || !isValidBrushWidth(brushWidth)) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid drawing data' });
      return { success: false, reason: 'invalid_input' };
    }
    socket.to(workspaceId).emit(SOCKET_EVENTS.DRAWING_START, {
      drawingId,
      userId: socket.id,
      color,
      brushWidth
    });
    return { success: true };
  } catch (error) {
    logger.error({ err: error, socketId: socket.id, workspaceId }, 'drawing handler failed');
    return { success: false, error };
  }
};

export const handleDrawingStart = withWorkspaceAuth(handleDrawingStartCore, {
  permissionErrorMessage: PERMISSION_MESSAGE
});

const handleDrawingStreamCore: Handler<DrawingStreamData> = (
  { workspaceId, drawingId, points },
  { socket }
): HandlerResult => {
  try {
    if (!isValidDrawingId(drawingId) || !isValidPoints(points)) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid drawing stream data' });
      return { success: false, reason: 'invalid_input' };
    }
    socket.to(workspaceId).emit(SOCKET_EVENTS.DRAWING_STREAM, { drawingId, points });
    return { success: true };
  } catch (error) {
    logger.error({ err: error, socketId: socket.id, workspaceId }, 'drawing handler failed');
    return { success: false, error };
  }
};

export const handleDrawingStream = withWorkspaceAuth(handleDrawingStreamCore, {
  permissionErrorMessage: PERMISSION_MESSAGE
});

const handleDrawingEndCore: Handler<DrawingEndData> = (
  { workspaceId, drawingId },
  { socket }
): HandlerResult => {
  try {
    if (!isValidDrawingId(drawingId)) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid drawing ID' });
      return { success: false, reason: 'invalid_input' };
    }
    socket.to(workspaceId).emit(SOCKET_EVENTS.DRAWING_END, { drawingId });
    return { success: true };
  } catch (error) {
    logger.error({ err: error, socketId: socket.id, workspaceId }, 'drawing handler failed');
    return { success: false, error };
  }
};

export const handleDrawingEnd = withWorkspaceAuth(handleDrawingEndCore, {
  permissionErrorMessage: PERMISSION_MESSAGE
});

const handleShapeDrawingStartCore: Handler<ShapeDrawingStartData> = (
  { workspaceId, shapeId, shapeType, data },
  { socket }
): HandlerResult => {
  try {
    if (!isValidShapeId(shapeId) || !isValidShapeType(shapeType) || !isValidShapeData(data)) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid shape data' });
      return { success: false, reason: 'invalid_input' };
    }
    socket.to(workspaceId).emit(SOCKET_EVENTS.SHAPE_DRAWING_START, {
      shapeId,
      userId: socket.id,
      shapeType,
      data
    });
    return { success: true };
  } catch (error) {
    logger.error({ err: error, socketId: socket.id, workspaceId }, 'drawing handler failed');
    return { success: false, error };
  }
};

export const handleShapeDrawingStart = withWorkspaceAuth(handleShapeDrawingStartCore, {
  permissionErrorMessage: PERMISSION_MESSAGE
});

const handleShapeDrawingUpdateCore: Handler<ShapeDrawingUpdateData> = (
  { workspaceId, shapeId, data },
  { socket }
): HandlerResult => {
  try {
    if (!isValidShapeId(shapeId) || !isValidShapeData(data)) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid shape update data' });
      return { success: false, reason: 'invalid_input' };
    }
    socket.to(workspaceId).emit(SOCKET_EVENTS.SHAPE_DRAWING_UPDATE, { shapeId, data });
    return { success: true };
  } catch (error) {
    logger.error({ err: error, socketId: socket.id, workspaceId }, 'drawing handler failed');
    return { success: false, error };
  }
};

export const handleShapeDrawingUpdate = withWorkspaceAuth(handleShapeDrawingUpdateCore, {
  permissionErrorMessage: PERMISSION_MESSAGE
});

const handleShapeDrawingEndCore: Handler<ShapeDrawingEndData> = (
  { workspaceId, shapeId },
  { socket }
): HandlerResult => {
  try {
    if (!isValidShapeId(shapeId)) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid shape ID' });
      return { success: false, reason: 'invalid_input' };
    }
    socket.to(workspaceId).emit(SOCKET_EVENTS.SHAPE_DRAWING_END, { shapeId });
    return { success: true };
  } catch (error) {
    logger.error({ err: error, socketId: socket.id, workspaceId }, 'drawing handler failed');
    return { success: false, error };
  }
};

export const handleShapeDrawingEnd = withWorkspaceAuth(handleShapeDrawingEndCore, {
  permissionErrorMessage: PERMISSION_MESSAGE
});
