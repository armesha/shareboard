import { useCallback, useRef, useMemo } from 'react';
import { fabric } from 'fabric';
import { v4 as uuidv4 } from 'uuid';
import { TOOLS, SOCKET_EVENTS, TIMING } from '../constants';
import { getWorkspaceId } from '../utils';
import { createBatchedRender } from '../utils/batchedRender';

export function useLineDrawing({ canvas, tool, color, width, addElement, disabled, socket }) {
  const isDrawing = useRef(false);
  const currentLine = useRef(null);
  const startPoint = useRef(null);
  const currentShapeIdRef = useRef(null);
  const lastEmitTimeRef = useRef(0);

  // Create batched render function for this canvas
  const batchedRender = useMemo(() => createBatchedRender(canvas), [canvas]);

  const startLine = useCallback((pointer) => {
    if (disabled || !canvas) return;
    if (tool !== TOOLS.LINE && tool !== TOOLS.ARROW) return;

    // eslint-disable-next-line react-hooks/immutability
    canvas.selection = false;
    isDrawing.current = true;
    startPoint.current = { x: pointer.x, y: pointer.y };

    const points = [pointer.x, pointer.y, pointer.x, pointer.y];
    const shapeId = uuidv4();
    currentShapeIdRef.current = shapeId;

    const commonProps = {
      stroke: color,
      strokeWidth: width,
      strokeLineCap: 'round',
      selectable: false,
      evented: false,
      hasControls: false,
      hasBorders: false,
      id: shapeId,
      objectCaching: false,
    };

    let lineObj;
    const shapeType = tool === TOOLS.ARROW ? 'arrow' : 'line';

    if (tool === TOOLS.ARROW) {
      lineObj = new fabric.Arrow(points, {
        ...commonProps,
        headLength: Math.max(width * 3, 12),
      });
    } else {
      lineObj = new fabric.Line(points, commonProps);
    }

    canvas.add(lineObj);
    currentLine.current = lineObj;

    if (socket && !disabled) {
      const workspaceId = getWorkspaceId();
      if (workspaceId) {
        socket.emit(SOCKET_EVENTS.SHAPE_DRAWING_START, {
          workspaceId,
          shapeId,
          shapeType,
          data: {
            x1: pointer.x,
            y1: pointer.y,
            x2: pointer.x,
            y2: pointer.y,
            stroke: color,
            strokeWidth: width,
            strokeLineCap: 'round',
            headLength: tool === TOOLS.ARROW ? Math.max(width * 3, 12) : undefined,
          }
        });
      }
    }
  }, [canvas, tool, color, width, disabled, socket]);

  const updateLine = useCallback((pointer, isShiftPressed = false) => {
    if (disabled || !isDrawing.current || !startPoint.current || !currentLine.current) return;

    const line = currentLine.current;
    const startX = startPoint.current.x;
    const startY = startPoint.current.y;

    let endX = pointer.x;
    let endY = pointer.y;

    if (isShiftPressed) {
      const deltaX = pointer.x - startX;
      const deltaY = pointer.y - startY;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      if (absX > absY * 2) {
        endY = startY;
      } else if (absY > absX * 2) {
        endX = startX;
      } else {
        const dist = Math.max(absX, absY);
        endX = startX + (deltaX > 0 ? dist : -dist);
        endY = startY + (deltaY > 0 ? dist : -dist);
      }
    }

    line.set({
      x1: startX,
      y1: startY,
      x2: endX,
      y2: endY,
    });

    line.setCoords();
    batchedRender();

    if (socket && !disabled && currentShapeIdRef.current) {
      const now = Date.now();
      if (now - lastEmitTimeRef.current >= TIMING.DRAWING_STREAM_THROTTLE) {
        lastEmitTimeRef.current = now;
        const workspaceId = getWorkspaceId();
        if (workspaceId) {
          socket.emit(SOCKET_EVENTS.SHAPE_DRAWING_UPDATE, {
            workspaceId,
            shapeId: currentShapeIdRef.current,
            data: {
              x1: startX,
              y1: startY,
              x2: endX,
              y2: endY,
              stroke: line.stroke,
              strokeWidth: line.strokeWidth,
              strokeLineCap: line.strokeLineCap,
              headLength: line.headLength,
            }
          });
        }
      }
    }
  }, [canvas, disabled, socket, batchedRender]);

  const finishLine = useCallback(() => {
    if (disabled || !isDrawing.current || !canvas) return;

    isDrawing.current = false;

    if (currentLine.current) {
      const line = currentLine.current;

      line.set({
        selectable: true,
        evented: true,
        hasControls: true,
        hasBorders: true,
      });
      line.setCoords();

      const baseData = line.toObject(['id', 'headLength', 'headAngle']);
      addElement({
        id: line.id,
        type: line.type,
        data: {
          ...baseData,
          x1: line.x1,
          y1: line.y1,
          x2: line.x2,
          y2: line.y2,
        }
      });

      if (socket && !disabled && currentShapeIdRef.current) {
        const workspaceId = getWorkspaceId();
        if (workspaceId) {
          socket.emit(SOCKET_EVENTS.SHAPE_DRAWING_END, {
            workspaceId,
            shapeId: currentShapeIdRef.current,
          });
        }
      }

      currentLine.current = null;
    }

    currentShapeIdRef.current = null;
    startPoint.current = null;
    batchedRender();
  }, [canvas, addElement, disabled, socket, batchedRender]);

  const cancelLine = useCallback(() => {
    if (currentLine.current && canvas) {
      canvas.remove(currentLine.current);
      batchedRender();
    }

    if (socket && !disabled && currentShapeIdRef.current) {
      const workspaceId = getWorkspaceId();
      if (workspaceId) {
        socket.emit(SOCKET_EVENTS.SHAPE_DRAWING_END, {
          workspaceId,
          shapeId: currentShapeIdRef.current
        });
      }
    }

    isDrawing.current = false;
    currentLine.current = null;
    currentShapeIdRef.current = null;
    startPoint.current = null;
  }, [canvas, socket, disabled, batchedRender]);

  return {
    isDrawingLine: isDrawing,
    startLine,
    updateLine,
    finishLine,
    cancelLine
  };
}
