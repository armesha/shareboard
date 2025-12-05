import { useEffect, useRef, useCallback } from 'react';
import { fabric } from 'fabric';
import { SOCKET_EVENTS } from '../constants';
import { createShapeFromData } from '../factories/shapeFactory';
import { createBatchedRender } from '../utils/batchedRender';
import '../utils/fabricArrow';

function pointsToSvgPath(points) {
  if (!points || points.length === 0) return '';
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length - 1; i++) {
    const curr = points[i];
    const next = points[i + 1];
    // Use current point as control point, midpoint to next as end point
    const midX = (curr.x + next.x) / 2;
    const midY = (curr.y + next.y) / 2;
    path += ` Q ${curr.x} ${curr.y} ${midX} ${midY}`;
  }

  // Line to the last point
  const last = points[points.length - 1];
  path += ` L ${last.x} ${last.y}`;

  return path;
}

export function useRemoteDrawing(socket, canvasRef) {
  const activeDrawingsRef = useRef(new Map());

  const handleDrawingStart = useCallback((data) => {
    const { drawingId, userId, color, brushWidth } = data;
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (socket && userId === socket.id) return;

    activeDrawingsRef.current.set(drawingId, {
      fabricPath: null,
      points: [],
      color,
      brushWidth,
      userId,
    });
  }, [canvasRef, socket]);

  const handleDrawingStream = useCallback((data) => {
    const { drawingId, points: newPoints } = data;
    const canvas = canvasRef.current;
    if (!canvas || !newPoints || newPoints.length === 0) return;

    const batchedRender = createBatchedRender(canvas);

    let drawingData = activeDrawingsRef.current.get(drawingId);

    if (!drawingData) {
      drawingData = {
        fabricPath: null,
        points: [],
        color: '#000000',
        brushWidth: 2,
      };
      activeDrawingsRef.current.set(drawingId, drawingData);
    }

    drawingData.points.push(...newPoints);

    const svgPathString = pointsToSvgPath(drawingData.points);

    if (drawingData.fabricPath) {
      // Reuse existing path object
      drawingData.fabricPath.set({
        path: fabric.util.parsePath(svgPathString),
        stroke: drawingData.color,
        strokeWidth: drawingData.brushWidth,
      });
      drawingData.fabricPath.setCoords();
    } else {
      // Create new path object only if it doesn't exist
      const updatedPath = new fabric.Path(svgPathString, {
        stroke: drawingData.color,
        strokeWidth: drawingData.brushWidth,
        fill: null,
        strokeLineCap: 'round',
        strokeLineJoin: 'round',
        selectable: false,
        evented: false,
        objectCaching: false,
      });

      updatedPath._isRemoteDrawing = true;
      updatedPath._drawingId = drawingId;

      canvas.add(updatedPath);
      drawingData.fabricPath = updatedPath;
    }

    batchedRender();
  }, [canvasRef]);

  const handleDrawingEnd = useCallback((data) => {
    const { drawingId } = data;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const batchedRender = createBatchedRender(canvas);

    const drawingData = activeDrawingsRef.current.get(drawingId);
    if (!drawingData) return;

    if (drawingData.fabricPath) {
      canvas.remove(drawingData.fabricPath);
      batchedRender();
    }
    activeDrawingsRef.current.delete(drawingId);
  }, [canvasRef]);

  const handleShapeDrawingStart = useCallback((data) => {
    const { shapeId, userId, shapeType, data: shapeData } = data;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const batchedRender = createBatchedRender(canvas);

    if (socket && userId === socket.id) return;

    let shape = null;

    if (shapeType === 'line') {
      shape = new fabric.Line(
        [shapeData.x1, shapeData.y1, shapeData.x2, shapeData.y2],
        {
          stroke: shapeData.stroke,
          strokeWidth: shapeData.strokeWidth,
          selectable: false,
          evented: false,
          objectCaching: false,
        }
      );
    } else if (shapeType === 'arrow') {
      shape = new fabric.Arrow(
        [shapeData.x1, shapeData.y1, shapeData.x2, shapeData.y2],
        {
          stroke: shapeData.stroke,
          strokeWidth: shapeData.strokeWidth,
          selectable: false,
          evented: false,
          objectCaching: false,
        }
      );
    } else {
      shape = createShapeFromData(shapeType, shapeData);
      if (shape) {
        shape.set({
          selectable: false,
          evented: false,
          objectCaching: false,
        });
      }
    }

    if (shape) {
      shape._isRemoteShape = true;
      shape._shapeId = shapeId;
      activeDrawingsRef.current.set(shapeId, { fabricShape: shape, shapeType });
      canvas.add(shape);
      batchedRender();
    }
  }, [canvasRef, socket]);

  const handleShapeDrawingUpdate = useCallback((data) => {
    const { shapeId, data: shapeData } = data;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const batchedRender = createBatchedRender(canvas);

    const shapeInfo = activeDrawingsRef.current.get(shapeId);
    if (!shapeInfo || !shapeInfo.fabricShape) return;

    const { fabricShape, shapeType } = shapeInfo;

    if (shapeType === 'line' || shapeType === 'arrow') {
      // Reuse existing line or arrow object
      fabricShape.set({
        x1: shapeData.x1,
        y1: shapeData.y1,
        x2: shapeData.x2,
        y2: shapeData.y2,
        stroke: shapeData.stroke,
        strokeWidth: shapeData.strokeWidth,
      });
      fabricShape.setCoords();
    } else if (shapeData.points) {
      // Reuse existing polygon object
      fabricShape.set({
        points: shapeData.points,
        left: shapeData.left,
        top: shapeData.top,
        width: shapeData.width,
        height: shapeData.height,
        scaleX: shapeData.scaleX || 1,
        scaleY: shapeData.scaleY || 1,
        fill: shapeData.fill,
        stroke: shapeData.stroke,
        strokeWidth: shapeData.strokeWidth,
      });
      fabricShape._setPositionDimensions({});
      fabricShape.setCoords();
    } else {
      fabricShape.set(shapeData);
      fabricShape.setCoords();
    }

    batchedRender();
  }, [canvasRef]);

  const handleShapeDrawingEnd = useCallback((data) => {
    const { shapeId } = data;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const batchedRender = createBatchedRender(canvas);

    const shapeInfo = activeDrawingsRef.current.get(shapeId);
    if (!shapeInfo) return;

    if (shapeInfo.fabricShape) {
      canvas.remove(shapeInfo.fabricShape);
      batchedRender();
    }
    activeDrawingsRef.current.delete(shapeId);
  }, [canvasRef]);

  useEffect(() => {
    if (!socket) return;

    socket.on(SOCKET_EVENTS.DRAWING_START, handleDrawingStart);
    socket.on(SOCKET_EVENTS.DRAWING_STREAM, handleDrawingStream);
    socket.on(SOCKET_EVENTS.DRAWING_END, handleDrawingEnd);
    socket.on(SOCKET_EVENTS.SHAPE_DRAWING_START, handleShapeDrawingStart);
    socket.on(SOCKET_EVENTS.SHAPE_DRAWING_UPDATE, handleShapeDrawingUpdate);
    socket.on(SOCKET_EVENTS.SHAPE_DRAWING_END, handleShapeDrawingEnd);

    return () => {
      socket.off(SOCKET_EVENTS.DRAWING_START, handleDrawingStart);
      socket.off(SOCKET_EVENTS.DRAWING_STREAM, handleDrawingStream);
      socket.off(SOCKET_EVENTS.DRAWING_END, handleDrawingEnd);
      socket.off(SOCKET_EVENTS.SHAPE_DRAWING_START, handleShapeDrawingStart);
      socket.off(SOCKET_EVENTS.SHAPE_DRAWING_UPDATE, handleShapeDrawingUpdate);
      socket.off(SOCKET_EVENTS.SHAPE_DRAWING_END, handleShapeDrawingEnd);

      const canvas = canvasRef.current;
      if (canvas) {
        const batchedRender = createBatchedRender(canvas);
        activeDrawingsRef.current.forEach((drawingData) => {
          if (drawingData.fabricPath) {
            canvas.remove(drawingData.fabricPath);
          }
          if (drawingData.fabricShape) {
            canvas.remove(drawingData.fabricShape);
          }
        });
        batchedRender();
      }
      activeDrawingsRef.current.clear();
    };
  }, [socket, canvasRef, handleDrawingStart, handleDrawingStream, handleDrawingEnd, handleShapeDrawingStart, handleShapeDrawingUpdate, handleShapeDrawingEnd]);
}
