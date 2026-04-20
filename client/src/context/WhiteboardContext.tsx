import { createContext, useContext, useEffect, useCallback, useState, useMemo, type ReactNode, type MutableRefObject, type Dispatch, type SetStateAction } from 'react';
import { Canvas, Point } from 'fabric';
import { useSocket } from './SocketContext';
import { useSharing } from './SharingContext';
import { ZOOM, type Tool, type Shape } from '../constants';
import type { CanvasImageData } from '../utils/canvasExport';
import { useWhiteboardCanvas } from '../hooks/useWhiteboardCanvas';
import { useWhiteboardElements } from '../hooks/useWhiteboardElements';
import { useWhiteboardSync } from '../hooks/useWhiteboardSync';
import { useWhiteboardTools } from '../hooks/useWhiteboardTools';
import { useRemoteDrawing } from '../hooks/useRemoteDrawing';

interface Element {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

interface InitCanvasCallbacks {
  onObjectModified?: (id: string, element: Element, isMoving: boolean) => void;
  onObjectMoving?: (id: string, element: Element, isMoving: boolean) => void;
}

interface WhiteboardContextValue {
  tool: Tool;
  color: string;
  width: number;
  fontSize: number;
  zoom: number;
  selectedShape: Shape | null;
  activeUsers: number;
  canvasRef: MutableRefObject<Canvas | null>;
  batchedRenderRef: MutableRefObject<(() => void) | null>;
  isUpdatingRef: MutableRefObject<boolean>;
  isLoading: boolean;
  connectionStatus: string;
  initCanvas: (canvasElement: HTMLCanvasElement) => () => void;
  clearCanvas: () => void;
  addElement: (element: Element) => void;
  updateElement: (id: string, element: Element, isMoving?: boolean) => void;
  setTool: Dispatch<SetStateAction<Tool>>;
  setSelectedShape: (shape: Shape | null) => void;
  setColor: (color: string) => void;
  setWidth: (width: number) => void;
  setFontSize: (fontSize: number) => void;
  setZoom: (zoom: number) => void;
  setZoomState: Dispatch<SetStateAction<number>>;
  getFullCanvasImage: () => CanvasImageData | null;
}

interface WhiteboardProviderProps {
  children: ReactNode;
}

const WhiteboardContext = createContext<WhiteboardContextValue | null>(null);

export function useWhiteboard(): WhiteboardContextValue {
  const context = useContext(WhiteboardContext);
  if (!context) {
    throw new Error('useWhiteboard must be used within a WhiteboardProvider');
  }
  return context;
}

export function WhiteboardProvider({ children }: WhiteboardProviderProps) {
  const socketContext = useSocket();
  const socket = socketContext?.socket ?? null;
  const userId = socketContext?.userId ?? null;
  const sharingContext = useSharing();
  const canWrite = sharingContext?.canWrite ?? (() => false);

  const {
    canvasRef,
    isUpdatingRef,
    elementsMapRef,
    batchedRenderRef,
    initCanvas: initCanvasBase,
    getFullCanvasImage,
    setCanvasDrawingMode,
    setRefs,
    emitThrottled
  } = useWhiteboardCanvas();

  const {
    createFabricObject,
    addElement: addElementBase,
    updateElement: updateElementBase,
    clearElements: clearElementsBase
  } = useWhiteboardElements();

  const {
    isConnected,
    isLoading,
    connectionStatus,
    activeUsers
  } = useWhiteboardSync(socket, canvasRef, elementsMapRef, isUpdatingRef, createFabricObject, canWrite);

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

  useRemoteDrawing(socket, canvasRef);

  const [zoom, setZoomState] = useState(1);

  const setZoom = useCallback((newZoom: number): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const clampedZoom = Math.min(Math.max(newZoom, ZOOM.MIN), ZOOM.MAX);
    const center = canvas.getCenter();
    canvas.zoomToPoint(new Point(center.left, center.top), clampedZoom);
    if (batchedRenderRef.current) {
      batchedRenderRef.current();
    }
    setZoomState(clampedZoom);
  }, [canvasRef, batchedRenderRef]);

  useEffect(() => {
    setRefs(socket, canWrite, userId);
  }, [socket, canWrite, userId, setRefs]);

  const updateElement = useCallback((id: string, element: Element, isMoving = false): void => {
    updateElementBase(id, element, isMoving, elementsMapRef, socket ? { current: socket } : { current: null }, isUpdatingRef, emitThrottled);
  }, [updateElementBase, elementsMapRef, socket, isUpdatingRef, emitThrottled]);

  const initCanvas = useCallback((canvasElement: HTMLCanvasElement): () => void => {
    return initCanvasBase(canvasElement, {
      onObjectModified: updateElement,
      onObjectMoving: updateElement
    } as InitCanvasCallbacks);
  }, [initCanvasBase, updateElement]);

  const addElement = useCallback((element: Element): void => {
    addElementBase(element, canvasRef, elementsMapRef, socket ? { current: socket } : { current: null }, isUpdatingRef);
  }, [addElementBase, canvasRef, elementsMapRef, socket, isUpdatingRef]);

  const clearCanvas = useCallback((): void => {
    clearElementsBase(canvasRef, elementsMapRef, socket ? { current: socket } : { current: null });
  }, [clearElementsBase, canvasRef, elementsMapRef, socket]);

  const setColor = useCallback((newColor: string): void => {
    setColorBase(newColor, setCanvasDrawingMode);
  }, [setColorBase, setCanvasDrawingMode]);

  const value = useMemo((): WhiteboardContextValue => ({
    tool,
    color,
    width,
    fontSize,
    zoom,
    selectedShape,
    activeUsers,
    canvasRef,
    batchedRenderRef,
    isUpdatingRef,
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
  }), [
    tool,
    color,
    width,
    fontSize,
    zoom,
    selectedShape,
    activeUsers,
    canvasRef,
    batchedRenderRef,
    isUpdatingRef,
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
  ]);

  return (
    <WhiteboardContext.Provider value={value}>
      {children}
    </WhiteboardContext.Provider>
  );
}
