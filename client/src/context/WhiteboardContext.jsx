import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from './SocketContext';
import { fabric } from 'fabric';
import { v4 as uuidv4 } from 'uuid';

const WhiteboardContext = createContext(null);
const WHITEBOARD_BG_COLOR = 'rgb(249, 250, 251)'; // Tailwind's bg-gray-50

const FABRIC_OBJECT_PROPS = [
  'id', 'left', 'top', 'width', 'height', 'scaleX', 'scaleY', 'angle',
  'stroke', 'strokeWidth', 'fill', 'opacity', 'path',
  'strokeLineCap', 'strokeLineJoin', 'strokeMiterLimit',
  'text', 'fontSize', 'fontFamily', 'fontWeight', 'fontStyle',
  'textAlign', 'charSpacing', 'lineHeight'
];

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
  const isUpdatingRef = useRef(false);

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
    if (workspaceId && socket && !isUpdatingRef.current) {
      console.log('Sending new element to server:', elementWithProps);
      socket.emit('whiteboard-update', {
        workspaceId,
        elements: allElements
      });
    }

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
    if (workspaceId && socket && !isUpdatingRef.current) {
      console.log('Sending updated element to server:', elementWithProps);
      socket.emit('whiteboard-update', {
        workspaceId,
        elements: allElements
      });
    }
  }, [socket, tool]);

  const createFabricObject = useCallback((element) => {
    let obj;

    switch (element.type) {
      case 'path':
        obj = new fabric.Path(element.data.path, {
          ...element.data,
          stroke: element.data.stroke || color,
          strokeWidth: element.data.strokeWidth || width,
          fill: null,
          strokeLineCap: 'round',
          strokeLineJoin: 'round',
          strokeMiterLimit: 10,
          perPixelTargetFind: true
        });
        break;

      case 'text':
        obj = new fabric.IText(element.data.text || '', {
          ...element.data,
          left: element.data.left,
          top: element.data.top,
          fontSize: element.data.fontSize || 20,
          fill: element.data.fill || color,
          fontFamily: element.data.fontFamily || 'Arial',
          selectable: true,
          hasControls: true,
          hasBorders: true,
          editable: true
        });
        break;

      case 'rect':
        obj = new fabric.Rect(element.data);
        break;
      case 'circle':
        obj = new fabric.Circle(element.data);
        break;
      case 'triangle':
        obj = new fabric.Triangle(element.data);
        break;
      case 'diagram':
        if (!element.data.src) {
          console.warn('Diagram element has no src');
          return null;
        }
        
        obj = new fabric.Rect({
          ...element.data,
          fill: 'rgba(0,0,0,0)',
          stroke: 'rgba(0,0,0,0)',
          width: 150,
          height: 100
        });

        fabric.Image.fromURL(element.data.src, (img) => {
          img.set({
            ...element.data,
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
            selectable: true,
            hasControls: true,
            hasBorders: true,
            evented: true,
            lockMovementX: false,
            lockMovementY: false,
            hoverCursor: 'move',
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
    }

    return obj;
  }, [color, width]);

  const handleWhiteboardUpdate = useCallback((elements) => {
    console.log('Processing whiteboard update:', {
      elementsCount: elements?.length || 0
    });

    isUpdatingRef.current = true;
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Suspend drawing while processing updates
      canvas.suspendDrawing = true;

      // Create a map of existing objects for faster lookup
      const existingObjectsMap = new Map(
        canvas.getObjects().map(obj => [obj.id, obj])
      );

      elements.forEach(element => {
        if (!element || !element.id) return;

        const existingObject = existingObjectsMap.get(element.id);
        
        if (existingObject) {
          // Only update if properties have changed
          const updateProps = {
            left: element.data.left,
            top: element.data.top,
            scaleX: element.data.scaleX || 1,
            scaleY: element.data.scaleY || 1,
            angle: element.data.angle || 0
          };

          let needsUpdate = false;
          for (const [key, value] of Object.entries(updateProps)) {
            if (existingObject[key] !== value) {
              needsUpdate = true;
              break;
            }
          }

          if (needsUpdate) {
            if (element.type === 'text') {
              updateProps.text = element.data.text;
              updateProps.fontSize = element.data.fontSize || 20;
              updateProps.fill = element.data.fill || color;
              updateProps.selectable = true;
              updateProps.hasControls = true;
              updateProps.hasBorders = true;
              updateProps.evented = true;
            } else {
              updateProps.selectable = tool === 'select';
              updateProps.hasControls = tool === 'select';
              updateProps.hasBorders = tool === 'select';
              updateProps.evented = tool === 'select';
            }

            existingObject.set(updateProps);
            existingObject.setCoords();
          }
        } else {
          const newObject = createFabricObject(element);
          if (newObject) {
            canvas.add(newObject);
            newObject.setCoords();
          }
        }
      });

      // Resume drawing and render once
      canvas.suspendDrawing = false;
      canvas.requestRenderAll();
      
      setElements(elements);
    } finally {
      isUpdatingRef.current = false;
    }
  }, [createFabricObject, tool, color]);

  const initCanvas = useCallback((canvasElement) => {
    const canvas = new fabric.Canvas(canvasElement, {
      backgroundColor: WHITEBOARD_BG_COLOR,
      width: window.innerWidth,
      height: window.innerHeight,
      renderOnAddRemove: false
    });

    canvasRef.current = canvas;

    // Set up event listeners
    const handlePathCreated = (e) => {
      const path = e.path;
      if (!path.id) {
        path.id = uuidv4();
        const data = path.toObject(FABRIC_OBJECT_PROPS);
        
        addElement({
          id: path.id,
          type: 'path',
          data: data
        });
      }
    };

    const handleObjectModified = (e) => {
      const obj = e.target;
      if (!obj || !obj.id || isUpdatingRef.current) return;

      const data = obj.toObject(FABRIC_OBJECT_PROPS);
      
      updateElement(obj.id, {
        type: obj.type,
        data: data
      });
    };

    canvas.on('path:created', handlePathCreated);
    canvas.on('object:modified', handleObjectModified);
    canvas.on('object:moving', handleObjectModified);
    canvas.on('text:changed', handleObjectModified);

    // Handle window resize
    const handleResize = () => {
      canvas.setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
      canvas.requestRenderAll();
    };

    window.addEventListener('resize', handleResize);

    // Cleanup function
    return () => {
      window.removeEventListener('resize', handleResize);
      canvas.off('path:created', handlePathCreated);
      canvas.off('object:modified', handleObjectModified);
      canvas.off('object:moving', handleObjectModified);
      canvas.off('text:changed', handleObjectModified);
      canvas.dispose();
    };
  }, [addElement, updateElement]);

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
        isUpdatingRef.current = true;
        try {
          state.whiteboardElements.forEach(element => {
            if (element && element.id) {
              const obj = createFabricObject(element);
              if (obj) {
                canvas.add(obj);
                elementsMapRef.current.set(element.id, element);
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
          setElements(state.whiteboardElements);
        } finally {
          isUpdatingRef.current = false;
        }
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
