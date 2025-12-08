import { useRef, useCallback, type MutableRefObject } from 'react';
import { Canvas, PencilBrush, type TPointerEvent, type TPointerEventInfo } from 'fabric';
import { v4 as uuidv4 } from 'uuid';
import { COLORS, FABRIC_OBJECT_PROPS, SOCKET_EVENTS, TIMING, FABRIC_EVENTS, CANVAS, DEFAULT_COLORS } from '../constants';
import { getWorkspaceId } from '../utils';
import { createBatchedRender, cancelBatchedRender } from '../utils/batchedRender';
import type { Socket } from 'socket.io-client';

interface Point {
  x: number;
  y: number;
}

interface Element {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

interface PathCreatedEvent {
  path: {
    id?: string;
    toObject: (props: string[]) => Record<string, unknown>;
  };
}

interface ObjectModifiedEvent {
  target: {
    id?: string;
    type: string;
    toObject: (props: string[]) => Record<string, unknown>;
  } | null;
}

interface InitCanvasCallbacks {
  onPathCreated?: (element: Element) => void;
  onObjectModified?: (id: string, element: Element, isMoving: boolean) => void;
  onObjectMoving?: (id: string, element: Element, isMoving: boolean) => void;
}

interface CanvasImageData {
  dataUrl: string;
  width: number;
  height: number;
  objectsBounds: {
    left: number;
    top: number;
    width: number;
    height: number;
  } | null;
}

interface UseWhiteboardCanvasReturn {
  canvasRef: MutableRefObject<Canvas | null>;
  isUpdatingRef: MutableRefObject<boolean>;
  elementsMapRef: MutableRefObject<Map<string, Element>>;
  batchedRenderRef: MutableRefObject<(() => void) | null>;
  initCanvas: (canvasElement: HTMLCanvasElement, callbacks: InitCanvasCallbacks) => () => void;
  disposeCanvas: () => void;
  getFullCanvasImage: () => CanvasImageData | null;
  setCanvasDrawingMode: (isDrawing: boolean, color: string, width: number) => void;
  setRefs: (socket: Socket | null, canWrite: (() => boolean) | null, userId: string | null) => void;
  emitThrottled: (workspaceId: string, elements: Element[]) => boolean;
}

export function useWhiteboardCanvas(): UseWhiteboardCanvasReturn {
  const canvasRef = useRef<Canvas | null>(null);
  const isUpdatingRef = useRef(false);
  const lastEmitTimeRef = useRef(0);
  const socketRef = useRef<Socket | null>(null);
  const canWriteRef = useRef<(() => boolean) | null>(null);
  const elementsMapRef = useRef<Map<string, Element>>(new Map());
  const userIdRef = useRef<string | null>(null);
  const batchedRenderRef = useRef<(() => void) | null>(null);

  const drawingIdRef = useRef<string | null>(null);
  const lastSentPointIndexRef = useRef(0);
  const drawingStreamThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCurrentlyDrawingRef = useRef(false);

  const initCanvas = useCallback((canvasElement: HTMLCanvasElement, { onPathCreated, onObjectModified, onObjectMoving }: InitCanvasCallbacks) => {
    const canvas = new Canvas(canvasElement, {
      backgroundColor: COLORS.BG_WHITEBOARD,
      width: window.innerWidth,
      height: window.innerHeight,
      renderOnAddRemove: false,
      isDrawingMode: false,
      fireRightClick: true,
      fireMiddleClick: true,
      stopContextMenu: true,
      skipOffscreen: true,
      preserveObjectStacking: true,
    });

    const brush = new PencilBrush(canvas);
    brush.color = DEFAULT_COLORS.BLACK;
    brush.width = CANVAS.DEFAULT_BRUSH_WIDTH;
    brush.strokeLineCap = 'round';
    brush.strokeLineJoin = 'round';
    canvas.freeDrawingBrush = brush;

    canvasRef.current = canvas;

    batchedRenderRef.current = createBatchedRender(canvas);

    const emitDrawingStream = () => {
      if (!socketRef.current || !drawingIdRef.current || !canWriteRef.current || !canWriteRef.current()) {
        return;
      }

      const currentBrush = canvas.freeDrawingBrush as PencilBrush & { _points?: Point[] };
      if (!currentBrush || !currentBrush._points || currentBrush._points.length === 0) {
        return;
      }

      const allPoints = currentBrush._points;
      const lastIndex = lastSentPointIndexRef.current;

      if (allPoints.length <= lastIndex) {
        return;
      }

      const newPoints = allPoints.slice(lastIndex).map((point: Point) => ({
        x: point.x,
        y: point.y
      }));

      if (newPoints.length === 0) {
        return;
      }

      const workspaceId = getWorkspaceId();
      if (workspaceId) {
        socketRef.current.emit(SOCKET_EVENTS.DRAWING_STREAM, {
          workspaceId,
          drawingId: drawingIdRef.current,
          points: newPoints
        });
      }

      lastSentPointIndexRef.current = allPoints.length;
    };

    const throttledEmitDrawingStream = () => {
      if (drawingStreamThrottleRef.current) {
        return;
      }

      emitDrawingStream();

      drawingStreamThrottleRef.current = setTimeout(() => {
        drawingStreamThrottleRef.current = null;
        if (isCurrentlyDrawingRef.current) {
          emitDrawingStream();
        }
      }, TIMING.DRAWING_STREAM_THROTTLE);
    };

    const handleDrawingMouseDown = (e: TPointerEventInfo<TPointerEvent>) => {
      if (!canvas.isDrawingMode || !canWriteRef.current || !canWriteRef.current()) {
        return;
      }

      if ((e.e as MouseEvent).button !== 0) {
        return;
      }

      isCurrentlyDrawingRef.current = true;
      drawingIdRef.current = uuidv4();
      lastSentPointIndexRef.current = 0;

      const workspaceId = getWorkspaceId();
      if (workspaceId && socketRef.current) {
        socketRef.current.emit(SOCKET_EVENTS.DRAWING_START, {
          workspaceId,
          drawingId: drawingIdRef.current,
          userId: userIdRef.current,
          color: canvas.freeDrawingBrush?.color,
          brushWidth: canvas.freeDrawingBrush?.width
        });
      }
    };

    const handleDrawingMouseMove = () => {
      if (!isCurrentlyDrawingRef.current || !canvas.isDrawingMode) {
        return;
      }

      throttledEmitDrawingStream();
    };

    const handleDrawingMouseUp = () => {
      if (!isCurrentlyDrawingRef.current) {
        return;
      }

      if (drawingStreamThrottleRef.current) {
        clearTimeout(drawingStreamThrottleRef.current);
        drawingStreamThrottleRef.current = null;
      }

      emitDrawingStream();

      const workspaceId = getWorkspaceId();
      if (workspaceId && socketRef.current && drawingIdRef.current) {
        socketRef.current.emit(SOCKET_EVENTS.DRAWING_END, {
          workspaceId,
          drawingId: drawingIdRef.current
        });
      }

      isCurrentlyDrawingRef.current = false;
      drawingIdRef.current = null;
      lastSentPointIndexRef.current = 0;
    };

    const handlePathCreated = (e: PathCreatedEvent) => {
      if (!canWriteRef.current || !canWriteRef.current()) {
        return;
      }

      const path = e.path;
      if (!path.id) {
        path.id = uuidv4();
      }

      const data = path.toObject([...FABRIC_OBJECT_PROPS]);
      data.strokeLineCap = 'round';
      data.strokeLineJoin = 'round';
      data.fill = null;

      const element: Element = {
        id: path.id,
        type: 'path',
        data: data
      };

      elementsMapRef.current.set(path.id, element);

      const workspaceId = getWorkspaceId();
      if (workspaceId && socketRef.current && !isUpdatingRef.current) {
        socketRef.current.emit(SOCKET_EVENTS.WHITEBOARD_UPDATE, {
          workspaceId,
          elements: [element]
        });
      }

      if (onPathCreated) {
        onPathCreated(element);
      }
    };

    const getElementType = (obj: { type: string; data?: { isDiagram?: boolean } }): string => {
      if (obj.type === 'image' || obj.data?.isDiagram) {
        return 'diagram';
      }
      if (obj.type === 'i-text') {
        return 'text';
      }
      return obj.type;
    };

    const handleObjectModified = (e: ObjectModifiedEvent) => {
      const obj = e.target;
      if (!obj || !obj.id || isUpdatingRef.current) return;

      const data = obj.toObject([...FABRIC_OBJECT_PROPS]);
      const element: Element = {
        id: obj.id,
        type: getElementType(obj),
        data: data
      };

      if (onObjectModified) {
        onObjectModified(obj.id, element, false);
      }
    };

    const handleObjectMoving = (e: ObjectModifiedEvent) => {
      const obj = e.target;
      if (!obj || !obj.id || isUpdatingRef.current) return;

      const data = obj.toObject([...FABRIC_OBJECT_PROPS]);
      const element: Element = {
        id: obj.id,
        type: getElementType(obj),
        data: data
      };

      if (onObjectMoving) {
        onObjectMoving(obj.id, element, true);
      }
    };

    canvas.on(FABRIC_EVENTS.PATH_CREATED, handlePathCreated as unknown as (e: unknown) => void);
    canvas.on(FABRIC_EVENTS.OBJECT_MODIFIED, handleObjectModified as unknown as (e: unknown) => void);
    canvas.on(FABRIC_EVENTS.OBJECT_MOVING, handleObjectMoving as unknown as (e: unknown) => void);
    canvas.on(FABRIC_EVENTS.TEXT_CHANGED, handleObjectModified as unknown as (e: unknown) => void);
    canvas.on(FABRIC_EVENTS.MOUSE_DOWN, handleDrawingMouseDown);
    canvas.on(FABRIC_EVENTS.MOUSE_MOVE, handleDrawingMouseMove);
    canvas.on(FABRIC_EVENTS.MOUSE_UP, handleDrawingMouseUp);

    const handleResize = () => {
      canvas.setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
      if (batchedRenderRef.current) {
        batchedRenderRef.current();
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      if (drawingStreamThrottleRef.current) {
        clearTimeout(drawingStreamThrottleRef.current);
        drawingStreamThrottleRef.current = null;
      }
      window.removeEventListener('resize', handleResize);
      canvas.off(FABRIC_EVENTS.PATH_CREATED, handlePathCreated as unknown as (e: unknown) => void);
      canvas.off(FABRIC_EVENTS.OBJECT_MODIFIED, handleObjectModified as unknown as (e: unknown) => void);
      canvas.off(FABRIC_EVENTS.OBJECT_MOVING, handleObjectMoving as unknown as (e: unknown) => void);
      canvas.off(FABRIC_EVENTS.TEXT_CHANGED, handleObjectModified as unknown as (e: unknown) => void);
      canvas.off(FABRIC_EVENTS.MOUSE_DOWN, handleDrawingMouseDown);
      canvas.off(FABRIC_EVENTS.MOUSE_MOVE, handleDrawingMouseMove);
      canvas.off(FABRIC_EVENTS.MOUSE_UP, handleDrawingMouseUp);
      cancelBatchedRender(canvas);
      canvas.dispose();
    };
  }, []);

  const disposeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.dispose();
      canvasRef.current = null;
    }
  }, []);

  const getFullCanvasImage = useCallback((): CanvasImageData | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const multiplier = CANVAS.EXPORT_MULTIPLIER;
    const vpt = canvas.viewportTransform;
    if (!vpt) return null;

    const canvasWidth = canvas.getWidth();
    const canvasHeight = canvas.getHeight();

    const viewportLeft = -vpt[4]! / vpt[0]!;
    const viewportTop = -vpt[5]! / vpt[3]!;
    const viewportWidth = canvasWidth / vpt[0]!;
    const viewportHeight = canvasHeight / vpt[3]!;

    const dataUrl = canvas.toDataURL({
      format: 'png',
      quality: 1,
      multiplier,
      left: viewportLeft,
      top: viewportTop,
      width: viewportWidth,
      height: viewportHeight
    });

    const objects = canvas.getObjects();
    let objectsBounds: CanvasImageData['objectsBounds'] = null;

    if (objects.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

      objects.forEach(obj => {
        // Use aCoords (absolute coords in canvas space, without viewport transform)
        // setCoords() ensures aCoords is calculated
        obj.setCoords();
        const aCoords = obj.aCoords;
        if (aCoords) {
          // aCoords has tl, tr, br, bl (corners)
          const corners = [aCoords.tl, aCoords.tr, aCoords.br, aCoords.bl];
          corners.forEach(corner => {
            if (corner.x < minX) minX = corner.x;
            if (corner.y < minY) minY = corner.y;
            if (corner.x > maxX) maxX = corner.x;
            if (corner.y > maxY) maxY = corner.y;
          });
        }
      });

      if (minX !== Infinity) {
        const padding = CANVAS.EXPORT_PADDING;
        // Convert from canvas coords to image coords (relative to viewport)
        const boundsLeft = Math.max(0, (minX - viewportLeft - padding)) * multiplier;
        const boundsTop = Math.max(0, (minY - viewportTop - padding)) * multiplier;
        const boundsRight = Math.min(viewportWidth, maxX - viewportLeft + padding) * multiplier;
        const boundsBottom = Math.min(viewportHeight, maxY - viewportTop + padding) * multiplier;

        objectsBounds = {
          left: boundsLeft,
          top: boundsTop,
          width: Math.max(0, boundsRight - boundsLeft),
          height: Math.max(0, boundsBottom - boundsTop)
        };
      }
    }

    return {
      dataUrl,
      width: viewportWidth * multiplier,
      height: viewportHeight * multiplier,
      objectsBounds
    };
  }, []);

  const setCanvasDrawingMode = useCallback((isDrawing: boolean, color: string, width: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.isDrawingMode = isDrawing;

    if (isDrawing && canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.color = color;
      canvas.freeDrawingBrush.width = width;
      (canvas.freeDrawingBrush as PencilBrush).strokeLineCap = 'round';
      (canvas.freeDrawingBrush as PencilBrush).strokeLineJoin = 'round';
    }

    if (batchedRenderRef.current) {
      batchedRenderRef.current();
    }
  }, []);

  const setRefs = useCallback((socket: Socket | null, canWrite: (() => boolean) | null, userId: string | null) => {
    socketRef.current = socket;
    canWriteRef.current = canWrite;
    userIdRef.current = userId;
  }, []);

  const emitThrottled = useCallback((workspaceId: string, elements: Element[]): boolean => {
    if (!socketRef.current || isUpdatingRef.current) return false;

    const now = Date.now();
    if (now - lastEmitTimeRef.current >= TIMING.MOVEMENT_TIMEOUT) {
      lastEmitTimeRef.current = now;
      socketRef.current.emit(SOCKET_EVENTS.WHITEBOARD_UPDATE, {
        workspaceId,
        elements
      });
      return true;
    }
    return false;
  }, []);

  return {
    canvasRef,
    isUpdatingRef,
    elementsMapRef,
    batchedRenderRef,
    initCanvas,
    disposeCanvas,
    getFullCanvasImage,
    setCanvasDrawingMode,
    setRefs,
    emitThrottled
  };
}
