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
  const elementsMapRef = useRef(new Map());

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

    // Initialize brush with default properties
    const brush = new fabric.PencilBrush(canvas);
    brush.color = color;
    brush.width = width;
    canvas.freeDrawingBrush = brush;
    
    canvasRef.current = canvas;
    
    return () => {
      canvas.dispose();
      canvasRef.current = null;
    };
  }, []);

  // Simple brush property update
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas?.freeDrawingBrush) return;

    canvas.freeDrawingBrush.color = color;
    canvas.freeDrawingBrush.width = width;
  }, [color, width]);

  // Update tool state
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.isDrawingMode = tool === 'pen';
    canvas.selection = tool === 'select';
    
    // Only update object properties when switching to/from select mode
    if (tool === 'select' || canvas.selection !== (tool === 'select')) {
      canvas.getObjects().forEach(obj => {
        obj.set({
          selectable: tool === 'select',
          hasControls: tool === 'select',
          hasBorders: tool === 'select'
        });
      });
    }

    canvas.requestRenderAll();
  }, [tool]);

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

    const handleWorkspaceState = (state) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Clear existing elements
      canvas.clear();

      // Load all elements including diagrams
      if (state.whiteboardElements) {
        state.whiteboardElements.forEach(element => {
          if (element.type === 'diagram') {
            // Handle diagrams specially
            fabric.Image.fromURL(element.src, (img) => {
              img.set({
                left: element.left,
                top: element.top,
                scaleX: element.scaleX,
                scaleY: element.scaleY,
                angle: element.angle,
                id: element.id,
                type: 'diagram'
              });
              canvas.add(img);
              canvas.requestRenderAll();
            });
          } else {
            // Handle other elements
            const fabricObject = new fabric[element.type](element);
            canvas.add(fabricObject);
          }
        });
      }

      // Add any additional diagrams from the diagrams collection
      if (state.diagrams) {
        state.diagrams.forEach(diagram => {
          if (!canvas.getObjects().find(obj => obj.id === diagram.id)) {
            fabric.Image.fromURL(diagram.src, (img) => {
              img.set({
                left: diagram.left,
                top: diagram.top,
                scaleX: diagram.scaleX,
                scaleY: diagram.scaleY,
                angle: diagram.angle,
                id: diagram.id,
                type: 'diagram'
              });
              canvas.add(img);
              canvas.requestRenderAll();
            });
          }
        });
      }

      canvas.requestRenderAll();
      setActiveUsers(state.activeUsers);
    };

    const handleDiagramDeleted = ({ diagramId }) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const diagram = canvas.getObjects().find(obj => obj.id === diagramId);
      if (diagram) {
        canvas.remove(diagram);
        canvas.requestRenderAll();
      }
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('workspace-state', handleWorkspaceState);
    socket.on('diagram-deleted', handleDiagramDeleted);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('workspace-state', handleWorkspaceState);
      socket.off('diagram-deleted', handleDiagramDeleted);
    };
  }, [socket]);

  // Create Fabric object from element data
  const createFabricObject = useCallback((element, isSelectable = false) => {
    if (!element || !element.type || !element.data) return null;

    let obj;
    const commonProps = {
      ...element.data,
      id: element.id,
      selectable: isSelectable,
      hasControls: isSelectable,
      hasBorders: isSelectable
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
        obj = new fabric.Path(element.data.path || '', commonProps);
        break;
      case 'i-text':
        obj = new fabric.IText(element.data.text || '', commonProps);
        break;
      case 'text':
        obj = new fabric.IText(element.data.text || '', {
          ...commonProps,
          left: element.data.left,
          top: element.data.top,
          fontSize: 20,
          fill: element.data.stroke || '#000000'
        });
        break;
      default:
        console.warn('Unknown shape type:', element.type);
        return null;
    }

    return obj;
  }, []);

  // Handle whiteboard updates
  useEffect(() => {
    if (!socket || !canvasRef.current) return;

    const handleWhiteboardUpdate = (updatedElements) => {
      console.log('Received whiteboard update:', updatedElements);
      const canvas = canvasRef.current;
      if (!canvas) return;

      updatedElements.forEach(element => {
        if (element && element.id) {
          // Store in elements map
          elementsMapRef.current.set(element.id, element);

          // Handle diagram elements
          if (element.type === 'diagram') {
            const existingObj = canvas.getObjects().find(obj => obj.id === element.id);
            if (!existingObj) {
              // Create new diagram
              fabric.Image.fromURL(element.src, (img) => {
                img.set({
                  left: element.left || 50,
                  top: element.top || 50,
                  scaleX: element.scaleX || 1,
                  scaleY: element.scaleY || 1,
                  angle: element.angle || 0,
                  id: element.id,
                  type: 'diagram',
                  selectable: tool === 'select',
                  hasControls: tool === 'select',
                  hasBorders: tool === 'select'
                });
                canvas.add(img);
                canvas.requestRenderAll();
              });
            } else {
              // Update existing diagram
              existingObj.set({
                left: element.left,
                top: element.top,
                scaleX: element.scaleX,
                scaleY: element.scaleY,
                angle: element.angle,
                selectable: tool === 'select',
                hasControls: tool === 'select',
                hasBorders: tool === 'select'
              });
              existingObj.setCoords();
            }
          }
        }
      });

      // Update React state
      setElements(Array.from(elementsMapRef.current.values()));
      canvas.requestRenderAll();
    };

    const handleWorkspaceState = (state) => {
      console.log('Received workspace state:', state);
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Clear canvas
      canvas.clear();

      // Reset elements map
      elementsMapRef.current.clear();

      // Add all elements
      if (state.whiteboardElements) {
        handleWhiteboardUpdate(state.whiteboardElements);
      }

      // Add diagrams separately if they exist
      if (state.diagrams) {
        handleWhiteboardUpdate(Array.from(state.diagrams.values()));
      }

      setActiveUsers(state.activeUsers);
    };

    socket.on('whiteboard-update', handleWhiteboardUpdate);
    socket.on('workspace-state', handleWorkspaceState);

    return () => {
      socket.off('whiteboard-update', handleWhiteboardUpdate);
      socket.off('workspace-state', handleWorkspaceState);
    };
  }, [socket, tool]);

  // Add new element
  const addElement = useCallback((element) => {
    if (!element.id) {
      element.id = uuidv4();
    }

    const elementWithProps = {
      ...element,
      selectable: tool === 'select',
      evented: tool === 'select'
    };

    // Add to local map
    elementsMapRef.current.set(element.id, elementWithProps);
    
    // Update React state
    setElements(Array.from(elementsMapRef.current.values()));
    
    // Send to server
    const workspaceId = window.location.pathname.split('/')[2];
    if (workspaceId && socket) {
      console.log('Sending new element to server:', elementWithProps);
      socket.emit('whiteboard-update', {
        workspaceId,
        elements: Array.from(elementsMapRef.current.values()) // Send all elements
      });
    }
  }, [socket, tool]);

  // Update existing element
  const updateElement = useCallback((id, element) => {
    if (!id || !elementsMapRef.current.has(id)) return;

    const elementWithProps = {
      ...element,
      id,
      selectable: tool === 'select',
      evented: tool === 'select'
    };

    // Update local map
    elementsMapRef.current.set(id, elementWithProps);
    
    // Update React state
    setElements(Array.from(elementsMapRef.current.values()));

    // Send to server
    const workspaceId = window.location.pathname.split('/')[2];
    if (workspaceId && socket) {
      console.log('Sending updated element to server:', elementWithProps);
      socket.emit('whiteboard-update', {
        workspaceId,
        elements: Array.from(elementsMapRef.current.values()) // Send all elements
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
