import { useRef, useCallback } from 'react';
import { fabric } from 'fabric';
import { v4 as uuidv4 } from 'uuid';
import { COLORS, FABRIC_OBJECT_PROPS, SOCKET_EVENTS, TIMING, FABRIC_EVENTS } from '../constants';
import { getWorkspaceId } from '../utils';

export function useWhiteboardCanvas() {
  const canvasRef = useRef(null);
  const isUpdatingRef = useRef(false);
  const lastEmitTimeRef = useRef(0);
  const socketRef = useRef(null);
  const canWriteRef = useRef(null);
  const elementsMapRef = useRef(new Map());

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
      preserveObjectStacking: true
    });

    const brush = new fabric.PencilBrush(canvas);
    brush.color = '#000000';
    brush.width = 2;
    brush.strokeLineCap = 'round';
    brush.strokeLineJoin = 'round';
    canvas.freeDrawingBrush = brush;

    canvasRef.current = canvas;

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

    const handleResize = () => {
      canvas.setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
      canvas.requestRenderAll();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      canvas.off(FABRIC_EVENTS.PATH_CREATED, handlePathCreated);
      canvas.off(FABRIC_EVENTS.OBJECT_MODIFIED, handleObjectModified);
      canvas.off(FABRIC_EVENTS.OBJECT_MOVING, handleObjectMoving);
      canvas.off(FABRIC_EVENTS.TEXT_CHANGED, handleObjectModified);
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

    const objects = canvas.getObjects();
    let objectsBounds = null;

    if (objects.length > 0) {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      objects.forEach(obj => {
        const coords = obj.getBoundingRect(true);
        if (coords.left < minX) minX = coords.left;
        if (coords.top < minY) minY = coords.top;
        if (coords.left + coords.width > maxX) maxX = coords.left + coords.width;
        if (coords.top + coords.height > maxY) maxY = coords.top + coords.height;
      });

      const padding = 50;
      objectsBounds = {
        left: (minX - padding) * 2,
        top: (minY - padding) * 2,
        width: (maxX - minX + padding * 2) * 2,
        height: (maxY - minY + padding * 2) * 2
      };
    }

    const dataUrl = canvas.toDataURL({
      format: 'png',
      quality: 1,
      multiplier: 2
    });

    return {
      dataUrl,
      width: canvas.getWidth() * 2,
      height: canvas.getHeight() * 2,
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

  const setRefs = useCallback((socket, canWrite) => {
    socketRef.current = socket;
    canWriteRef.current = canWrite;
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
