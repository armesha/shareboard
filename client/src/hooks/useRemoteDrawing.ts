import { useEffect, useRef, useCallback, type MutableRefObject } from 'react';
import { Line, Path, Rect, Circle, Ellipse, util, type Canvas, type FabricObject } from 'fabric';
import { PerfectCursor } from 'perfect-cursors';
import { SOCKET_EVENTS } from '../constants';
import { createShapeFromData } from '../factories/shapeFactory';
import { createBatchedRender } from '../utils/batchedRender';
import { Arrow } from '../utils/fabricArrow';
import type { Socket } from 'socket.io-client';

interface Point {
  x: number;
  y: number;
}

const updatePolygonDimensions = (shape: FabricObject): void => {
  const polygonShape = shape as unknown as { setBoundingBox?: (exact?: boolean) => void };
  if (polygonShape.setBoundingBox) {
    polygonShape.setBoundingBox(true);
  }
  shape.setCoords();
};

interface DrawingData {
  fabricPath: (Path & { _isRemoteDrawing?: boolean; _drawingId?: string }) | null;
  fabricShape?: (FabricObject & { _isRemoteShape?: boolean; _shapeId?: string }) | null;
  points: Point[];
  color: string;
  brushWidth: number;
  userId?: string;
  shapeType?: string;
  interpolator?: PerfectCursor;
}

interface DrawingStartEvent {
  drawingId: string;
  userId: string;
  color: string;
  brushWidth: number;
}

interface DrawingStreamEvent {
  drawingId: string;
  points: Point[];
}

interface DrawingEndEvent {
  drawingId: string;
}

interface ShapeDrawingStartEvent {
  shapeId: string;
  userId: string;
  shapeType: string;
  data: {
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
    left?: number;
    top?: number;
    width?: number;
    height?: number;
    radius?: number;
    rx?: number;
    ry?: number;
    stroke?: string;
    strokeWidth?: number;
    headLength?: number;
    headAngle?: number;
    [key: string]: unknown;
  };
}

interface ShapeDrawingUpdateEvent {
  shapeId: string;
  data: {
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
    stroke?: string;
    strokeWidth?: number;
    points?: Point[];
    left?: number;
    top?: number;
    width?: number;
    height?: number;
    radius?: number;
    rx?: number;
    ry?: number;
    scaleX?: number;
    scaleY?: number;
    fill?: string;
    headLength?: number;
    headAngle?: number;
    [key: string]: unknown;
  };
}

interface ShapeDrawingEndEvent {
  shapeId: string;
}

function pointsToSvgPath(points: Point[]): string {
  if (!points || points.length === 0) return '';
  if (points.length === 1) {
    return `M ${points[0]!.x} ${points[0]!.y}`;
  }
  if (points.length === 2) {
    return `M ${points[0]!.x} ${points[0]!.y} L ${points[1]!.x} ${points[1]!.y}`;
  }

  let path = `M ${points[0]!.x} ${points[0]!.y}`;

  for (let i = 1; i < points.length - 1; i++) {
    const curr = points[i]!;
    const next = points[i + 1]!;
    const midX = (curr.x + next.x) / 2;
    const midY = (curr.y + next.y) / 2;
    path += ` Q ${curr.x} ${curr.y} ${midX} ${midY}`;
  }

  const last = points[points.length - 1]!;
  path += ` L ${last.x} ${last.y}`;

  return path;
}

