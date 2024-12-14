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
  const canvasRef = useRef(null);
  const pendingElements = useRef(new Map());

  // Initialize canvas
  const initCanvas = useCallback((canvasElement) => {
    if (!canvasElement) return;

    const canvas = new fabric.Canvas(canvasElement, {
      isDrawingMode: false,
      width: window.innerWidth * 0.8,
      height: window.innerHeight * 0.8,
      backgroundColor: '#ffffff',
      selection: true
    });

    canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
    canvas.freeDrawingBrush.color = color;
    canvas.freeDrawingBrush.width = width;
    canvas.isDrawingMode = tool === 'pen';
    canvas.selection = tool === 'select';

    canvasRef.current = canvas;
    
    return () => {
      canvas.dispose();
      canvasRef.current = null;
    };
  }, [color, width, tool]);

  // Handle socket connection events
  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      setIsConnected(true);
      const workspaceId = window.location.pathname.split('/')[2];
      if (workspaceId) {
        socket.emit('join-workspace', workspaceId);
      }
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [socket]);

  // Handle whiteboard updates
  useEffect(() => {
    if (!socket || !canvasRef.current) return;

    const handleWhiteboardUpdate = (updatedElements) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Update React state
      setElements(prev => {
        const currentElementsMap = new Map(prev.map(el => [el.id, el]));
        
        updatedElements.forEach(element => {
          if (!element.id) return;
          currentElementsMap.set(element.id, {
            ...element,
            selectable: tool === 'select',
            evented: tool === 'select'
          });
        });

        pendingElements.current.forEach((element, id) => {
          if (!currentElementsMap.has(id)) {
            currentElementsMap.set(id, element);
          }
        });

        return Array.from(currentElementsMap.values());
      });

      // Update Fabric.js canvas
      updatedElements.forEach(element => {
        let obj = canvas.getObjects().find(o => o.id === element.id);

        if (!obj) {
          obj = createFabricObject(element, tool === 'select');
          if (obj) {
            canvas.add(obj);
          }
        } else {
          obj.set({
            ...element.data,
            selectable: tool === 'select',
            hasControls: tool === 'select',
            hasBorders: tool === 'select'
          });
          obj.setCoords();
        }
      });

      canvas.renderAll();
    };

    const handleWorkspaceState = (state) => {
      if (state.whiteboardElements) {
        handleWhiteboardUpdate(state.whiteboardElements);
      }
      if (state.activeUsers !== undefined) {
        setActiveUsers(state.activeUsers);
      }
    };

    const handleWhiteboardClear = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.clear();
        canvas.backgroundColor = '#ffffff';
        canvas.renderAll();
      }
      setElements([]);
      pendingElements.current.clear();
    };

    socket.on('whiteboard-update', handleWhiteboardUpdate);
    socket.on('workspace-state', handleWorkspaceState);
    socket.on('whiteboard-clear', handleWhiteboardClear);

    return () => {
      socket.off('whiteboard-update', handleWhiteboardUpdate);
      socket.off('workspace-state', handleWorkspaceState);
      socket.off('whiteboard-clear', handleWhiteboardClear);
    };
  }, [socket, tool]);

  // Helper function to create Fabric.js objects
  const createFabricObject = (element, isSelectable) => {
    let obj;
    switch (element.type) {
      case 'i-text':
        obj = new fabric.IText(element.data.text || '', {
          ...element.data,
          selectable: isSelectable,
          hasControls: isSelectable,
          hasBorders: isSelectable
        });
        break;
      case 'rect':
        obj = new fabric.Rect({
          ...element.data,
          selectable: isSelectable,
          hasControls: isSelectable,
          hasBorders: isSelectable
        });
        break;
      case 'circle':
        obj = new fabric.Circle({
          ...element.data,
          selectable: isSelectable,
          hasControls: isSelectable,
          hasBorders: isSelectable
        });
        break;
      case 'triangle':
        obj = new fabric.Triangle({
          ...element.data,
          selectable: isSelectable,
          hasControls: isSelectable,
          hasBorders: isSelectable
        });
        break;
      case 'path':
        obj = new fabric.Path(element.data.path, {
          ...element.data,
          selectable: isSelectable,
          hasControls: isSelectable,
          hasBorders: isSelectable
        });
        break;
      case 'group':
        obj = new fabric.Group(element.data.objects, {
          ...element.data,
          selectable: isSelectable,
          hasControls: isSelectable,
          hasBorders: isSelectable
        });
        break;
      case 'polyline':
        obj = new fabric.Polyline(element.data.points, {
          ...element.data,
          selectable: isSelectable,
          hasControls: isSelectable,
          hasBorders: isSelectable
        });
        break;
      default:
        console.warn('Unknown shape type:', element.type);
        return null;
    }
    obj.id = element.id;
    return obj;
  };

  // Add new element
  const addElement = useCallback((element) => {
    const elementWithProps = {
      ...element,
      id: element.id || uuidv4(),
      selectable: tool === 'select',
      evented: tool === 'select'
    };
    
    pendingElements.current.set(elementWithProps.id, elementWithProps);
    
    const workspaceId = window.location.pathname.split('/')[2];
    if (workspaceId && socket) {
      socket.emit('whiteboard-update', {
        workspaceId,
        elements: [elementWithProps]
      });
    }
  }, [socket, tool]);

  // Update existing element
  const updateElement = useCallback((id, element) => {
    const elementWithProps = {
      ...element,
      selectable: tool === 'select',
      evented: tool === 'select'
    };

    const workspaceId = window.location.pathname.split('/')[2];
    if (workspaceId && socket) {
      socket.emit('whiteboard-update', {
        workspaceId,
        elements: [elementWithProps]
      });
    }
  }, [socket, tool]);

  // Clear canvas
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
    setTool,
    selectedShape,
    setSelectedShape,
    color,
    setColor,
    width,
    setWidth,
    isConnected,
    addElement,
    updateElement,
    clearCanvas,
    initCanvas,
    canvasRef
  };

  return (
    <WhiteboardContext.Provider value={value}>
      {children}
    </WhiteboardContext.Provider>
  );
}
