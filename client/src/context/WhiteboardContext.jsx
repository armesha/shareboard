import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from './SocketContext';
import { fabric } from 'fabric';
import { v4 as uuidv4 } from 'uuid';
import { useSharing } from './SharingContext';

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
  const socketContext = useSocket();
  const socket = socketContext?.socket;
  const [elements, setElements] = useState([]);
  const [activeUsers, setActiveUsers] = useState(0);
  const [tool, setTool] = useState('select');
  const [selectedShape, setSelectedShape] = useState(null);
  const [color, setColor] = useState('#000000');
  const [width, setWidth] = useState(2);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const canvasRef = useRef(null);
  const elementsMapRef = useRef(new Map());
  const isUpdatingRef = useRef(false);

  const { canWrite } = useSharing() || { canWrite: () => true };

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
    
    const updatedElements = Array.from(elementsMapRef.current.values());
    setElements(updatedElements);
    
    const workspaceId = window.location.pathname.split('/')[2];
    if (workspaceId && socket && !isUpdatingRef.current) {
      console.log('Sending new element to server:', elementWithProps);
      socket.emit('whiteboard-update', {
        workspaceId,
        elements: [elementWithProps]  // Send only the new/updated element
      });
    }

    if (elementWithProps.type === 'diagram') {
      const canvas = canvasRef.current;
      if (canvas && !canvas.getObjects().some(o => o.id === elementWithProps.id)) {
        const obj = createFabricObject(elementWithProps);
        if (obj) {
          canvas.add(obj);
          obj.bringToFront();
          canvas.requestRenderAll();
        }
      }
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
    
    const updatedElements = Array.from(elementsMapRef.current.values());
    setElements(updatedElements);

    const workspaceId = window.location.pathname.split('/')[2];
    if (workspaceId && socket && !isUpdatingRef.current) {
      console.log('Sending updated element to server:', elementWithProps);
      socket.emit('whiteboard-update', {
        workspaceId,
        elements: [elementWithProps]  // Send only the updated element
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
        
        console.log('Creating diagram object from source:', element.data.src.substring(0, 30) + '...');
        
        obj = new fabric.Rect({
          ...element.data,
          fill: 'rgba(240, 240, 240, 0.5)',
          stroke: '#ccc',
          strokeDashArray: [5, 5],
          strokeWidth: 1,
          width: 200,
          height: 150
        });
        
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = () => {
          console.log('Diagram image loaded successfully:', img.width, 'x', img.height);
          
          const fabricImage = new fabric.Image(img, {
            ...element.data,
            id: element.id,
            left: element.data.left || 50,
            top: element.data.top || 50,
            scaleX: element.data.scaleX || 0.5,
            scaleY: element.data.scaleY || 0.5,
            angle: element.data.angle || 0,
            selectable: true,
            hasControls: true,
            hasBorders: true,
            cornerColor: '#2196F3',
            borderColor: '#2196F3',
            cornerSize: 8,
            padding: 10,
            lockMovementX: false,
            lockMovementY: false,
            lockRotation: false,
            lockScalingX: false,
            lockScalingY: false,
            data: {
              ...element.data,
              isDiagram: true
            }
          });
          
          if (!fabricImage) {
            console.error('Failed to create fabric.Image object');
            return;
          }
          
          const canvas = canvasRef.current;
          if (!canvas) {
            console.error('Canvas not available when adding diagram');
            return;
          }
          
          try {
            const placeholderObj = canvas.getObjects().find(o => o.id === element.id);
            if (placeholderObj) {
              canvas.remove(placeholderObj);
            }
            
            canvas.add(fabricImage);
            fabricImage.bringToFront();
            canvas.requestRenderAll();
            console.log('Diagram successfully added to canvas with ID:', element.id);
            
            elementsMapRef.current.set(element.id, {
              ...element,
              type: 'diagram',
              data: {
                ...element.data,
                isDiagram: true,
                width: img.width,
                height: img.height
              }
            });
          } catch (renderError) {
            console.error('Error rendering diagram to canvas:', renderError);
          }
        };
        
        img.onerror = (error) => {
          console.error('Error loading diagram image:', error, element.data.src.substring(0, 30) + '...');
        };
        
        img.src = element.data.src;
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

  const handleWhiteboardUpdate = useCallback((serverElements) => {
    console.log('Received whiteboard update from server:', serverElements);
    if (!serverElements || !Array.isArray(serverElements) || serverElements.length === 0) {
      console.warn('Received invalid whiteboard update:', serverElements);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    isUpdatingRef.current = true;
    canvas.suspendDrawing = true;

    try {
      const newIds = new Set(serverElements.map(e => e.id));

      serverElements.forEach(element => {
        if (!element || !element.id) return;

        if (element.type === 'diagram') {
          console.log('Processing diagram element update:', element.id);
          
          const existingObject = canvas.getObjects().find(obj => obj.id === element.id);
          
          if (existingObject) {
            console.log('Updating existing diagram', element.id);
            existingObject.set({
              left: element.data.left || existingObject.left,
              top: element.data.top || existingObject.top,
              scaleX: element.data.scaleX || existingObject.scaleX,
              scaleY: element.data.scaleY || existingObject.scaleY,
              angle: element.data.angle || existingObject.angle
            });
            existingObject.setCoords();
          } else {
            console.log('Creating new diagram object', element.id);
            const newObject = createFabricObject(element);
            if (newObject) {
              canvas.add(newObject);
              newObject.setCoords();
            }
          }
          
          elementsMapRef.current.set(element.id, element);
          return;
        }
        
        const existingObject = canvas.getObjects().find(obj => obj.id === element.id);
        
        if (existingObject) {
          const data = element.data || {};
          Object.keys(data).forEach(key => {
            if (existingObject[key] !== data[key]) {
              existingObject.set(key, data[key]);
            }
          });
          existingObject.setCoords();
        } else {
          const newObject = createFabricObject(element);
          if (newObject) {
            canvas.add(newObject);
            newObject.setCoords();
          }
        }

        elementsMapRef.current.set(element.id, element);
      });
      const updatedElements = Array.from(elementsMapRef.current.values());
      setElements(updatedElements);
      
      console.log('Updated whiteboard with server elements:', updatedElements.length);
    } finally {
      canvas.suspendDrawing = false;
      canvas.requestRenderAll();
      isUpdatingRef.current = false;
    }
  }, [createFabricObject]);

  const initCanvas = useCallback((canvasElement) => {
    const canvas = new fabric.Canvas(canvasElement, {
      backgroundColor: WHITEBOARD_BG_COLOR,
      width: window.innerWidth,
      height: window.innerHeight,
      renderOnAddRemove: false,
      isDrawingMode: tool === 'pen'
    });

    const brush = new fabric.PencilBrush(canvas);
    brush.color = color;
    brush.width = width;
    brush.strokeLineCap = 'round';
    brush.strokeLineJoin = 'round';
    canvas.freeDrawingBrush = brush;

    canvasRef.current = canvas;
    const handlePathCreated = (e) => {
      const path = e.path;
      if (!path.id) {
        path.id = uuidv4();
      }
      const data = path.toObject(FABRIC_OBJECT_PROPS);
      
      data.stroke = data.stroke || color;
      data.strokeWidth = data.strokeWidth || width;
      data.strokeLineCap = 'round';
      data.strokeLineJoin = 'round';
      
      const element = {
        id: path.id,
        type: 'path',
        data: data
      };

      addElement(element);
      
      elementsMapRef.current.set(path.id, element);
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

      updateElement(obj.id, element);
      
      elementsMapRef.current.set(obj.id, element);
    };

    canvas.on('path:created', handlePathCreated);
    canvas.on('object:modified', handleObjectModified);
    canvas.on('object:moving', handleObjectModified);
    canvas.on('text:changed', handleObjectModified);

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
      canvas.off('path:created', handlePathCreated);
      canvas.off('object:modified', handleObjectModified);
      canvas.off('object:moving', handleObjectModified);
      canvas.off('text:changed', handleObjectModified);
      canvas.dispose();
    };
  }, [tool, color, width, addElement, updateElement]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas?.freeDrawingBrush) return;

    canvas.freeDrawingBrush.color = color;
    canvas.freeDrawingBrush.width = width;
    canvas.freeDrawingBrush.strokeLineCap = 'round';
    canvas.freeDrawingBrush.strokeLineJoin = 'round';
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
        socket.emit('join-workspace', { workspaceId, userId: socket.id });
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
          const regularElements = state.whiteboardElements.filter(el => el.type !== 'diagram');
          const diagramElements = state.whiteboardElements.filter(el => el.type === 'diagram');
          
          console.log(`Processing ${regularElements.length} regular elements and ${diagramElements.length} diagrams`);
          
          regularElements.forEach(element => {
            if (element && element.id) {
              const obj = createFabricObject(element);
              if (obj) {
                canvas.add(obj);
                elementsMapRef.current.set(element.id, element);
              }
            }
          });
          
          diagramElements.forEach(element => {
            if (element && element.id) {
              console.log('Processing diagram from state:', element.id);
              const obj = createFabricObject(element);
              if (obj) {
                canvas.add(obj);
                elementsMapRef.current.set(element.id, element);
              }
            }
          });

          canvas.getObjects().forEach(obj => {
            const isSelectable = tool === 'select' && canWrite();
            
            obj.set({
              selectable: isSelectable,
              hasControls: isSelectable,
              hasBorders: isSelectable,
              evented: isSelectable
            });
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

    const handleDeleteElement = ({ workspaceId, elementId }) => {
      console.log(`Received delete-element event for workspace ${workspaceId}, element ${elementId}`);
      
      const currentWorkspace = window.location.pathname.split('/')[2];
      if (currentWorkspace !== workspaceId) {
        console.log('Ignoring delete event for different workspace');
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) {
        console.warn('Canvas not available for delete operation');
        return;
      }

      console.log('Current elements before deletion:', Array.from(elementsMapRef.current.values()));

      elementsMapRef.current.delete(elementId);

      const obj = canvas.getObjects().find(o => o.id === elementId);
      if (obj) {
        canvas.remove(obj);
        console.log(`Removed object ${elementId} from canvas`);
      } else {
        console.warn(`Object ${elementId} not found on canvas`);
      }

      const updatedElements = Array.from(elementsMapRef.current.values());
      setElements(updatedElements);
      
      console.log('Elements after deletion:', updatedElements);

      canvas.requestRenderAll();

      const stillExists = canvas.getObjects().some(o => o.id === elementId);
      if (stillExists) {
        console.warn(`Warning: Object ${elementId} still exists on canvas after deletion!`);
      }
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('workspace-state', handleWhiteboardState);
    socket.on('whiteboard-update', handleWhiteboardUpdate);
    socket.on('whiteboard-clear', handleWhiteboardClear);
    socket.on('delete-element', handleDeleteElement);

    if (socket.connected) {
      setIsConnected(true);
      setConnectionStatus('connected');
      const workspaceId = window.location.pathname.split('/')[2];
      if (workspaceId) {
        socket.emit('join-workspace', { workspaceId, userId: socket.id });
      }
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('workspace-state', handleWhiteboardState);
      socket.off('whiteboard-update', handleWhiteboardUpdate);
      socket.off('whiteboard-clear', handleWhiteboardClear);
      socket.off('delete-element', handleDeleteElement);
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

    const userCanDraw = !isLoading && isConnected && canWrite();
    
    canvas.selection = userCanDraw && (tool === 'select');  // Enable selection only if user can write

    const interactiveTypes = ['image', 'text', 'i-text', 'rect', 'circle', 'triangle', 'path', 'line'];
    canvas.getObjects().forEach(obj => {
      const isInteractive = interactiveTypes.includes(obj.type);
      const isSelectable = userCanDraw && (tool === 'select' || tool === 'text' || tool === 'shapes') && isInteractive;

      obj.set({
        selectable: isSelectable,
        hasControls: isSelectable,
        hasBorders: isSelectable,
        evented: isSelectable, // Only allow events if selectable
        lockMovementX: !isSelectable,
        lockMovementY: !isSelectable,
        lockRotation: !isSelectable,
        lockScalingX: !isSelectable,
        lockScalingY: !isSelectable
      });
    });

    canvas.skipTargetFind = !userCanDraw || (tool !== 'select');
    canvas.requestRenderAll();
  }, [tool, isLoading, isConnected, elements, canWrite]);

  const handleColorChange = useCallback((newColor) => {
    const canvas = canvasRef.current;
    let canvasState = null;
    
    if (canvas) {
      canvasState = JSON.stringify(canvas);
    }
    
    setColor(newColor);
    
    if (canvas && canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.color = newColor;
      
      if (canvasState) {
        setTimeout(() => {
          canvas.loadFromJSON(canvasState, () => {
            canvas.renderAll();
          });
        }, 0);
      }
    }
  }, []);

  useEffect(() => {
    if (!canWrite() && (tool !== 'select' || selectedShape !== null)) {
      console.log('Permission changed to read-only, resetting to select tool');
      setTool('select');
      setSelectedShape(null);
    }
  }, [canWrite, tool, selectedShape]);

  const value = {
    tool,
    color,
    width,
    WHITEBOARD_BG_COLOR,
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
    setColor: handleColorChange,
    setWidth
  };

  return (
    <WhiteboardContext.Provider value={value}>
      {children}
    </WhiteboardContext.Provider>
  );
}
