import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from './SocketContext';
import { fabric } from 'fabric';
import { v4 as uuidv4 } from 'uuid';

const WhiteboardContext = createContext(null);

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
    const commonProps = {
      ...element.data,
      id: element.id,
      selectable: isSelectable,
      hasControls: isSelectable,
      hasBorders: isSelectable,
      strokeUniform: true
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
            stroke: element.data.stroke || color
          });
        } else if (Array.isArray(element.data.path)) {
          obj = new fabric.Path(element.data.path.join(' '), {
            ...commonProps,
            fill: null,
            strokeWidth: element.data.strokeWidth || width,
            stroke: element.data.stroke || color
          });
        }
        break;
      case 'i-text':
      case 'text':
        obj = new fabric.IText(element.data.text || '', {
          ...commonProps,
          left: element.data.left,
          top: element.data.top,
          fontSize: element.data.fontSize || 20,
          fill: element.data.stroke || color,
          backgroundColor: null
        });
        break;
      case 'diagram':
        if (!element.data.src) {
          console.warn('Diagram element has no src');
          return null;
        }
        
        // Create a temporary placeholder
        obj = new fabric.Rect({
          ...commonProps,
          fill: 'rgba(0,0,0,0)',
          stroke: 'rgba(0,0,0,0)',
          width: 150,
          height: 100
        });

        // Load the actual image
        fabric.Image.fromURL(element.data.src, (img) => {
          img.set({
            ...commonProps,
            id: element.id,
            data: {
              ...element.data,
              isDiagram: true, // Mark this image as a diagram
              src: element.data.src // Ensure src is preserved
            },
            left: element.data.left || 50,
            top: element.data.top || 50,
            scaleX: element.data.scaleX ?? 1,
            scaleY: element.data.scaleY ?? 1,
            angle: element.data.angle ?? 0,
            selectable: isSelectable,
            hasControls: isSelectable,
            hasBorders: isSelectable
          });

          const canvas = canvasRef.current;
          if (!canvas) return;

          // Remove the placeholder
          canvas.remove(obj);
          // Add the image and store it in the elements map
          canvas.add(img);
          elementsMapRef.current.set(element.id, {
            ...element,
            fabricObject: img
          });
          canvas.requestRenderAll();
        });
        break;
      default:
        console.warn('Unknown shape type:', element.type);
        return null;
    }

    if (obj) {
      obj.id = element.id;
      obj.selectable = isSelectable;
      obj.hasControls = isSelectable;
      obj.hasBorders = isSelectable;
      
      obj.set('data', element.data);
    }

    return obj;
  }, [color, width]);

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
        // For existing objects
        if (element.type === 'diagram' && existingObject.type === 'image') {
          // This is our diagram (fabric.Image with isDiagram flag)
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
          existingObject.setCoords();
        }
        // For paths, always recreate
        else if (element.type === 'path') {
          canvas.remove(existingObject);
          const newObject = createFabricObject(element, tool === 'select');
          if (newObject) {
            canvas.add(newObject);
          }
        }
        // For other objects, just update properties
        else {
          Object.keys(element.data || {}).forEach(key => {
            if (!['selectable', 'hasControls', 'hasBorders'].includes(key)) {
              existingObject.set(key, element.data[key]);
            }
          });
          existingObject.setCoords();
        }
      } else {
        // Create new object if it doesn't exist
        const newObject = createFabricObject(element, tool === 'select');
        if (newObject) {
          canvas.add(newObject);
        }
      }
    });

    // Update selection properties for all objects
    canvas.getObjects().forEach(obj => {
      obj.set({
        selectable: tool === 'select',
        hasControls: tool === 'select',
        hasBorders: tool === 'select'
      });
    });

    canvas.requestRenderAll();
    setElements(elements);
  }, [createFabricObject, tool]);

  const initCanvas = useCallback((canvasElement) => {
    if (!canvasElement) return;

    const canvas = new fabric.Canvas(canvasElement, {
      isDrawingMode: tool === 'pen',
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: '#ffffff',
      selection: tool === 'select',
      preserveObjectStacking: true
    });

    const brush = new fabric.PencilBrush(canvas);
    brush.color = color;
    brush.width = width;
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
          scaleY: path.scaleY
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

    const handleWorkspaceState = (state) => {
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

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('workspace-state', handleWorkspaceState);
    socket.on('whiteboard-update', handleWhiteboardUpdate);

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
      socket.off('workspace-state', handleWorkspaceState);
      socket.off('whiteboard-update', handleWhiteboardUpdate);
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
    
    canvas.isDrawingMode = canDraw && tool === 'pen';
    canvas.selection = canDraw && tool === 'select';
    
    const needsObjectUpdate = tool === 'select' || tool === 'pen';
    if (needsObjectUpdate) {
      canvas.getObjects().forEach(obj => {
        obj.set({
          selectable: canDraw && tool === 'select',
          hasControls: canDraw && tool === 'select',
          hasBorders: canDraw && tool === 'select'
        });
      });
      canvas.requestRenderAll();
    }
  }, [tool, isLoading, isConnected]);

  const clearCanvas = useCallback(() => {
    if (socket && isConnected) {
      const workspaceId = window.location.pathname.split('/')[2];
      socket.emit('whiteboard-clear', { workspaceId });
    }
  }, [socket, isConnected]);

  const value = {
    elements,
    activeUsers,
    tool,
    selectedShape,
    color,
    width,
    isConnected,
    isLoading,
    connectionStatus,
    canvasRef,
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
