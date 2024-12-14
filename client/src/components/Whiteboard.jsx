import { useEffect, useRef, forwardRef, useImperativeHandle, useCallback, useState } from 'react';
import { fabric } from 'fabric';
import { v4 as uuidv4 } from 'uuid';
import { useWhiteboard } from '../context/WhiteboardContext'; 

const Whiteboard = forwardRef(({ socket }, ref) => {
  const canvasRef = useRef(null);
  const fabricRef = useRef(null);
  const isDrawing = useRef(false);
  const currentShape = useRef(null);
  const startPoint = useRef(null);
  const [isCreatingShape, setIsCreatingShape] = useState(false);
  const { addElement, updateElement, tool, color, width, selectedShape, setSelectedShape } = useWhiteboard();

  // Function to save canvas state
  const saveCanvasState = useCallback(() => {
    if (!fabricRef.current) return;

    const canvas = fabricRef.current;
    const objects = canvas.getObjects();
    const elements = objects.map(obj => ({
      id: obj.id || uuidv4(),
      type: obj.type === 'group' ? 'arrow' : obj.type,
      data: {
        ...obj.toObject(['id']),
        path: obj.type === 'path' ? obj.path : undefined,
        points: obj.type === 'polyline' ? obj.points : undefined,
        text: obj.type === 'i-text' ? obj.text : undefined,
        fontSize: obj.type === 'i-text' ? obj.fontSize : undefined,
        fontFamily: obj.type === 'i-text' ? obj.fontFamily : undefined,
        left: obj.left,
        top: obj.top,
        scaleX: obj.scaleX,
        scaleY: obj.scaleY,
        angle: obj.angle,
        width: obj.width,
        height: obj.height,
        radius: obj.type === 'circle' ? obj.radius : undefined,
        stroke: obj.stroke || color,
        strokeWidth: obj.strokeWidth || width,
        fill: obj.fill,
        originX: obj.originX,
        originY: obj.originY,
        objectCaching: false
      }
    }));

    // Отправляем обновление на сервер
    socket.emit('whiteboard-update', {
      workspaceId: window.location.pathname.split('/')[2],
      elements
    });
  }, [socket, color, width]);

  // Функция для восстановления состояния холста
  const restoreCanvasState = useCallback((elements) => {
    if (!fabricRef.current) return;

    const canvas = fabricRef.current;
    
    // Store current viewport transformation
    const vpt = canvas.viewportTransform ? [...canvas.viewportTransform] : null;
    
    // Create a map of existing objects
    const existingObjects = new Map(
      canvas.getObjects().map(obj => [obj.id, obj])
    );

    // Process each element
    elements.forEach(element => {
      let obj = existingObjects.get(element.id);
      
      // If object exists, update its properties
      if (obj) {
        const currentState = {
          selectable: obj.selectable,
          evented: obj.evented,
          hasControls: obj.hasControls,
          hasBorders: obj.hasBorders
        };
        
        obj.set({
          ...element.data,
          ...currentState,
          objectCaching: false
        });
        
        existingObjects.delete(element.id);
      } else {
        // Create new object
        switch (element.type) {
          case 'path':
            if (element.data.path) {
              obj = new fabric.Path(element.data.path, {
                ...element.data,
                id: element.id,
                objectCaching: false
              });
            }
            break;
          case 'i-text':
            obj = new fabric.IText(element.data.text || '', {
              ...element.data,
              id: element.id,
              objectCaching: false
            });
            break;
          case 'rect':
            obj = new fabric.Rect({
              ...element.data,
              id: element.id,
              objectCaching: false
            });
            break;
          case 'circle':
            obj = new fabric.Circle({
              ...element.data,
              id: element.id,
              objectCaching: false
            });
            break;
          case 'triangle':
            obj = new fabric.Triangle({
              ...element.data,
              id: element.id,
              objectCaching: false
            });
            break;
          case 'arrow':
            if (element.data.path) {
              obj = new fabric.Path(element.data.path, {
                ...element.data,
                id: element.id,
                objectCaching: false,
                strokeLineCap: 'round',
                strokeLineJoin: 'round'
              });
            }
            break;
        }

        if (obj) {
          obj.set({
            selectable: tool === 'select',
            evented: tool === 'select',
            hasControls: tool === 'select',
            hasBorders: tool === 'select'
          });
          canvas.add(obj);
        }
      }
    });

    // Remove objects that no longer exist
    existingObjects.forEach(obj => {
      canvas.remove(obj);
    });

    // Restore viewport transformation
    if (vpt) {
      canvas.setViewportTransform(vpt);
    }

    canvas.requestRenderAll();
  }, [tool]);

  // Mouse down handler
  const handleMouseDown = useCallback((options) => {
    if (!fabricRef.current) return;
    
    const canvas = fabricRef.current;
    const pointer = canvas.getPointer(options.e);

    // Handle different tools
    switch (tool) {
      case 'select':
        // Selection is handled by Fabric.js automatically
        break;

      case 'pen':
        // Drawing is handled by Fabric.js isDrawingMode
        break;

      case 'text':
        options.e.preventDefault();
        const activeObject = canvas.getActiveObject();
        if (activeObject && activeObject.type === 'i-text') {
          return;
        }

        const text = new fabric.IText('Text', {
          left: pointer.x,
          top: pointer.y,
          fontSize: 32,
          fontFamily: 'Arial',
          fill: color,
          id: uuidv4(),
          selectable: true,
          evented: true,
          hasControls: true,
          hasBorders: true,
          editable: true,
          objectCaching: false
        });

        canvas.add(text);
        canvas.setActiveObject(text);
        text.enterEditing();
        canvas.requestRenderAll();
        break;

      case 'shapes':
        isDrawing.current = true;
        setIsCreatingShape(true);
        startPoint.current = pointer;

        let shape;
        const shapeProps = {
          left: pointer.x,
          top: pointer.y,
          fill: 'transparent',
          stroke: color,
          strokeWidth: width,
          selectable: false,
          evented: false,
          objectCaching: false
        };

        if (selectedShape) {
          switch (selectedShape) {
            case 'rectangle':
              shape = new fabric.Rect({
                ...shapeProps,
                width: 0,
                height: 0
              });
              break;
            case 'square':
              shape = new fabric.Rect({
                ...shapeProps,
                width: 0,
                height: 0
              });
              break;
            case 'triangle':
              shape = new fabric.Triangle({
                ...shapeProps,
                width: 0,
                height: 0
              });
              break;
            case 'circle':
              shape = new fabric.Circle({
                ...shapeProps,
                radius: 0
              });
              break;
            case 'arrow':
              shape = new fabric.Path(`M ${pointer.x} ${pointer.y} L ${pointer.x} ${pointer.y}`, {
                ...shapeProps,
                strokeLineCap: 'round',
                strokeLineJoin: 'round'
              });
              break;
          }
        }

        if (shape) {
          shape.id = uuidv4();
          currentShape.current = shape;
          canvas.add(shape);
          canvas.renderAll();
        }
        break;
    }
  }, [tool, selectedShape, color, width]);

  // Mouse move handler
  const handleMouseMove = useCallback((options) => {
    if (!fabricRef.current || !isDrawing.current || !currentShape.current) return;

    const canvas = fabricRef.current;
    const pointer = canvas.getPointer(options.e);
    
    if (!startPoint.current) return;

    const dx = Math.abs(pointer.x - startPoint.current.x);
    const dy = Math.abs(pointer.y - startPoint.current.y);
    const left = Math.min(pointer.x, startPoint.current.x);
    const top = Math.min(pointer.y, startPoint.current.y);

    if (selectedShape) {
      switch (selectedShape) {
        case 'rectangle':
        case 'triangle':
          currentShape.current.set({
            width: dx,
            height: dy,
            left: left,
            top: top
          });
          break;
        case 'square':
          const size = Math.max(dx, dy);
          currentShape.current.set({
            width: size,
            height: size,
            left: left,
            top: top
          });
          break;
        case 'circle':
          const radius = Math.sqrt(dx * dx + dy * dy) / 2;
          currentShape.current.set({
            radius: radius,
            left: pointer.x - radius,
            top: pointer.y - radius
          });
          break;
        case 'arrow':
          const arrowPath = `M ${startPoint.current.x} ${startPoint.current.y} L ${pointer.x} ${pointer.y}`;
          currentShape.current.set({
            path: arrowPath
          });
          break;
      }
      canvas.requestRenderAll();
    }
  }, [selectedShape]);

  // Mouse up handler
  const handleMouseUp = useCallback(() => {
    if (!fabricRef.current || !currentShape.current) return;

    const canvas = fabricRef.current;
    isDrawing.current = false;
    setIsCreatingShape(false);

    if (selectedShape) {
      currentShape.current.set({
        selectable: true,
        evented: true,
        hasControls: true,
        hasBorders: true
      });
      canvas.setActiveObject(currentShape.current);
    }

    // Save canvas state
    saveCanvasState();
    
    // Reset references
    currentShape.current = null;
    startPoint.current = null;
  }, [selectedShape, saveCanvasState]);

  // Object modified handler
  const handleObjectModified = useCallback(() => {
    saveCanvasState();
  }, [saveCanvasState]);

  // Text changed handler
  const handleTextChanged = useCallback(() => {
    saveCanvasState();
  }, [saveCanvasState]);

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    // Only initialize canvas if it hasn't been initialized yet
    if (!fabricRef.current) {
      fabricRef.current = new fabric.Canvas(canvasRef.current, {
        isDrawingMode: false,
        width: window.innerWidth * 0.8,
        height: window.innerHeight * 0.8,
        backgroundColor: '#ffffff',
        selection: true,
        renderOnAddRemove: true,
        stateful: true
      });

      const canvas = fabricRef.current;
      
      // Initialize brush
      canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
      canvas.freeDrawingBrush.color = color;
      canvas.freeDrawingBrush.width = width;

      // Add event listeners
      canvas.on('mouse:down', handleMouseDown);
      canvas.on('mouse:move', handleMouseMove);
      canvas.on('mouse:up', handleMouseUp);
      canvas.on('object:modified', handleObjectModified);
      canvas.on('text:changed', handleTextChanged);
      canvas.on('path:created', saveCanvasState);

      // Save state after each modification
      canvas.on('object:modified', saveCanvasState);
      canvas.on('object:added', saveCanvasState);
      canvas.on('object:removed', saveCanvasState);
    }

    // Update canvas properties based on tool
    const canvas = fabricRef.current;

    // Set drawing mode based on tool
    canvas.isDrawingMode = tool === 'pen';
    canvas.selection = tool === 'select';

    // Update object properties based on tool
    canvas.getObjects().forEach(obj => {
      const isSelectTool = tool === 'select';
      obj.set({
        selectable: isSelectTool,
        evented: isSelectTool,
        hasControls: isSelectTool,
        hasBorders: isSelectTool
      });
    });

    canvas.renderAll();

    return () => {
      if (fabricRef.current) {
        const canvas = fabricRef.current;
        canvas.off('mouse:down', handleMouseDown);
        canvas.off('mouse:move', handleMouseMove);
        canvas.off('mouse:up', handleMouseUp);
        canvas.off('object:modified', handleObjectModified);
        canvas.off('text:changed', handleTextChanged);
        canvas.off('path:created', saveCanvasState);
        canvas.off('object:modified', saveCanvasState);
        canvas.off('object:added', saveCanvasState);
        canvas.off('object:removed', saveCanvasState);
      }
    };
  }, [color, width, tool, saveCanvasState, handleMouseDown, handleMouseMove, handleMouseUp, handleObjectModified, handleTextChanged]);

  // Update brush properties
  useEffect(() => {
    if (!fabricRef.current || !fabricRef.current.freeDrawingBrush) return;

    const canvas = fabricRef.current;
    canvas.freeDrawingBrush.color = color;
    canvas.freeDrawingBrush.width = width;
  }, [color, width]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (fabricRef.current) {
        fabricRef.current.setDimensions({
          width: window.innerWidth * 0.8,
          height: window.innerHeight * 0.8,
        });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Слушаем обновления от сервера
  useEffect(() => {
    if (!socket) return;

    const handleWhiteboardUpdate = (updatedElements) => {
      restoreCanvasState(updatedElements);
    };

    socket.on('whiteboard-update', handleWhiteboardUpdate);

    return () => {
      socket.off('whiteboard-update', handleWhiteboardUpdate);
    };
  }, [socket, restoreCanvasState]);

  // Слушаем очистку доски
  useEffect(() => {
    if (!socket) return;

    const handleWhiteboardClear = () => {
      if (fabricRef.current) {
        fabricRef.current.clear();
      }
    };

    socket.on('whiteboard-clear', handleWhiteboardClear);

    return () => {
      socket.off('whiteboard-clear', handleWhiteboardClear);
    };
  }, [socket]);

  return (
    <div className="relative w-full h-full flex justify-center items-center bg-gray-50">
      <canvas ref={canvasRef} className="border border-gray-300 rounded-lg shadow-lg" />
    </div>
  );
});

export default Whiteboard;