export function useRemoteDrawing(socket: Socket | null, canvasRef: MutableRefObject<Canvas | null>): void {
  const activeDrawingsRef = useRef<Map<string, DrawingData>>(new Map());
  const batchedRenderRef = useRef<((() => void) & { _canvas?: Canvas }) | null>(null);

  const getBatchedRender = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return () => {};
    if (!batchedRenderRef.current || batchedRenderRef.current._canvas !== canvas) {
      const render = createBatchedRender(canvas) as (() => void) & { _canvas?: Canvas };
      render._canvas = canvas;
      batchedRenderRef.current = render;
    }
    return batchedRenderRef.current;
  }, [canvasRef]);

  const handleDrawingStart = useCallback((data: DrawingStartEvent) => {
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

  const handleDrawingStream = useCallback((data: DrawingStreamEvent) => {
    const { drawingId, points: newPoints } = data;
    const canvas = canvasRef.current;
    if (!canvas || !newPoints || newPoints.length === 0) return;

    const batchedRender = getBatchedRender();

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
      drawingData.fabricPath.set({
        path: util.parsePath(svgPathString),
        stroke: drawingData.color,
        strokeWidth: drawingData.brushWidth,
      });
      drawingData.fabricPath.setCoords();
    } else {
      const updatedPath = new Path(svgPathString, {
        stroke: drawingData.color,
        strokeWidth: drawingData.brushWidth,
        fill: undefined,
        strokeLineCap: 'round',
        strokeLineJoin: 'round',
        selectable: false,
        evented: false,
        objectCaching: false,
      }) as Path & { _isRemoteDrawing?: boolean; _drawingId?: string };

      updatedPath._isRemoteDrawing = true;
      updatedPath._drawingId = drawingId;

      canvas.add(updatedPath);
      drawingData.fabricPath = updatedPath;
    }

    batchedRender();
  }, [canvasRef, getBatchedRender]);

  const handleDrawingEnd = useCallback((data: DrawingEndEvent) => {
    const { drawingId } = data;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const batchedRender = getBatchedRender();

    const drawingData = activeDrawingsRef.current.get(drawingId);
    if (!drawingData) return;

    // Delay removal to allow WHITEBOARD_UPDATE to arrive with permanent path
    // Server batches updates every 50ms, so 100ms delay ensures smooth transition
    setTimeout(() => {
      if (drawingData.fabricPath && canvasRef.current) {
        canvasRef.current.remove(drawingData.fabricPath);
        batchedRender();
      }
      activeDrawingsRef.current.delete(drawingId);
    }, 100);
  }, [canvasRef, getBatchedRender]);

  const handleShapeDrawingStart = useCallback((data: ShapeDrawingStartEvent) => {
    const { shapeId, userId, shapeType, data: shapeData } = data;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const batchedRender = getBatchedRender();

    if (socket && userId === socket.id) return;

    let shape: (FabricObject & { _isRemoteShape?: boolean; _shapeId?: string }) | null = null;

    if (shapeType === 'line') {
      shape = new Line(
        [shapeData.x1 ?? 0, shapeData.y1 ?? 0, shapeData.x2 ?? 0, shapeData.y2 ?? 0],
        {
          stroke: shapeData.stroke,
          strokeWidth: shapeData.strokeWidth,
          selectable: false,
          evented: false,
          objectCaching: false,
        }
      ) as Line & { _isRemoteShape?: boolean; _shapeId?: string };
    } else if (shapeType === 'arrow') {
      shape = new Arrow(
        [shapeData.x1 ?? 0, shapeData.y1 ?? 0, shapeData.x2 ?? 0, shapeData.y2 ?? 0],
        {
          stroke: shapeData.stroke,
          strokeWidth: shapeData.strokeWidth,
          headLength: shapeData.headLength,
          headAngle: shapeData.headAngle,
          selectable: false,
          evented: false,
          objectCaching: false,
        }
      ) as Arrow & { _isRemoteShape?: boolean; _shapeId?: string };
    } else if (shapeType === 'rect' || shapeType === 'rectangle') {
      shape = new Rect({
        left: shapeData.left ?? shapeData.x1 ?? 0,
        top: shapeData.top ?? shapeData.y1 ?? 0,
        width: shapeData.width ?? 0,
        height: shapeData.height ?? 0,
        stroke: shapeData.stroke,
        strokeWidth: shapeData.strokeWidth,
        fill: 'transparent',
        selectable: false,
        evented: false,
        objectCaching: false,
      }) as Rect & { _isRemoteShape?: boolean; _shapeId?: string };
    } else if (shapeType === 'circle') {
      shape = new Circle({
        left: shapeData.left ?? 0,
        top: shapeData.top ?? 0,
        radius: shapeData.radius ?? 0,
        stroke: shapeData.stroke,
        strokeWidth: shapeData.strokeWidth,
        fill: 'transparent',
        selectable: false,
        evented: false,
        objectCaching: false,
      }) as Circle & { _isRemoteShape?: boolean; _shapeId?: string };
    } else if (shapeType === 'ellipse') {
      shape = new Ellipse({
        left: shapeData.left ?? 0,
        top: shapeData.top ?? 0,
        rx: shapeData.rx ?? 0,
        ry: shapeData.ry ?? 0,
        stroke: shapeData.stroke,
        strokeWidth: shapeData.strokeWidth,
        fill: 'transparent',
        selectable: false,
        evented: false,
        objectCaching: false,
      }) as Ellipse & { _isRemoteShape?: boolean; _shapeId?: string };
    } else {
      shape = createShapeFromData(shapeType, shapeData) as FabricObject & { _isRemoteShape?: boolean; _shapeId?: string } | null;
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
      activeDrawingsRef.current.set(shapeId, { fabricPath: null, fabricShape: shape, shapeType, points: [], color: '', brushWidth: 0 });
      canvas.add(shape);
      batchedRender();
    }
  }, [canvasRef, socket, getBatchedRender]);

  const handleShapeDrawingUpdate = useCallback((data: ShapeDrawingUpdateEvent) => {
    const { shapeId, data: shapeData } = data;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const batchedRender = getBatchedRender();

    const shapeInfo = activeDrawingsRef.current.get(shapeId);
    if (!shapeInfo || !shapeInfo.fabricShape) return;

    const { fabricShape, shapeType } = shapeInfo;

    if (shapeType === 'line') {
      fabricShape.set({
        x1: shapeData.x1,
        y1: shapeData.y1,
        x2: shapeData.x2,
        y2: shapeData.y2,
        stroke: shapeData.stroke,
        strokeWidth: shapeData.strokeWidth,
      });
      fabricShape.setCoords();
    } else if (shapeType === 'arrow') {
      fabricShape.set({
        x1: shapeData.x1,
        y1: shapeData.y1,
        x2: shapeData.x2,
        y2: shapeData.y2,
        stroke: shapeData.stroke,
        strokeWidth: shapeData.strokeWidth,
        headLength: shapeData.headLength,
        headAngle: shapeData.headAngle,
      });
      fabricShape.setCoords();
    } else if (shapeType === 'rect' || shapeType === 'rectangle') {
      fabricShape.set({
        left: shapeData.left,
        top: shapeData.top,
        width: shapeData.width,
        height: shapeData.height,
        stroke: shapeData.stroke,
        strokeWidth: shapeData.strokeWidth,
      });
      fabricShape.setCoords();
    } else if (shapeType === 'circle') {
      fabricShape.set({
        left: shapeData.left,
        top: shapeData.top,
        radius: shapeData.radius,
        stroke: shapeData.stroke,
        strokeWidth: shapeData.strokeWidth,
      });
      fabricShape.setCoords();
    } else if (shapeType === 'ellipse') {
      fabricShape.set({
        left: shapeData.left,
        top: shapeData.top,
        rx: shapeData.rx,
        ry: shapeData.ry,
        stroke: shapeData.stroke,
        strokeWidth: shapeData.strokeWidth,
      });
      fabricShape.setCoords();
    } else if (shapeData.points) {
      fabricShape.set({
        points: shapeData.points,
        left: shapeData.left,
        top: shapeData.top,
        width: shapeData.width,
        height: shapeData.height,
        scaleX: shapeData.scaleX ?? 1,
        scaleY: shapeData.scaleY ?? 1,
        fill: shapeData.fill,
        stroke: shapeData.stroke,
        strokeWidth: shapeData.strokeWidth,
      });
      updatePolygonDimensions(fabricShape);
      fabricShape.setCoords();
    } else {
      fabricShape.set(shapeData);
      fabricShape.setCoords();
    }

    batchedRender();
  }, [canvasRef, getBatchedRender]);

  const handleShapeDrawingEnd = useCallback((data: ShapeDrawingEndEvent) => {
    const { shapeId } = data;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const batchedRender = getBatchedRender();

    const shapeInfo = activeDrawingsRef.current.get(shapeId);
    if (!shapeInfo) return;

    // Delay removal to allow WHITEBOARD_UPDATE to arrive with permanent shape
    // Server batches updates every 50ms, so 100ms delay ensures smooth transition
    // The temp shape will be removed by handleWhiteboardUpdate if it arrives first
    setTimeout(() => {
      if (shapeInfo.fabricShape && canvasRef.current) {
        // Only remove if still exists (might already be removed by handleWhiteboardUpdate)
        const stillExists = canvasRef.current.getObjects().includes(shapeInfo.fabricShape);
        if (stillExists) {
          canvasRef.current.remove(shapeInfo.fabricShape);
          batchedRender();
        }
      }
      activeDrawingsRef.current.delete(shapeId);
    }, 100);
  }, [canvasRef, getBatchedRender]);

  useEffect(() => {
    if (!socket) return;

    const canvasInstance = canvasRef.current;
    const activeDrawings = activeDrawingsRef.current;
    const batchedRender = getBatchedRender();

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

      if (canvasInstance) {
        activeDrawings.forEach((drawingData) => {
          if (drawingData.fabricPath) {
            canvasInstance.remove(drawingData.fabricPath);
          }
          if (drawingData.fabricShape) {
            canvasInstance.remove(drawingData.fabricShape);
          }
        });
        batchedRender();
      }
      activeDrawings.clear();
    };
  }, [socket, canvasRef, handleDrawingStart, handleDrawingStream, handleDrawingEnd, handleShapeDrawingStart, handleShapeDrawingUpdate, handleShapeDrawingEnd, getBatchedRender]);
}
