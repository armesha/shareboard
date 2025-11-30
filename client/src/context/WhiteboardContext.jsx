import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSocket } from './SocketContext';
import { fabric } from 'fabric';
import { v4 as uuidv4 } from 'uuid';
import { useSharing } from './SharingContext';
import {
  TOOLS,
  COLORS,
  SOCKET_EVENTS,
  INTERACTIVE_TYPES,
  FABRIC_OBJECT_PROPS,
  TIMING
} from '../constants';
import { getWorkspaceId } from '../utils';
import '../utils/fabricArrow';

const WhiteboardContext = createContext(null);

export function useWhiteboard() {
  return useContext(WhiteboardContext);
}

export function WhiteboardProvider({ children }) {
  const socketContext = useSocket();
  const socket = socketContext?.socket;
  const [elements, setElements] = useState([]);
  const [activeUsers, setActiveUsers] = useState(0);
  const [tool, setTool] = useState(TOOLS.SELECT);
  const [selectedShape, setSelectedShape] = useState(null);
  const [color, setColor] = useState('#000000');
  const [width, setWidth] = useState(2);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const canvasRef = useRef(null);
  const elementsMapRef = useRef(new Map());
  const isUpdatingRef = useRef(false);
  const lastEmitTimeRef = useRef(0);

  const { canWrite } = useSharing() || { canWrite: () => true };

  const createFabricObject = useCallback((element) => {
    let obj;

    switch (element.type) {
      case 'path':
        obj = new fabric.Path(element.data.path, {
          ...element.data,
          stroke: element.data.stroke || '#000000',
          strokeWidth: element.data.strokeWidth || 2,
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
          fill: element.data.fill || '#000000',
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
        if (element.data.points) {
          obj = new fabric.Polygon(element.data.points, {
            ...element.data,
            strokeLineJoin: 'round',
            strokeLineCap: 'round',
            strokeUniform: true
          });
          obj.type = 'triangle';
        } else {
          obj = new fabric.Triangle(element.data);
        }
        break;
      case 'star':
        obj = new fabric.Polygon(element.data.points, {
          ...element.data,
          strokeLineJoin: 'round',
          strokeLineCap: 'round',
          strokeUniform: true
        });
        obj.type = 'star';
        break;
      case 'diamond':
        obj = new fabric.Polygon(element.data.points, {
          ...element.data,
          strokeLineJoin: 'round',
          strokeLineCap: 'round',
          strokeUniform: true
        });
        obj.type = 'diamond';
        break;
      case 'pentagon':
        obj = new fabric.Polygon(element.data.points, {
          ...element.data,
          strokeLineJoin: 'round',
          strokeLineCap: 'round',
          strokeUniform: true
        });
        obj.type = 'pentagon';
        break;
      case 'hexagon':
        obj = new fabric.Polygon(element.data.points, {
          ...element.data,
          strokeLineJoin: 'round',
          strokeLineCap: 'round',
          strokeUniform: true
        });
        obj.type = 'hexagon';
        break;
      case 'line': {
        const { left, top, ...lineOptions } = element.data;
        obj = new fabric.Line([element.data.x1, element.data.y1, element.data.x2, element.data.y2], lineOptions);
        break;
      }
      case 'arrow': {
        const { left, top, ...arrowOptions } = element.data;
        obj = new fabric.Arrow([element.data.x1, element.data.y1, element.data.x2, element.data.y2], arrowOptions);
        break;
      }
      case 'diagram':
        if (!element.data.src) {
          console.warn('Diagram element has no src');
          return null;
        }

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
            data: { ...element.data, isDiagram: true }
          });

          const canvas = canvasRef.current;
          if (!canvas) return;

          const placeholderObj = canvas.getObjects().find(o => o.id === element.id);
          if (placeholderObj) {
            canvas.remove(placeholderObj);
          }

          canvas.add(fabricImage);
          fabricImage.bringToFront();
          canvas.requestRenderAll();

          elementsMapRef.current.set(element.id, {
            ...element,
            type: 'diagram',
            data: { ...element.data, isDiagram: true, width: img.width, height: img.height }
          });
        };

        img.onerror = (error) => {
          console.error('Error loading diagram image:', error);
        };

        img.src = element.data.src;
        break;
      default:
        return null;
    }

    if (obj) {
      obj.id = element.id;
    }

    return obj;
  }, []);

  const addElement = useCallback((element) => {
    if (!element.id) {
      element.id = uuidv4();
    }

    elementsMapRef.current.set(element.id, element);

    const updatedElements = Array.from(elementsMapRef.current.values());
    setElements(updatedElements);

    const workspaceId = getWorkspaceId();
    if (workspaceId && socket && !isUpdatingRef.current) {
      socket.emit(SOCKET_EVENTS.WHITEBOARD_UPDATE, {
        workspaceId,
        elements: [element]
      });
    }

    if (element.type === 'diagram') {
      const canvas = canvasRef.current;
      if (canvas && !canvas.getObjects().some(o => o.id === element.id)) {
        const obj = createFabricObject(element);
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
  }, [socket, createFabricObject]);

  const updateElement = useCallback((id, element, isMoving = false) => {
    if (!id || !elementsMapRef.current.has(id)) return;

    const elementWithId = { ...element, id };

    elementsMapRef.current.set(id, elementWithId);

    if (!isMoving) {
      const updatedElements = Array.from(elementsMapRef.current.values());
      setElements(updatedElements);
    }

    const workspaceId = getWorkspaceId();
    if (workspaceId && socket && !isUpdatingRef.current) {
      if (isMoving) {
        const now = Date.now();
        if (now - lastEmitTimeRef.current >= TIMING.MOVEMENT_TIMEOUT) {
          lastEmitTimeRef.current = now;
          socket.emit(SOCKET_EVENTS.WHITEBOARD_UPDATE, {
            workspaceId,
            elements: [elementWithId]
          });
        }
      } else {
        socket.emit(SOCKET_EVENTS.WHITEBOARD_UPDATE, {
          workspaceId,
          elements: [elementWithId]
        });
      }
    }
  }, [socket]);

  const handleWhiteboardUpdate = useCallback((serverElements) => {
    if (!serverElements || !Array.isArray(serverElements) || serverElements.length === 0) {
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
          const existingObject = canvas.getObjects().find(obj => obj.id === element.id);

          if (existingObject) {
            existingObject.set({
              left: element.data.left || existingObject.left,
              top: element.data.top || existingObject.top,
              scaleX: element.data.scaleX || existingObject.scaleX,
              scaleY: element.data.scaleY || existingObject.scaleY,
              angle: element.data.angle || existingObject.angle
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
    } finally {
      canvas.suspendDrawing = false;
      canvas.requestRenderAll();
      isUpdatingRef.current = false;
    }
  }, [createFabricObject]);

  const initCanvas = useCallback((canvasElement) => {
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
      if (!canWrite()) {
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
      if (workspaceId && socket && !isUpdatingRef.current) {
        socket.emit(SOCKET_EVENTS.WHITEBOARD_UPDATE, {
          workspaceId,
          elements: [element]
        });
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

      updateElement(obj.id, element, false);
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

      updateElement(obj.id, element, true);
    };

    canvas.on('path:created', handlePathCreated);
    canvas.on('object:modified', handleObjectModified);
    canvas.on('object:moving', handleObjectMoving);
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
      canvas.off('object:moving', handleObjectMoving);
      canvas.off('text:changed', handleObjectModified);
      canvas.dispose();
    };
  }, [socket, updateElement]);

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

    const workspaceId = getWorkspaceId();
    if (workspaceId && socket) {
      socket.emit(SOCKET_EVENTS.WHITEBOARD_CLEAR, { workspaceId });
    }
  }, [socket]);

  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      setIsConnected(true);
      setConnectionStatus('connected');
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      setConnectionStatus('disconnected');
      setIsLoading(true);
    };

    const handleWhiteboardState = (state) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.clear();
      elementsMapRef.current.clear();

      if (state.whiteboardElements && state.whiteboardElements.length > 0) {
        isUpdatingRef.current = true;
        try {
          const regularElements = state.whiteboardElements.filter(el => el.type !== 'diagram');
          const diagramElements = state.whiteboardElements.filter(el => el.type === 'diagram');

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
              const obj = createFabricObject(element);
              if (obj) {
                canvas.add(obj);
                elementsMapRef.current.set(element.id, element);
              }
            }
          });

          canvas.getObjects().forEach(obj => {
            const isSelectable = tool === TOOLS.SELECT && canWrite();

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
      const currentWorkspace = getWorkspaceId();
      if (currentWorkspace !== workspaceId) {
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      elementsMapRef.current.delete(elementId);

      const obj = canvas.getObjects().find(o => o.id === elementId);
      if (obj) {
        canvas.remove(obj);
      }

      const updatedElements = Array.from(elementsMapRef.current.values());
      setElements(updatedElements);

      canvas.requestRenderAll();
    };

    const handleUserJoined = ({ activeUsers }) => {
      setActiveUsers(activeUsers);
    };

    const handleUserLeft = ({ activeUsers }) => {
      setActiveUsers(activeUsers);
    };

    socket.on(SOCKET_EVENTS.CONNECT, handleConnect);
    socket.on(SOCKET_EVENTS.DISCONNECT, handleDisconnect);
    socket.on(SOCKET_EVENTS.WORKSPACE_STATE, handleWhiteboardState);
    socket.on(SOCKET_EVENTS.WHITEBOARD_UPDATE, handleWhiteboardUpdate);
    socket.on(SOCKET_EVENTS.WHITEBOARD_CLEAR, handleWhiteboardClear);
    socket.on(SOCKET_EVENTS.DELETE_ELEMENT, handleDeleteElement);
    socket.on(SOCKET_EVENTS.USER_JOINED, handleUserJoined);
    socket.on(SOCKET_EVENTS.USER_LEFT, handleUserLeft);

    if (socket.connected) {
      setIsConnected(true);
      setConnectionStatus('connected');
    }

    return () => {
      socket.off(SOCKET_EVENTS.CONNECT, handleConnect);
      socket.off(SOCKET_EVENTS.DISCONNECT, handleDisconnect);
      socket.off(SOCKET_EVENTS.WORKSPACE_STATE, handleWhiteboardState);
      socket.off(SOCKET_EVENTS.WHITEBOARD_UPDATE, handleWhiteboardUpdate);
      socket.off(SOCKET_EVENTS.WHITEBOARD_CLEAR, handleWhiteboardClear);
      socket.off(SOCKET_EVENTS.DELETE_ELEMENT, handleDeleteElement);
      socket.off(SOCKET_EVENTS.USER_JOINED, handleUserJoined);
      socket.off(SOCKET_EVENTS.USER_LEFT, handleUserLeft);
    };
  }, [socket, handleWhiteboardUpdate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const shouldBeDrawingMode = tool === TOOLS.PEN && canWrite();

    if (canvas.isDrawingMode !== shouldBeDrawingMode) {
      canvas.isDrawingMode = shouldBeDrawingMode;

      if (shouldBeDrawingMode && canvas.freeDrawingBrush) {
        canvas.freeDrawingBrush.color = color;
        canvas.freeDrawingBrush.width = width;
        canvas.freeDrawingBrush.strokeLineCap = 'round';
        canvas.freeDrawingBrush.strokeLineJoin = 'round';
      }

      canvas.requestRenderAll();
    }

    const userCanDraw = !isLoading && isConnected && canWrite();
    canvas.selection = userCanDraw && (tool === TOOLS.SELECT);

    canvas.getObjects().forEach(obj => {
      const isInteractive = INTERACTIVE_TYPES.includes(obj.type);
      const isSelectable = userCanDraw && (tool === TOOLS.SELECT || tool === TOOLS.TEXT || tool === TOOLS.SHAPES) && isInteractive;

      obj.set({
        selectable: isSelectable,
        hasControls: isSelectable,
        hasBorders: isSelectable,
        evented: isSelectable,
        lockMovementX: !isSelectable,
        lockMovementY: !isSelectable,
        lockRotation: !isSelectable,
        lockScalingX: !isSelectable,
        lockScalingY: !isSelectable
      });
    });

    canvas.skipTargetFind = !userCanDraw || (tool !== TOOLS.SELECT);
    canvas.requestRenderAll();
  }, [tool, isLoading, isConnected, canWrite]);

  const handleColorChange = useCallback((newColor) => {
    setColor(newColor);

    const canvas = canvasRef.current;
    if (canvas && canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.color = newColor;
    }

    if (tool !== TOOLS.SHAPES) {
      setTool(TOOLS.PEN);
    }
  }, [tool, setTool]);

  useEffect(() => {
    if (!canWrite() && (tool !== TOOLS.SELECT || selectedShape !== null)) {
      setTool(TOOLS.SELECT);
      setSelectedShape(null);
    }
  }, [canWrite, tool, selectedShape]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (tool === TOOLS.PEN) {
      const hasPermission = canWrite();
      canvas.isDrawingMode = hasPermission;

      if (!hasPermission) {
        setTool(TOOLS.SELECT);
      }
    }
  }, [canWrite, tool, setTool]);

  const value = {
    tool,
    color,
    width,
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
    setColor: handleColorChange,
    setWidth
  };

  return (
    <WhiteboardContext.Provider value={value}>
      {children}
    </WhiteboardContext.Provider>
  );
}
