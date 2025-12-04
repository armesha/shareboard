import { useRef, useCallback } from 'react';
import { fabric } from 'fabric';
import { v4 as uuidv4 } from 'uuid';
import { COLORS, FABRIC_OBJECT_PROPS, SOCKET_EVENTS, TIMING, FABRIC_EVENTS, CANVAS, DEFAULT_COLORS } from '../constants';
import { getWorkspaceId } from '../utils';

export function useWhiteboardCanvas() {
  const canvasRef = useRef(null);
  const isUpdatingRef = useRef(false);
  const lastEmitTimeRef = useRef(0);
  const socketRef = useRef(null);
  const canWriteRef = useRef(null);
  const elementsMapRef = useRef(new Map());
  const userIdRef = useRef(null);

  const drawingIdRef = useRef(null);
  const lastSentPointIndexRef = useRef(0);
  const drawingStreamThrottleRef = useRef(null);
  const isCurrentlyDrawingRef = useRef(false);

  const initCanvas = useCallback((canvasElement, { onPathCreated, onObjectModified, onObjectMoving }) => {
    const canvas = new fabric.Canvas(canvasElement, {
      backgroundColor: COLORS.BG_WHITEBOARD,
      width: window.innerWidth,
      height: window.innerHeight,
      renderOnAddRemove: false,
      isDrawingMode: false,
      fireRightClick: true,
      fireMiddleClick: true,
      stopContextMenu: true,
      objectCaching: true,
      skipOffscreen: true,
      preserveObjectStacking: true,
      willReadFrequently: true
    });

    const brush = new fabric.PencilBrush(canvas);
    brush.color = DEFAULT_COLORS.BLACK;
    brush.width = CANVAS.DEFAULT_BRUSH_WIDTH;
    brush.strokeLineCap = 'round';
    brush.strokeLineJoin = 'round';
    canvas.freeDrawingBrush = brush;

    canvasRef.current = canvas;

    const emitDrawingStream = () => {
      if (!socketRef.current || !drawingIdRef.current || !canWriteRef.current || !canWriteRef.current()) {
        return;
      }

      const brush = canvas.freeDrawingBrush;
      if (!brush || !brush._points || brush._points.length === 0) {
        return;
      }

      const allPoints = brush._points;
      const lastIndex = lastSentPointIndexRef.current;

      if (allPoints.length <= lastIndex) {
        return;
      }

      const newPoints = allPoints.slice(lastIndex).map(point => ({
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

    const handleDrawingMouseDown = (e) => {
      if (!canvas.isDrawingMode || !canWriteRef.current || !canWriteRef.current()) {
        return;
      }

      if (e.e.button !== 0) {
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
          color: canvas.freeDrawingBrush.color,
          brushWidth: canvas.freeDrawingBrush.width
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

    const handlePathCreated = (e) => {
      if (!canWriteRef.current || !canWriteRef.current()) {
        return;
      }

      const path = e.path;
      if (!path.id) {
        path.id = uuidv4();
      }

      const data = path.toObject(FABRIC_OBJECT_PROPS);
      data.strokeLineCap = 'round';
      data.strokeLineJoin = 'round';
      data.fill = null;

      const element = {
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

    const handleObjectModified = (e) => {
      const obj = e.target;
      if (!obj || !obj.id || isUpdatingRef.current) return;

      const data = obj.toObject(FABRIC_OBJECT_PROPS);
      const element = {
        id: obj.id,
        type: obj.type,
        data: data
      };

      if (onObjectModified) {
        onObjectModified(obj.id, element, false);
      }
    };

    const handleObjectMoving = (e) => {
      const obj = e.target;
      if (!obj || !obj.id || isUpdatingRef.current) return;

      const data = obj.toObject(FABRIC_OBJECT_PROPS);
      const element = {
        id: obj.id,
        type: obj.type,
        data: data
      };

      if (onObjectMoving) {
        onObjectMoving(obj.id, element, true);
      }
    };

    canvas.on(FABRIC_EVENTS.PATH_CREATED, handlePathCreated);
    canvas.on(FABRIC_EVENTS.OBJECT_MODIFIED, handleObjectModified);
    canvas.on(FABRIC_EVENTS.OBJECT_MOVING, handleObjectMoving);
    canvas.on(FABRIC_EVENTS.TEXT_CHANGED, handleObjectModified);
    canvas.on(FABRIC_EVENTS.MOUSE_DOWN, handleDrawingMouseDown);
    canvas.on(FABRIC_EVENTS.MOUSE_MOVE, handleDrawingMouseMove);
    canvas.on(FABRIC_EVENTS.MOUSE_UP, handleDrawingMouseUp);

    const handleResize = () => {
      canvas.setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
      canvas.requestRenderAll();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      if (drawingStreamThrottleRef.current) {
        clearTimeout(drawingStreamThrottleRef.current);
        drawingStreamThrottleRef.current = null;
      }
      window.removeEventListener('resize', handleResize);
      canvas.off(FABRIC_EVENTS.PATH_CREATED, handlePathCreated);
      canvas.off(FABRIC_EVENTS.OBJECT_MODIFIED, handleObjectModified);
      canvas.off(FABRIC_EVENTS.OBJECT_MOVING, handleObjectMoving);
      canvas.off(FABRIC_EVENTS.TEXT_CHANGED, handleObjectModified);
      canvas.off(FABRIC_EVENTS.MOUSE_DOWN, handleDrawingMouseDown);
      canvas.off(FABRIC_EVENTS.MOUSE_MOVE, handleDrawingMouseMove);
      canvas.off(FABRIC_EVENTS.MOUSE_UP, handleDrawingMouseUp);
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

  const getFullCanvasImage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const multiplier = CANVAS.EXPORT_MULTIPLIER;
    const vpt = canvas.viewportTransform;
    const zoom = canvas.getZoom();
    const canvasWidth = canvas.getWidth();
    const canvasHeight = canvas.getHeight();

    const viewportLeft = -vpt[4] / zoom;
    const viewportTop = -vpt[5] / zoom;
    const viewportWidth = canvasWidth / zoom;
    const viewportHeight = canvasHeight / zoom;

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
    let objectsBounds = null;

    if (objects.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

      objects.forEach(obj => {
        const coords = obj.getBoundingRect(true);
        if (coords.left < minX) minX = coords.left;
        if (coords.top < minY) minY = coords.top;
        if (coords.left + coords.width > maxX) maxX = coords.left + coords.width;
        if (coords.top + coords.height > maxY) maxY = coords.top + coords.height;
      });

      const padding = CANVAS.EXPORT_PADDING;
      objectsBounds = {
        left: (minX - viewportLeft - padding) * multiplier,
        top: (minY - viewportTop - padding) * multiplier,
        width: (maxX - minX + padding * 2) * multiplier,
        height: (maxY - minY + padding * 2) * multiplier
      };
    }

    return {
      dataUrl,
      width: viewportWidth * multiplier,
      height: viewportHeight * multiplier,
      objectsBounds
    };
  }, []);

  const setCanvasDrawingMode = useCallback((isDrawing, color, width) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.isDrawingMode = isDrawing;

    if (isDrawing && canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.color = color;
      canvas.freeDrawingBrush.width = width;
      canvas.freeDrawingBrush.strokeLineCap = 'round';
      canvas.freeDrawingBrush.strokeLineJoin = 'round';
    }

    canvas.requestRenderAll();
  }, []);

  const setRefs = useCallback((socket, canWrite, userId) => {
    socketRef.current = socket;
    canWriteRef.current = canWrite;
    userIdRef.current = userId;
  }, []);

  const emitThrottled = useCallback((workspaceId, elements) => {
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
    initCanvas,
    disposeCanvas,
    getFullCanvasImage,
    setCanvasDrawingMode,
    setRefs,
    emitThrottled
  };
}
