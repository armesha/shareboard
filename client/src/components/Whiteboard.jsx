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
              // Отправляем событие удаления на сервер
              socket.emit('delete-element', { 
                workspaceId,
                elementId: obj.id 
              });
            }
          });

          // Очищаем выделение
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
        selectable: false,
        evented: false,
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
        selectable: tool === 'select',
        hasControls: tool === 'select',
        hasBorders: tool === 'select'
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
  }, [addElement, tool, fabricCanvasRef]);

  // Handle path creation when using pen tool
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const handlePathCreated = (e) => {
      const path = e.path;
      if (!path) return;

      path.id = uuidv4();
      path.selectable = tool === 'select';
      path.hasControls = tool === 'select';
      path.hasBorders = tool === 'select';

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
  }, [addElement, tool]);

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

  return (
    <div className="whiteboard-container" style={{ position: 'relative' }}>
      <div className="controls" style={{ 
        position: 'absolute', 
        top: '10px', 
        left: '10px', 
        display: 'flex', 
        alignItems: 'center',
        gap: '15px',
        background: 'white',
        padding: '10px',
        borderRadius: '8px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        zIndex: 1000
      }}>
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          title="Choose color"
          style={{ 
            width: '30px', 
            height: '30px',
            padding: '0',
            border: '2px solid #eee',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="range"
            min="1"
            max="20"
            value={width}
            onChange={(e) => setWidth(parseInt(e.target.value))}
            title="Stroke width"
            style={{ 
              width: '100px',
              accentColor: color 
            }}
          />
          <span style={{ fontSize: '12px' }}>{width}px</span>
        </div>
      </div>
      <canvas ref={canvasRef} />
    </div>
  );
});

export default Whiteboard;
