import { useCallback, useRef, useMemo, type MutableRefObject } from 'react';
import { type Canvas, type FabricObject } from 'fabric';
import { v4 as uuidv4 } from 'uuid';
import { SOCKET_EVENTS, TIMING } from '../constants';
import { createShape } from '../factories/shapeFactory';
import { getWorkspaceId } from '../utils';
import { createBatchedRender } from '../utils/batchedRender';
import { calculateShapeUpdate } from '../utils/shapeGeometry';
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

interface ShapeElement {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

interface UseShapeDrawingProps {
  canvas: Canvas | null;
  selectedShape: string | null;
  color: string;
  width: number;
  addElement: (element: ShapeElement) => void;
  disabled: boolean;
  socket: Socket | null;
  canWrite: (() => boolean) | null;
}

interface UseShapeDrawingReturn {
  isDrawing: MutableRefObject<boolean>;
  startShape: (pointer: Point) => void;
  updateShape: (pointer: Point, isCtrlPressed?: boolean) => void;
  finishShape: () => void;
}

type PolygonFabricObject = FabricObject & {
  id: string;
  data?: { shapeType?: string };
  set: (props: Record<string, unknown>) => void;
  setCoords: () => void;
  toObject: (props: string[]) => Record<string, unknown>;
};

export function useShapeDrawing({ canvas, selectedShape, color, width, addElement, disabled, socket, canWrite }: UseShapeDrawingProps): UseShapeDrawingReturn {
  const isDrawing = useRef(false);
  const currentShape = useRef<PolygonFabricObject | null>(null);
  const startPoint = useRef<Point | null>(null);
  const currentShapeIdRef = useRef<string | null>(null);
  const lastEmitTimeRef = useRef(0);

  const batchedRender = useMemo(() => createBatchedRender(canvas), [canvas]);

  const emitToSocket = useCallback((event: string, data: Record<string, unknown>) => {
    if (socket && canWrite && canWrite()) {
      const workspaceId = getWorkspaceId();
      if (workspaceId) {
        socket.emit(event, { workspaceId, ...data });
      }
    }
  }, [socket, canWrite]);

  const startShape = useCallback((pointer: Point) => {
    if (disabled || !canvas || !selectedShape) return;

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

    const shapeObj = createShape(selectedShape, commonProps) as PolygonFabricObject | null;

    if (!shapeObj) {
      currentShapeIdRef.current = null;
      return;
    }

    canvas.add(shapeObj);
    currentShape.current = shapeObj;

    emitToSocket(SOCKET_EVENTS.SHAPE_DRAWING_START, {
      shapeId,
      shapeType: selectedShape,
      data: shapeObj.toObject(['id', 'data'])
    });
  }, [canvas, selectedShape, color, width, disabled, emitToSocket]);

  const updateShape = useCallback((pointer: Point, isCtrlPressed = false) => {
    if (disabled || !isDrawing.current || !startPoint.current || !currentShape.current || !selectedShape) return;

    const shape = currentShape.current;
    const result = calculateShapeUpdate(selectedShape, {
      startX: startPoint.current.x,
      startY: startPoint.current.y,
      deltaWidth: pointer.x - startPoint.current.x,
      deltaHeight: pointer.y - startPoint.current.y,
      isCtrlPressed
    });

    if (!result) return;

    if (result.props) {
      shape.set(result.props);
    }

    if (result.points) {
      shape.set({ points: result.points });
      updatePolygonDimensions(shape);
    }

    shape.setCoords();
    batchedRender();

    if (currentShapeIdRef.current) {
      const now = Date.now();
      if (now - lastEmitTimeRef.current >= TIMING.DRAWING_STREAM_THROTTLE) {
        lastEmitTimeRef.current = now;
        emitToSocket(SOCKET_EVENTS.SHAPE_DRAWING_UPDATE, {
          shapeId: currentShapeIdRef.current,
          data: shape.toObject(['id', 'data'])
        });
      }
    }
  }, [selectedShape, disabled, batchedRender, emitToSocket]);

  const finishShape = useCallback(() => {
    if (disabled || !isDrawing.current || !canvas) return;

    isDrawing.current = false;

    if (currentShape.current) {
      const shape = currentShape.current;
      shape.setCoords();

      const shapeData = shape.data as { shapeType?: string } | undefined;
      const elementType = shapeData?.shapeType ?? (shape as unknown as { type: string }).type;
      const serializedData = shape.toObject(['id', 'data']);

      addElement({
        id: shape.id,
        type: elementType,
        data: {
          ...serializedData,
          shapeType: shapeData?.shapeType
        }
      });

      if (currentShapeIdRef.current) {
        emitToSocket(SOCKET_EVENTS.SHAPE_DRAWING_END, {
          shapeId: currentShapeIdRef.current
        });
      }

      currentShape.current = null;
    }

    currentShapeIdRef.current = null;
    startPoint.current = null;
    batchedRender();
  }, [canvas, addElement, disabled, batchedRender, emitToSocket]);

  return {
    isDrawing,
    startShape,
    updateShape,
    finishShape
  };
}
