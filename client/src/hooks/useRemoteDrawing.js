import { useEffect, useRef, useCallback } from 'react';
import { fabric } from 'fabric';
import { SOCKET_EVENTS } from '../constants';
import { createShapeFromData } from '../factories/shapeFactory';
import '../utils/fabricArrow';

function pointsToSvgPath(points) {
  if (!points || points.length === 0) return 'M 0 0';

  const pathParts = points.map((point, index) => {
    if (index === 0) {
      return `M ${point.x} ${point.y}`;
    }
    return `L ${point.x} ${point.y}`;
  });

  return pathParts.join(' ');
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
      canvas.remove(drawingData.fabricPath);
    }

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

    canvas.requestRenderAll();
  }, [canvasRef]);

  const handleDrawingEnd = useCallback((data) => {
    const { drawingId } = data;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const drawingData = activeDrawingsRef.current.get(drawingId);
    if (!drawingData) return;

    if (drawingData.fabricPath) {
      canvas.remove(drawingData.fabricPath);
      canvas.requestRenderAll();
    }
    activeDrawingsRef.current.delete(drawingId);
  }, [canvasRef]);

  const handleShapeDrawingStart = useCallback((data) => {
    const { shapeId, userId, shapeType, data: shapeData } = data;
    const canvas = canvasRef.current;
    if (!canvas) return;

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
      canvas.requestRenderAll();
    }
  }, [canvasRef, socket]);

  const handleShapeDrawingUpdate = useCallback((data) => {
    const { shapeId, data: shapeData } = data;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const shapeInfo = activeDrawingsRef.current.get(shapeId);
    if (!shapeInfo || !shapeInfo.fabricShape) return;

    const { fabricShape, shapeType } = shapeInfo;

    if (shapeType === 'line' || shapeType === 'arrow') {
      canvas.remove(fabricShape);

      let newShape;
      if (shapeType === 'line') {
        newShape = new fabric.Line(
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
        newShape = new fabric.Arrow(
          [shapeData.x1, shapeData.y1, shapeData.x2, shapeData.y2],
          {
            stroke: shapeData.stroke,
            strokeWidth: shapeData.strokeWidth,
            selectable: false,
            evented: false,
            objectCaching: false,
          }
        );
      }

      newShape._isRemoteShape = true;
      newShape._shapeId = shapeId;
      activeDrawingsRef.current.set(shapeId, { fabricShape: newShape, shapeType });
      canvas.add(newShape);
    } else if (shapeData.points) {
      canvas.remove(fabricShape);

      const newShape = createShapeFromData(shapeType, shapeData);
      if (newShape) {
        newShape.set({
          selectable: false,
          evented: false,
          objectCaching: false,
        });
        newShape._isRemoteShape = true;
        newShape._shapeId = shapeId;
        activeDrawingsRef.current.set(shapeId, { fabricShape: newShape, shapeType });
        canvas.add(newShape);
      }
    } else {
      fabricShape.set(shapeData);
      fabricShape.setCoords();
    }

    canvas.requestRenderAll();
  }, [canvasRef]);

  const handleShapeDrawingEnd = useCallback((data) => {
    const { shapeId } = data;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const shapeInfo = activeDrawingsRef.current.get(shapeId);
    if (!shapeInfo) return;

    if (shapeInfo.fabricShape) {
      canvas.remove(shapeInfo.fabricShape);
      canvas.requestRenderAll();
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
        activeDrawingsRef.current.forEach((drawingData) => {
          if (drawingData.fabricPath) {
            canvas.remove(drawingData.fabricPath);
          }
          if (drawingData.fabricShape) {
            canvas.remove(drawingData.fabricShape);
          }
        });
        canvas.requestRenderAll();
      }
      activeDrawingsRef.current.clear();
    };
  }, [socket, canvasRef, handleDrawingStart, handleDrawingStream, handleDrawingEnd, handleShapeDrawingStart, handleShapeDrawingUpdate, handleShapeDrawingEnd]);
}
