import { useRef, useCallback, type MutableRefObject } from 'react';
import { Canvas, PencilBrush } from 'fabric';
import { v4 as uuidv4 } from 'uuid';
import { COLORS, FABRIC_OBJECT_PROPS, SOCKET_EVENTS, TIMING, FABRIC_EVENTS, CANVAS, DEFAULT_COLORS } from '../constants';
import { getWorkspaceId } from '../utils';
import { createBatchedRender, cancelBatchedRender } from '../utils/batchedRender';
import { getFullCanvasImage, type CanvasImageData } from '../utils/canvasExport';
import { useDrawingStream } from './useDrawingStream';
import type { Socket } from 'socket.io-client';

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
    data?: { isDiagram?: boolean };
    toObject: (props: string[]) => Record<string, unknown>;
  } | null;
}

interface InitCanvasCallbacks {
  onPathCreated?: (element: Element) => void;
  onObjectModified?: (id: string, element: Element, isMoving: boolean) => void;
  onObjectMoving?: (id: string, element: Element, isMoving: boolean) => void;
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
  const isDisposingRef = useRef(false);
  const lastEmitTimeRef = useRef(0);
  const socketRef = useRef<Socket | null>(null);
  const canWriteRef = useRef<(() => boolean) | null>(null);
  const elementsMapRef = useRef<Map<string, Element>>(new Map());
  const userIdRef = useRef<string | null>(null);
  const batchedRenderRef = useRef<(() => void) | null>(null);

  const { setupDrawingStreamHandlers } = useDrawingStream(socketRef, canWriteRef, userIdRef);

  const getElementType = (obj: { type: string; data?: { isDiagram?: boolean } }): string => {
    if (obj.type === 'image' || obj.data?.isDiagram) {
      return 'diagram';
    }
    if (obj.type === 'i-text') {
      return 'text';
    }
    return obj.type;
  };

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

    const cleanupDrawingStream = setupDrawingStreamHandlers(canvas);

    canvas.on(FABRIC_EVENTS.PATH_CREATED, handlePathCreated as unknown as (e: unknown) => void);
    canvas.on(FABRIC_EVENTS.OBJECT_MODIFIED, handleObjectModified as unknown as (e: unknown) => void);
    canvas.on(FABRIC_EVENTS.OBJECT_MOVING, handleObjectMoving as unknown as (e: unknown) => void);

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
      cleanupDrawingStream();
      window.removeEventListener('resize', handleResize);
      canvas.off(FABRIC_EVENTS.PATH_CREATED, handlePathCreated as unknown as (e: unknown) => void);
      canvas.off(FABRIC_EVENTS.OBJECT_MODIFIED, handleObjectModified as unknown as (e: unknown) => void);
      canvas.off(FABRIC_EVENTS.OBJECT_MOVING, handleObjectMoving as unknown as (e: unknown) => void);
      cancelBatchedRender(canvas);
      canvas.dispose();
    };
  }, [setupDrawingStreamHandlers]);

  const disposeCanvas = useCallback(() => {
    isDisposingRef.current = true;
    const canvas = canvasRef.current;
    if (canvas) {
      cancelBatchedRender(canvas);
      canvas.dispose();
      canvasRef.current = null;
    }
    batchedRenderRef.current = null;
  }, []);

  const getCanvasImage = useCallback((): CanvasImageData | null => {
    return getFullCanvasImage(canvasRef.current);
  }, []);

  const setCanvasDrawingMode = useCallback((isDrawing: boolean, color: string, width: number) => {
    if (isDisposingRef.current) return;
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
    if (!socketRef.current || isUpdatingRef.current || isDisposingRef.current) return false;

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
    getFullCanvasImage: getCanvasImage,
    setCanvasDrawingMode,
    setRefs,
    emitThrottled
  };
}
