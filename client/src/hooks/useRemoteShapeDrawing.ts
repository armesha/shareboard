import { useCallback, type MutableRefObject } from 'react';
import { Line, Rect, Circle, Ellipse, type Canvas, type FabricObject } from 'fabric';
import type { Socket } from 'socket.io-client';
import { TIMING } from '../constants';
import { createShapeFromData } from '../factories/shapeFactory';
import { Arrow } from '../utils/fabricArrow';
import type { DrawingData } from './remoteDrawingTypes';

interface Point {
  x: number;
  y: number;
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

const updatePolygonDimensions = (shape: FabricObject): void => {
  const polygonShape = shape as unknown as { setBoundingBox?: (exact?: boolean) => void };
  if (polygonShape.setBoundingBox) {
    polygonShape.setBoundingBox(true);
  }
  shape.setCoords();
};

interface UseRemoteShapeDrawingProps {
  canvasRef: MutableRefObject<Canvas | null>;
  socket: Socket | null;
  activeDrawingsRef: MutableRefObject<Map<string, DrawingData>>;
  cleanupTimeoutsRef: MutableRefObject<Set<ReturnType<typeof setTimeout>>>;
  getBatchedRender: () => () => void;
}

export function useRemoteShapeDrawing({
  canvasRef,
  socket,
  activeDrawingsRef,
  cleanupTimeoutsRef,
  getBatchedRender
}: UseRemoteShapeDrawingProps) {
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
  }, [canvasRef, socket, activeDrawingsRef, getBatchedRender]);

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
  }, [canvasRef, activeDrawingsRef, getBatchedRender]);

  const handleShapeDrawingEnd = useCallback((data: ShapeDrawingEndEvent) => {
    const { shapeId } = data;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const batchedRender = getBatchedRender();

    const shapeInfo = activeDrawingsRef.current.get(shapeId);
    if (!shapeInfo) return;

    const timeoutId = setTimeout(() => {
      cleanupTimeoutsRef.current.delete(timeoutId);
      if (shapeInfo.fabricShape && canvasRef.current) {
        const stillExists = canvasRef.current.getObjects().includes(shapeInfo.fabricShape);
        if (stillExists) {
          canvasRef.current.remove(shapeInfo.fabricShape);
          batchedRender();
        }
      }
      activeDrawingsRef.current.delete(shapeId);
    }, TIMING.REMOTE_DRAWING_CLEANUP_DELAY);
    cleanupTimeoutsRef.current.add(timeoutId);
  }, [canvasRef, activeDrawingsRef, cleanupTimeoutsRef, getBatchedRender]);

  return {
    handleShapeDrawingStart,
    handleShapeDrawingUpdate,
    handleShapeDrawingEnd
  };
}
