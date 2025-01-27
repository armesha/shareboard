// [context] WhiteboardContext.jsx

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from './SocketContext';
import { fabric } from 'fabric';
import { v4 as uuidv4 } from 'uuid';

const WhiteboardContext = createContext(null);
const WHITEBOARD_BG_COLOR = 'rgb(249, 250, 251)'; // Tailwind's bg-gray-50

export function useWhiteboard() {
  return useContext(WhiteboardContext);
}

export function WhiteboardProvider({ children }) {
  const socket = useSocket();
  const [elements, setElements] = useState([]);
  const [activeUsers, setActiveUsers] = useState(0);
  const [tool, setTool] = useState('pen');
  const [selectedShape, setSelectedShape] = useState(null);
  const [color, setColor] = useState('#000000');
  const [width, setWidth] = useState(2);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const canvasRef = useRef(null);
  const elementsMapRef = useRef(new Map());

  const addElement = useCallback((element) => {
    if (!element.id) {
      element.id = uuidv4();
    }

    const elementWithProps = {
      ...element,
      selectable: tool === 'select',
      evented: tool === 'select'
    };

    elementsMapRef.current.set(element.id, elementWithProps);
    
    const allElements = Array.from(elementsMapRef.current.values());
    setElements(allElements);
    
    const workspaceId = window.location.pathname.split('/')[2];
    if (workspaceId && socket) {
      console.log('Sending new element to server:', elementWithProps);
      socket.emit('whiteboard-update', {
        workspaceId,
        elements: allElements
      });
    }

    // Bring the new element to front
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (canvas) {
        const fabricObj = canvas.getObjects().find(obj => obj.id === element.id);
        if (fabricObj) {
          fabricObj.bringToFront();
          canvas.requestRenderAll();
        }
      }
    }, 0);
  }, [socket, tool]);

  const updateElement = useCallback((id, element) => {
    if (!id || !elementsMapRef.current.has(id)) return;

    const elementWithProps = {
      ...element,
      id,
      selectable: tool === 'select',
      evented: tool === 'select'
    };

    elementsMapRef.current.set(id, elementWithProps);
    
    const allElements = Array.from(elementsMapRef.current.values());
    setElements(allElements);

    const workspaceId = window.location.pathname.split('/')[2];
    if (workspaceId && socket) {
      console.log('Sending updated element to server:', elementWithProps);
      socket.emit('whiteboard-update', {
        workspaceId,
        elements: allElements
      });
    }
  }, [socket, tool]);

  const createFabricObject = useCallback((element, isSelectable = false) => {
    if (!element || !element.type || !element.data) return null;

    let obj;
    const isDiagram = element.type === 'diagram' || element.data?.isDiagram === true;
    const isTextObject = element.type === 'text';
    const isInteractive = isTextObject || isDiagram;

    const commonProps = {
      ...element.data,
      id: element.id,
      selectable: isSelectable || isTextObject,
      hasControls: isSelectable || isTextObject,
      hasBorders: isSelectable || isTextObject,
      evented: true,
      lockMovementX: !(isSelectable || isTextObject),
      lockMovementY: !(isSelectable || isTextObject),
      hoverCursor: isInteractive ? 'move' : 'default',
      perPixelTargetFind: true,
      targetFindTolerance: 5,
      strokeUniform: true,
      globalCompositeOperation: element.data.globalCompositeOperation || 'source-over'
    };

    switch (element.type) {
      case 'rect':
        obj = new fabric.Rect(commonProps);
        break;
      case 'circle':
        obj = new fabric.Circle(commonProps);
        break;
      case 'triangle':
        obj = new fabric.Triangle(commonProps);
        break;
      case 'path':
        if (typeof element.data.path === 'string') {
          obj = new fabric.Path(element.data.path, {
            ...commonProps,
            fill: null,
            strokeWidth: element.data.strokeWidth || width,
            stroke: element.data.stroke || color,
            strokeUniform: true,
            strokeLineCap: 'round',
            strokeLineJoin: 'round',
            strokeMiterLimit: 10,
            globalCompositeOperation: element.data.globalCompositeOperation || 'source-over'
          });
        } else if (Array.isArray(element.data.path)) {
          obj = new fabric.Path(element.data.path.join(' '), {
            ...commonProps,
            fill: null,
            strokeWidth: element.data.strokeWidth || width,
            stroke: element.data.stroke || color,
            strokeUniform: true,
            strokeLineCap: 'round',
            strokeLineJoin: 'round',
            strokeMiterLimit: 10,
            globalCompositeOperation: element.data.globalCompositeOperation || 'source-over'
          });
        }
        break;
      case 'i-text':
      case 'text':
        obj = new fabric.Text(element.data.text || '', {
          ...commonProps,
          left: element.data.left,
          top: element.data.top,
          fontSize: element.data.fontSize || 20,
          fill: element.data.fill || color,
          backgroundColor: null,
          selectable: true,
          hasControls: true,
          hasBorders: true,
          evented: true,
          perPixelTargetFind: true
        });
        break;
      case 'diagram':
        if (!element.data.src) {
          console.warn('Diagram element has no src');
          return null;
        }
        
        obj = new fabric.Rect({
          ...commonProps,
          fill: 'rgba(0,0,0,0)',
          stroke: 'rgba(0,0,0,0)',
          width: 150,
          height: 100
        });

        fabric.Image.fromURL(element.data.src, (img) => {
          img.set({
            ...commonProps,
            id: element.id,
            data: {
              ...element.data,
              isDiagram: true
            },
            left: element.data.left || 50,
            top: element.data.top || 50,
            scaleX: element.data.scaleX ?? 1,
            scaleY: element.data.scaleY ?? 1,
            angle: element.data.angle ?? 0,
            selectable: isSelectable && isInteractive,
            hasControls: isSelectable && isInteractive,
            hasBorders: isSelectable && isInteractive,
            evented: isInteractive,
            lockMovementX: !isInteractive,
            lockMovementY: !isInteractive,
            hoverCursor: isInteractive ? 'move' : 'default',
            perPixelTargetFind: false,
            padding: 20,
            transparentCorners: true,
            cornerStyle: 'circle',
            cornerSize: 8,
            cornerColor: '#2196F3',
            borderColor: '#2196F3',
            borderOpacityWhenMoving: 0.5
          });

          const canvas = canvasRef.current;
          if (!canvas) return;

          canvas.remove(obj);
          canvas.add(img);
          img.bringToFront();
          canvas.requestRenderAll();

          elementsMapRef.current.set(element.id, {
            ...element,
            type: 'diagram',
            data: {
              ...element.data,
              isDiagram: true
            }
          });
        });
        break;
      default:
        console.warn('Unknown shape type:', element.type);
        return null;
    }

    if (obj) {
      obj.id = element.id;
      if (isTextObject) {
        obj.set({
          selectable: true,
          hasControls: true,
          hasBorders: true,
          evented: true,
          perPixelTargetFind: true
        });
      }
      
      obj.set('data', element.data);
    }

    return obj;
  }, [color]);

  const handleWhiteboardUpdate = useCallback((elements) => {
    console.log('Processing whiteboard update:', {
      elementsCount: elements?.length || 0
    });

    const canvas = canvasRef.current;
    if (!canvas) return;

    elements.forEach(element => {
      if (!element || !element.id) return;

      const existingObject = canvas.getObjects().find(obj => obj.id === element.id);
      
      if (existingObject) {
        if (element.type === 'text') {
          existingObject.set({
            text: element.data.text,
            left: element.data.left,
            top: element.data.top,
            fontSize: element.data.fontSize || 20,
            fill: element.data.fill || color,
            angle: element.data.angle || 0,
            scaleX: element.data.scaleX || 1,
            scaleY: element.data.scaleY || 1,
            selectable: true,
            hasControls: true,
            hasBorders: true,
            evented: true
          });
          existingObject.setCoords();
        }
        else if (element.type === 'diagram' && existingObject.type === 'image') {
          existingObject.set({
            left: element.data.left,
            top: element.data.top,
            scaleX: element.data.scaleX,
            scaleY: element.data.scaleY,
            angle: element.data.angle,
            selectable: tool === 'select',
            hasControls: tool === 'select',
            hasBorders: tool === 'select',
            data: {
              ...element.data,
              isDiagram: true,
              src: element.data.src
            }
          });
          existingObject.bringToFront();
          existingObject.setCoords();
        }
        else if (element.type === 'path') {
          canvas.remove(existingObject);
          const newObject = createFabricObject(element, tool === 'select');
          if (newObject) {
            canvas.add(newObject);
            newObject.bringToFront();
          }
        }
        else {
          Object.keys(element.data || {}).forEach(key => {
            if (!['selectable', 'hasControls', 'hasBorders'].includes(key)) {
              existingObject.set(key, element.data[key]);
            }
          });
          existingObject.bringToFront();
          existingObject.setCoords();
        }
      } else {
        const newObject = createFabricObject(element, tool === 'select');
        if (newObject) {
          canvas.add(newObject);
          if (element.type === 'text') {
            newObject.bringToFront();
          } else {
            newObject.bringToFront();
          }
        }
      }
    });

    canvas.getObjects().forEach(obj => {
      if (obj.type === 'text') {
        obj.set({
          selectable: true,
          hasControls: true,
          hasBorders: true,
          evented: true
        });
      } else {
        obj.set({
          selectable: tool === 'select',
          hasControls: tool === 'select',
          hasBorders: tool === 'select'
        });
      }
    });

    canvas.requestRenderAll();
    setElements(elements);
  }, [createFabricObject, tool, color]);

  const initCanvas = useCallback((canvasElement) => {
    if (!canvasElement) return;

    fabric.Object.prototype.selectable = false;
    fabric.Object.prototype.hasControls = false;
    fabric.Object.prototype.hasBorders = false;
    fabric.Object.prototype.evented = false;
    fabric.Object.prototype.lockMovementX = true;
    fabric.Object.prototype.lockMovementY = true;
    fabric.Object.prototype.hoverCursor = 'default';
    fabric.Object.prototype.perPixelTargetFind = false;
    fabric.Object.prototype.targetFindTolerance = 0;
    fabric.Object.prototype.selection = false;
    fabric.Object.prototype.selectionBackgroundColor = 'transparent';
    fabric.Object.prototype.transparentCorners = true;
    fabric.Object.prototype.padding = 0;
    fabric.Object.prototype.borderColor = 'transparent';
    fabric.Object.prototype.cornerColor = 'transparent';
    fabric.Object.prototype.cornerSize = 0;
    fabric.Object.prototype.transparentCorners = true;
    fabric.Object.prototype.borderOpacityWhenMoving = 0;

    const canvas = new fabric.Canvas(canvasElement, {
      isDrawingMode: tool === 'pen',
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: WHITEBOARD_BG_COLOR,
      selection: false,
      preserveObjectStacking: true,
      perPixelTargetFind: true,
      targetFindTolerance: 0,
      selectionColor: 'transparent',
      selectionBorderColor: 'transparent',
      selectionLineWidth: 0,
      skipTargetFind: true,
      hoverCursor: 'default'
    });

    const brush = new fabric.PencilBrush(canvas);
    brush.color = color;
    brush.width = width;
    brush.strokeLineCap = 'round';
    brush.strokeLineJoin = 'round';
    brush.strokeMiterLimit = 10;
    brush.strokeUniform = true;
    canvas.freeDrawingBrush = brush;

    canvas.on('path:created', (e) => {
      const path = e.path;
      const pathData = {
        id: uuidv4(),
        type: 'path',
        data: {
          path: path.path,
          stroke: path.stroke,
          strokeWidth: path.strokeWidth,
          left: path.left,
          top: path.top,
          scaleX: path.scaleX,
          scaleY: path.scaleY,
          globalCompositeOperation: 'source-over'
        }
      };

      addElement(pathData);
    });
    
    canvasRef.current = canvas;
    
    return () => {
      canvas.dispose();
      canvasRef.current = null;
    };
  }, [tool, color, width, addElement]);

  // Consolidated useEffect for brush color and width
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas?.freeDrawingBrush) return;

    canvas.freeDrawingBrush.color = color;
    canvas.freeDrawingBrush.width = width;
  }, [color, width]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.clear();
    elementsMapRef.current.clear();
    setElements([]);

    const workspaceId = window.location.pathname.split('/')[2];
    if (workspaceId && socket) {
      socket.emit('whiteboard-clear', { workspaceId });
    }
  }, [socket]);

  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      setIsConnected(true);
      setConnectionStatus('connected');
      const workspaceId = window.location.pathname.split('/')[2];
      if (workspaceId) {
        socket.emit('join-workspace', workspaceId);
      }
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      setConnectionStatus('disconnected');
      setIsLoading(true);
    };

    const handleWhiteboardState = (state) => {
      console.log('Received workspace state:', {
        whiteboardElements: state.whiteboardElements?.length || 0,
        diagrams: state.diagrams?.length || 0,
        allDrawings: state.allDrawings?.length || 0,
        activeUsers: state.activeUsers
      });

      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.clear();
      elementsMapRef.current.clear();

      if (state.whiteboardElements && state.whiteboardElements.length > 0) {
        console.log('Adding whiteboardElements to canvas:', state.whiteboardElements.length);
        handleWhiteboardUpdate(state.whiteboardElements);
      }

      setActiveUsers(state.activeUsers);
      setIsLoading(false);
    };

    const handleWhiteboardClear = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.clear();
        elementsMapRef.current.clear();
        setElements([]);
      }
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('workspace-state', handleWhiteboardState);
    socket.on('whiteboard-update', handleWhiteboardUpdate);
    socket.on('whiteboard-clear', handleWhiteboardClear);

    if (socket.connected) {
      setIsConnected(true);
      setConnectionStatus('connected');
      const workspaceId = window.location.pathname.split('/')[2];
      if (workspaceId) {
        socket.emit('join-workspace', workspaceId);
      }
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('workspace-state', handleWhiteboardState);
      socket.off('whiteboard-update', handleWhiteboardUpdate);
      socket.off('whiteboard-clear', handleWhiteboardClear);
    };
  }, [socket, handleWhiteboardUpdate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas?.freeDrawingBrush) return;

    canvas.freeDrawingBrush.color = color;
    canvas.freeDrawingBrush.width = width;
  }, [color, width]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const canDraw = !isLoading && isConnected;
    
    // Only handle selection and object interactions
    canvas.selection = canDraw && (tool === 'select');

    canvas.getObjects().forEach(obj => {
      const isInteractive = obj.type === 'image' || obj.type === 'text' || obj.type === 'i-text';
      const isSelectable = canDraw && tool === 'select' && isInteractive;
      obj.set({
        selectable: isSelectable,
        hasControls: isSelectable,
        hasBorders: isSelectable,
        evented: isInteractive,
        lockMovementX: !isSelectable,
        lockMovementY: !isSelectable
      });
    });

    canvas.skipTargetFind = (tool !== 'select');
    canvas.requestRenderAll();
  }, [tool, isLoading, isConnected]);

  const value = {
    tool,
    color,
    width,
    elements,
    selectedShape,
    activeUsers,
    isConnected,
    isLoading,
    connectionStatus,
    canvasRef,
    WHITEBOARD_BG_COLOR,
    addElement,
    updateElement,
    setTool,
    setSelectedShape,
    setColor,
    setWidth,
    initCanvas,
    clearCanvas
  };

  return (
    <WhiteboardContext.Provider value={value}>
      {children}
    </WhiteboardContext.Provider>
  );
}
