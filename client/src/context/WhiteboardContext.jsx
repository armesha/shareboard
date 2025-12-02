import { createContext, useContext, useEffect, useCallback, useState } from 'react';
import { useSocket } from './SocketContext';
import { useSharing } from './SharingContext';
import { COLORS, ZOOM } from '../constants';
import { useWhiteboardCanvas } from '../hooks/useWhiteboardCanvas';
import { useWhiteboardElements } from '../hooks/useWhiteboardElements';
import { useWhiteboardSync } from '../hooks/useWhiteboardSync';
import { useWhiteboardTools } from '../hooks/useWhiteboardTools';

const WhiteboardContext = createContext(null);

export function useWhiteboard() {
  return useContext(WhiteboardContext);
}

export function WhiteboardProvider({ children }) {
  const socketContext = useSocket();
  const socket = socketContext?.socket;
  const { canWrite } = useSharing() || { canWrite: () => false };

  const {
    canvasRef,
    isUpdatingRef,
    elementsMapRef,
    initCanvas: initCanvasBase,
    disposeCanvas: _disposeCanvas,
    getFullCanvasImage,
    setCanvasDrawingMode,
    setRefs,
    emitThrottled
  } = useWhiteboardCanvas();

  const {
    elements,
    setElements,
    createFabricObject,
    addElement: addElementBase,
    updateElement: updateElementBase,
    deleteElement: _deleteElementBase,
    clearElements: clearElementsBase
  } = useWhiteboardElements();

  const {
    isConnected,
    isLoading,
    connectionStatus,
    activeUsers
  } = useWhiteboardSync(socket, canvasRef, elementsMapRef, isUpdatingRef, createFabricObject, setElements, canWrite);

  const {
    tool,
    selectedShape,
    color,
    width,
    fontSize,
    setTool,
    setSelectedShape,
    setColor: setColorBase,
    setWidth,
    setFontSize
  } = useWhiteboardTools(canvasRef, isLoading, isConnected, canWrite);

  const [zoom, setZoomState] = useState(1);

  const setZoom = useCallback((newZoom) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const clampedZoom = Math.min(Math.max(newZoom, ZOOM.MIN), ZOOM.MAX);
    const center = canvas.getCenter();
    canvas.zoomToPoint({ x: center.left, y: center.top }, clampedZoom);
    canvas.requestRenderAll();
    setZoomState(clampedZoom);
  }, [canvasRef]);

  useEffect(() => {
    setRefs(socket, canWrite);
  }, [socket, canWrite, setRefs]);

  const updateElement = useCallback((id, element, isMoving = false) => {
    updateElementBase(id, element, isMoving, elementsMapRef, socket ? { current: socket } : { current: null }, isUpdatingRef, emitThrottled);
  }, [updateElementBase, elementsMapRef, socket, isUpdatingRef, emitThrottled]);

  const initCanvas = useCallback((canvasElement) => {
    return initCanvasBase(canvasElement, {
      onPathCreated: (_element) => {
        const updatedElements = Array.from(elementsMapRef.current.values());
        setElements(updatedElements);
      },
      onObjectModified: updateElement,
      onObjectMoving: updateElement
    });
  }, [initCanvasBase, elementsMapRef, setElements, updateElement]);

  const addElement = useCallback((element) => {
    addElementBase(element, canvasRef, elementsMapRef, socket ? { current: socket } : { current: null }, isUpdatingRef);
  }, [addElementBase, canvasRef, elementsMapRef, socket, isUpdatingRef]);

  const clearCanvas = useCallback(() => {
    clearElementsBase(canvasRef, elementsMapRef, socket ? { current: socket } : { current: null });
  }, [clearElementsBase, canvasRef, elementsMapRef, socket]);

  const setColor = useCallback((newColor) => {
    setColorBase(newColor, setCanvasDrawingMode);
  }, [setColorBase, setCanvasDrawingMode]);

  const value = {
    tool,
    color,
    width,
    fontSize,
    zoom,
    WHITEBOARD_BG_COLOR: COLORS.BG_WHITEBOARD,
    selectedShape,
    activeUsers,
    elements,
    canvasRef,
    isConnected,
    isLoading,
    connectionStatus,
    initCanvas,
    clearCanvas,
    addElement,
    updateElement,
    setTool,
    setSelectedShape,
    setColor,
    setWidth,
    setFontSize,
    setZoom,
    setZoomState,
    getFullCanvasImage
  };

  return (
    <WhiteboardContext.Provider value={value}>
      {children}
    </WhiteboardContext.Provider>
  );
}
