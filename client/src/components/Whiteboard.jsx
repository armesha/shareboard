import React, { useEffect, useRef, useCallback } from 'react';
import { useWhiteboard } from '../context/WhiteboardContext';
import { useSocket } from '../context/SocketContext';
import { v4 as uuidv4 } from 'uuid';

const Whiteboard = React.memo(() => {
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const currentShape = useRef(null);
  const startPoint = useRef(null);
  const socket = useSocket();
  const { 
    tool, 
    color, 
    width, 
    selectedShape,
    initCanvas,
    canvasRef: fabricCanvasRef,
    addElement,
    updateElement,
    setTool, 
    setColor, 
    setWidth // Add setColor and setWidth to the destructured props
  } = useWhiteboard();

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current) return;
    const cleanup = initCanvas(canvasRef.current);
    return cleanup;
  }, [initCanvas]);

  // Update canvas properties when tool changes
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    
    canvas.isDrawingMode = tool === 'pen';
    canvas.selection = tool === 'select';

    // Сохраняем текущие объекты
    const currentObjects = canvas.getObjects();
    
    // Обновляем свойства объектов
    currentObjects.forEach(obj => {
      obj.set({
        selectable: tool === 'select',
        hasControls: tool === 'select',
        hasBorders: tool === 'select'
      });
    });

    canvas.renderAll();
  }, [tool]);

  // Update brush properties when color or width changes
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas?.freeDrawingBrush) return;

    canvas.freeDrawingBrush.color = color;
    canvas.freeDrawingBrush.width = width;
  }, [color, width]);

  // Handle object modifications
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const handleObjectModified = (e) => {
      const obj = e.target;
      if (!obj) return;

      // Only update if the object has actually changed
      if (obj.modified) {
        updateElement(obj.id, {
          type: obj.type,
          data: obj.toObject(['id'])
        });
        obj.modified = false;
      }
    };

    canvas.on('object:modified', handleObjectModified);

    return () => {
      canvas.off('object:modified', handleObjectModified);
    };
  }, [updateElement]);

  // Handle keyboard events for delete
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Delete' && tool === 'select') {
        const activeObjects = canvas.getActiveObjects();
        if (activeObjects.length > 0) {
          const workspaceId = window.location.pathname.split('/')[2];
          
          activeObjects.forEach(obj => {
            if (obj.id) {
              // Remove object from canvas
              canvas.remove(obj);
              
              // Emit delete event to server
              socket.emit('delete-element', { 
                workspaceId,
                elementId: obj.id 
              });
            }
          });

          // Clear selection and render
          canvas.discardActiveObject();
          canvas.renderAll();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [fabricCanvasRef, tool, socket]);

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const handleScaling = (e) => {
      const object = e.target;
      if (object.strokeWidth) {
        const newStrokeWidth = object.strokeWidth / ((object.scaleX + object.scaleY) / 2);
        object.set('strokeWidth', newStrokeWidth);
        object.setCoords();
      }
    };

    canvas.on('object:scaling', handleScaling);
    canvas.on('object:modified', (e) => {
      const object = e.target;
      if (object.strokeWidth) {
        object.set({
          strokeWidth: object.strokeWidth * ((object.scaleX + object.scaleY) / 2),
          scaleX: 1,
          scaleY: 1
        });
      }
    });

    return () => {
      canvas.off('object:scaling', handleScaling);
    };
  }, [fabricCanvasRef]);

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !socket) return;

    const handleWhiteboardUpdate = (drawings) => {
      if (!Array.isArray(drawings)) return;

      drawings.forEach(element => {
        if (!element || !element.type || !element.data) return;

        // Find existing object with this id
        const existingObj = canvas.getObjects().find(obj => obj.id === element.id);
        
        if (existingObj) {
          // Update existing object
          existingObj.set({
            ...element.data,
            selectable: tool === 'select',
            hasControls: tool === 'select',
            hasBorders: tool === 'select'
          });
          existingObj.setCoords();
        } else {
          // Create new object if it doesn't exist
          let obj;
          const commonProps = {
            ...element.data,
            id: element.id,
            selectable: tool === 'select',
            hasControls: tool === 'select',
            hasBorders: tool === 'select'
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
            case 'text':
              obj = new fabric.IText(element.data.text || '', {
                ...commonProps,
                left: element.data.left,
                top: element.data.top,
                fontSize: element.data.fontSize || 20,
                fill: element.data.fill || color
              });
              break;
            default:
              console.warn('Unknown shape type:', element.type);
              return;
          }

          if (obj) {
            canvas.add(obj);
          }
        }
      });

      canvas.renderAll();
    };

    socket.on('whiteboard-update', handleWhiteboardUpdate);

    return () => {
      socket.off('whiteboard-update', handleWhiteboardUpdate);
    };
  }, [socket, tool, color]);

  const handleMouseDown = useCallback((e) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || tool === 'select') return;

    // Only handle left mouse button
    if (e.e.button !== 0) return;

    isDrawing.current = true;
    const pointer = canvas.getPointer(e.e);
    startPoint.current = pointer;

    if (tool === 'text') {
      const text = new fabric.IText('Text', {
        left: pointer.x,
        top: pointer.y,
        fontSize: 20,
        fill: color,
        id: uuidv4()
      });
      
      canvas.add(text);
      text.enterEditing();
      text.selectAll();
      canvas.setActiveObject(text);
      
      addElement({
        id: text.id,
        type: 'text',
        data: text.toObject(['id'])
      });

      // Автоматически переключаемся на инструмент select после создания текста
      setTool('select');
      
      return;
    }

    if (selectedShape) {
      let shapeObj;
      const commonProps = {
        left: pointer.x,
        top: pointer.y,
        fill: 'transparent',
        stroke: color,
        strokeWidth: width,
        selectable: true,
        hasControls: true,
        hasBorders: true,
        evented: true,
        id: uuidv4()
      };

      switch (selectedShape) {
        case 'rectangle':
          shapeObj = new fabric.Rect({
            ...commonProps,
            width: 0,
            height: 0
          });
          break;
        case 'circle':
          shapeObj = new fabric.Circle({
            ...commonProps,
            radius: 0
          });
          break;
        case 'triangle':
          shapeObj = new fabric.Triangle({
            ...commonProps,
            width: 0,
            height: 0
          });
          break;
      }

      if (shapeObj) {
        canvas.add(shapeObj);
        currentShape.current = shapeObj;
      }
    }
  }, [tool, selectedShape, color, width, fabricCanvasRef, setTool]);

  const handleMouseMove = useCallback((e) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !isDrawing.current || !startPoint.current) return;

    const pointer = canvas.getPointer(e.e);
    const isCtrlPressed = e.e.ctrlKey;

    if (selectedShape && currentShape.current) {
      const shape = currentShape.current;
      const startX = startPoint.current.x;
      const startY = startPoint.current.y;
      const width = pointer.x - startX;
      const height = pointer.y - startY;

      switch (selectedShape) {
        case 'rectangle':
          if (isCtrlPressed) {
            // Draw square when Ctrl is pressed
            const size = Math.abs(width) > Math.abs(height) ? Math.abs(width) : Math.abs(height);
            shape.set({
              width: size,
              height: size,
              left: width > 0 ? startX : startX - size,
              top: height > 0 ? startY : startY - size
            });
          } else {
            // Draw regular rectangle
            shape.set({
              width: Math.abs(width),
              height: Math.abs(height),
              left: width > 0 ? startX : pointer.x,
              top: height > 0 ? startY : pointer.y
            });
          }
          break;
        case 'circle':
          const radius = Math.sqrt(width * width + height * height) / 2;
          shape.set({
            radius: radius,
            left: startX - radius,
            top: startY - radius
          });
          break;
        case 'triangle':
          shape.set({
            width: Math.abs(width),
            height: Math.abs(height),
            left: width > 0 ? startX : pointer.x,
            top: height > 0 ? startY : pointer.y
          });
          break;
      }

      canvas.renderAll();
    }
  }, [selectedShape, fabricCanvasRef]);

  const handleMouseUp = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !isDrawing.current) return;

    isDrawing.current = false;
    
    if (currentShape.current) {
      const shape = currentShape.current;
      
      // Set final properties
      shape.set({
        selectable: true,
        hasControls: true,
        hasBorders: true
      });

      // Add to shared state
      addElement({
        id: shape.id,
        type: shape.type,
        data: shape.toObject(['id'])
      });

      currentShape.current = null;
    }

    startPoint.current = null;
    canvas.renderAll();
  }, [addElement, fabricCanvasRef]);

  // Handle path creation when using pen tool
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const handlePathCreated = (e) => {
      const path = e.path;
      if (!path) return;

      path.id = uuidv4();
      path.selectable = true;
      path.hasControls = true;
      path.hasBorders = true;

      addElement({
        id: path.id,
        type: 'path',
        data: path.toObject(['id'])
      });
    };

    canvas.on('path:created', handlePathCreated);

    return () => {
      canvas.off('path:created', handlePathCreated);
    };
  }, [addElement]);

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);

    return () => {
      canvas.off('mouse:down', handleMouseDown);
      canvas.off('mouse:move', handleMouseMove);
      canvas.off('mouse:up', handleMouseUp);
    };
  }, [handleMouseDown, handleMouseMove, handleMouseUp]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      canvas.setDimensions({
        width: window.innerWidth * 0.8,
        height: window.innerHeight * 0.8
      });
      canvas.renderAll();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !socket) return;

    const handleObjectMoving = (e) => {
      const obj = e.target;
      if (!obj || !obj.id) return;

      const workspaceId = window.location.pathname.split('/')[2];
      
      // Send real-time update during movement
      socket.emit('whiteboard-update', {
        workspaceId,
        elements: [{
          id: obj.id,
          type: obj.type,
          data: obj.toObject(['id'])
        }]
      });
    };

    canvas.on('object:moving', handleObjectMoving);

    return () => {
      canvas.off('object:moving', handleObjectMoving);
    };
  }, [socket]);

  const handleAddImage = useCallback((imageUrl) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    fabric.Image.fromURL(imageUrl, (img) => {
      const id = uuidv4();
      img.set({
        left: 50,
        top: 50,
        id: id,
        type: 'diagram'
      });
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.renderAll();

      // Send the diagram to other users
      const workspaceId = window.location.pathname.split('/')[2];
      if (workspaceId && socket) {
        socket.emit('whiteboard-update', {
          workspaceId,
          elements: [{
            id: id,
            type: 'diagram',
            src: imageUrl,
            left: 50,
            top: 50,
            scaleX: img.scaleX,
            scaleY: img.scaleY,
            angle: img.angle
          }]
        });
      }
    });
  }, [socket]);

  return (
    <div className="whiteboard-container" style={{ width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} />
    </div>
  );
});

export default Whiteboard;
