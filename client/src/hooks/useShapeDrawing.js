import { useCallback, useRef, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { SHAPES, SOCKET_EVENTS, TIMING } from '../constants';
import { createShape } from '../factories/shapeFactory';
import { getWorkspaceId } from '../utils';
import { createBatchedRender } from '../utils/batchedRender';

export function useShapeDrawing({ canvas, selectedShape, color, width, addElement, disabled, socket, canWrite }) {
  const isDrawing = useRef(false);
  const currentShape = useRef(null);
  const startPoint = useRef(null);
  const currentShapeIdRef = useRef(null);
  const lastEmitTimeRef = useRef(0);

  // Create batched render function for the canvas
  const batchedRender = useMemo(() => createBatchedRender(canvas), [canvas]);

  const startShape = useCallback((pointer) => {
    if (disabled || !canvas || !selectedShape) return;

    // eslint-disable-next-line react-hooks/immutability
    canvas.selection = false;
    isDrawing.current = true;
    startPoint.current = pointer;

    const shapeId = uuidv4();
    currentShapeIdRef.current = shapeId;

    const commonProps = {
      left: pointer.x,
      top: pointer.y,
      stroke: color,
      strokeWidth: width,
      selectable: false,
      evented: false,
      hasControls: false,
      hasBorders: false,
      lockMovementX: true,
      lockMovementY: true,
      id: shapeId,
    };

    const shapeObj = createShape(selectedShape, commonProps);

    if (!shapeObj) {
      currentShapeIdRef.current = null;
      return;
    }

    canvas.add(shapeObj);
    currentShape.current = shapeObj;

    if (socket && canWrite && canWrite()) {
      const workspaceId = getWorkspaceId();
      if (workspaceId) {
        socket.emit(SOCKET_EVENTS.SHAPE_DRAWING_START, {
          workspaceId,
          shapeId,
          shapeType: selectedShape,
          data: shapeObj.toObject(['id'])
        });
      }
    }
  }, [canvas, selectedShape, color, width, disabled, socket, canWrite]);

  const updateShape = useCallback((pointer, isCtrlPressed = false) => {
    if (disabled || !isDrawing.current || !startPoint.current || !currentShape.current) return;

    const shape = currentShape.current;
    const startX = startPoint.current.x;
    const startY = startPoint.current.y;
    const deltaWidth = pointer.x - startX;
    const deltaHeight = pointer.y - startY;

    switch (selectedShape) {
      case SHAPES.RECTANGLE: {
        if (isCtrlPressed) {
          const size = Math.max(Math.abs(deltaWidth), Math.abs(deltaHeight));
          shape.set({
            width: size,
            height: size,
            left: deltaWidth > 0 ? startX : startX - size,
            top: deltaHeight > 0 ? startY : startY - size
          });
        } else {
          shape.set({
            width: Math.abs(deltaWidth),
            height: Math.abs(deltaHeight),
            left: deltaWidth > 0 ? startX : pointer.x,
            top: deltaHeight > 0 ? startY : pointer.y
          });
        }
        break;
      }

      case SHAPES.CIRCLE: {
        const radius = Math.sqrt(deltaWidth * deltaWidth + deltaHeight * deltaHeight) / 2;
        shape.set({
          radius: radius,
          left: startX - radius,
          top: startY - radius
        });
        break;
      }

      case SHAPES.ELLIPSE: {
        const rx = Math.abs(deltaWidth) / 2;
        const ry = Math.abs(deltaHeight) / 2;
        shape.set({
          rx: rx,
          ry: ry,
          left: deltaWidth > 0 ? startX : startX - rx * 2,
          top: deltaHeight > 0 ? startY : startY - ry * 2
        });
        break;
      }

      case SHAPES.TRIANGLE: {
        const isUpsideDown = deltaHeight < 0;
        const absWidth = Math.abs(deltaWidth) || 1;
        const absHeight = Math.abs(deltaHeight) || 1;

        let triWidth = absWidth;
        let triHeight = absHeight;

        if (isCtrlPressed) {
          const size = Math.max(absWidth, absHeight);
          triWidth = size;
          triHeight = size;
        }

        const halfWidth = triWidth / 2;
        let points;

        if (isUpsideDown) {
          points = [
            { x: startX, y: startY },
            { x: startX - halfWidth, y: startY - triHeight },
            { x: startX + halfWidth, y: startY - triHeight }
          ];
        } else {
          points = [
            { x: startX, y: startY },
            { x: startX - halfWidth, y: startY + triHeight },
            { x: startX + halfWidth, y: startY + triHeight }
          ];
        }

        shape.set({ points: points });
        shape._setPositionDimensions({});
        break;
      }

      case SHAPES.STAR: {
        const outerRadius = Math.sqrt(deltaWidth * deltaWidth + deltaHeight * deltaHeight) / 2;
        const innerRadius = outerRadius * 0.4;

        const starPoints = [];
        for (let i = 0; i < 10; i++) {
          const angle = (Math.PI / 2) + (i * Math.PI / 5);
          const r = i % 2 === 0 ? outerRadius : innerRadius;
          starPoints.push({
            x: startX + r * Math.cos(angle),
            y: startY - r * Math.sin(angle)
          });
        }
        shape.set({ points: starPoints });
        shape._setPositionDimensions({});
        break;
      }

      case SHAPES.DIAMOND: {
        const radius = Math.sqrt(deltaWidth * deltaWidth + deltaHeight * deltaHeight) / 2;

        const diamondPoints = [
          { x: startX, y: startY - radius },
          { x: startX + radius, y: startY },
          { x: startX, y: startY + radius },
          { x: startX - radius, y: startY }
        ];
        shape.set({ points: diamondPoints });
        shape._setPositionDimensions({});
        break;
      }

      case SHAPES.PENTAGON: {
        const radius = Math.sqrt(deltaWidth * deltaWidth + deltaHeight * deltaHeight) / 2;

        const pentPoints = [];
        for (let i = 0; i < 5; i++) {
          const angle = (Math.PI / 2) + (i * 2 * Math.PI / 5);
          pentPoints.push({
            x: startX + radius * Math.cos(angle),
            y: startY - radius * Math.sin(angle)
          });
        }
        shape.set({ points: pentPoints });
        shape._setPositionDimensions({});
        break;
      }

      case SHAPES.HEXAGON: {
        const radius = Math.sqrt(deltaWidth * deltaWidth + deltaHeight * deltaHeight) / 2;

        const hexPoints = [];
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 2) + (i * Math.PI / 3);
          hexPoints.push({
            x: startX + radius * Math.cos(angle),
            y: startY - radius * Math.sin(angle)
          });
        }
        shape.set({ points: hexPoints });
        shape._setPositionDimensions({});
        break;
      }

      case SHAPES.OCTAGON: {
        const radius = Math.sqrt(deltaWidth * deltaWidth + deltaHeight * deltaHeight) / 2;

        const octPoints = [];
        for (let i = 0; i < 8; i++) {
          const angle = (Math.PI / 2) + (i * Math.PI / 4);
          octPoints.push({
            x: startX + radius * Math.cos(angle),
            y: startY - radius * Math.sin(angle)
          });
        }
        shape.set({ points: octPoints });
        shape._setPositionDimensions({});
        break;
      }

      case SHAPES.CROSS: {
        const size = Math.sqrt(deltaWidth * deltaWidth + deltaHeight * deltaHeight) / 2;
        const armWidth = size / 3;

        const crossPoints = [
          { x: startX - armWidth, y: startY - size },
          { x: startX + armWidth, y: startY - size },
          { x: startX + armWidth, y: startY - armWidth },
          { x: startX + size, y: startY - armWidth },
          { x: startX + size, y: startY + armWidth },
          { x: startX + armWidth, y: startY + armWidth },
          { x: startX + armWidth, y: startY + size },
          { x: startX - armWidth, y: startY + size },
          { x: startX - armWidth, y: startY + armWidth },
          { x: startX - size, y: startY + armWidth },
          { x: startX - size, y: startY - armWidth },
          { x: startX - armWidth, y: startY - armWidth }
        ];
        shape.set({ points: crossPoints });
        shape._setPositionDimensions({});
        break;
      }
    }

    shape.setCoords();
    batchedRender();

    if (socket && canWrite && canWrite() && currentShapeIdRef.current) {
      const now = Date.now();
      if (now - lastEmitTimeRef.current >= TIMING.DRAWING_STREAM_THROTTLE) {
        lastEmitTimeRef.current = now;
        const workspaceId = getWorkspaceId();
        if (workspaceId) {
          socket.emit(SOCKET_EVENTS.SHAPE_DRAWING_UPDATE, {
            workspaceId,
            shapeId: currentShapeIdRef.current,
            data: shape.toObject(['id'])
          });
        }
      }
    }
  }, [canvas, selectedShape, disabled, socket, canWrite, batchedRender]);

  const finishShape = useCallback(() => {
    if (disabled || !isDrawing.current || !canvas) return;

    isDrawing.current = false;

    if (currentShape.current) {
      const shape = currentShape.current;
      shape.setCoords();

      addElement({
        id: shape.id,
        type: shape.type,
        data: {
          ...shape.toObject(['id'])
        }
      });

      if (socket && canWrite && canWrite() && currentShapeIdRef.current) {
        const workspaceId = getWorkspaceId();
        if (workspaceId) {
          socket.emit(SOCKET_EVENTS.SHAPE_DRAWING_END, {
            workspaceId,
            shapeId: currentShapeIdRef.current
          });
        }
      }

      currentShape.current = null;
    }

    currentShapeIdRef.current = null;
    startPoint.current = null;
    batchedRender();
  }, [canvas, addElement, disabled, socket, canWrite, batchedRender]);

  const cancelShape = useCallback(() => {
    if (currentShape.current && canvas) {
      canvas.remove(currentShape.current);
      batchedRender();
    }

    if (socket && canWrite && canWrite() && currentShapeIdRef.current) {
      const workspaceId = getWorkspaceId();
      if (workspaceId) {
        socket.emit(SOCKET_EVENTS.SHAPE_DRAWING_END, {
          workspaceId,
          shapeId: currentShapeIdRef.current
        });
      }
    }

    isDrawing.current = false;
    currentShape.current = null;
    currentShapeIdRef.current = null;
    startPoint.current = null;
  }, [canvas, socket, canWrite, batchedRender]);

  return {
    isDrawing,
    startShape,
    updateShape,
    finishShape,
    cancelShape
  };
}
