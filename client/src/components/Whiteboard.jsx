import { useEffect, useRef, forwardRef, useImperativeHandle, useCallback, useState } from 'react';
import { fabric } from 'fabric';
import { v4 as uuidv4 } from 'uuid';
import { useWhiteboard } from '../context/WhiteboardContext'; 

const Whiteboard = forwardRef(({ color, width, tool, selectedShape, setTool, setSelectedShape }, ref) => {
  const canvasRef = useRef(null);
  const fabricRef = useRef(null);
  const isDrawing = useRef(false);
  const currentShape = useRef(null);
  const startPoint = useRef(null);
  const [isCreatingShape, setIsCreatingShape] = useState(false);
  const { addElement, updateElement } = useWhiteboard();

  // Function to save canvas state
  const saveCanvasState = () => {
    if (!fabricRef.current) return;

    const canvas = fabricRef.current;
    const objects = canvas.getObjects();
    
    objects.forEach(obj => {
      if (!obj.id) {
        obj.id = uuidv4();
      }

      const elementData = {
        id: obj.id,
        type: obj.type === 'group' ? 'arrow' : obj.type,
        data: {
          ...obj.toObject(['id', 'selectable', 'evented']),
          left: obj.left,
          top: obj.top,
          scaleX: obj.scaleX,
          scaleY: obj.scaleY,
          angle: obj.angle,
          width: obj.width,
          height: obj.height,
          stroke: obj.stroke || color,
          strokeWidth: obj.strokeWidth || width,
          fill: obj.fill,
          selectable: true,
          evented: true
        }
      };

      // Используем addElement для новых объектов и updateElement для существующих
      if (!obj._saved) {
        addElement(elementData);
        obj._saved = true;
      } else {
        updateElement(obj.id, elementData);
      }
    });
  };

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    fabricRef.current = new fabric.Canvas(canvasRef.current, {
      isDrawingMode: tool === 'pen',
      width: window.innerWidth * 0.8,
      height: window.innerHeight * 0.8,
      backgroundColor: '#ffffff',
      selection: tool === 'select',
      renderOnAddRemove: true,
      stateful: true
    });

    const canvas = fabricRef.current;
    
    // Initialize brush
    canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
    canvas.freeDrawingBrush.color = color;
    canvas.freeDrawingBrush.width = width;

    // Unified mouse down handler
    canvas.on('mouse:down', (options) => {
      const pointer = canvas.getPointer(options.e);

      if (tool === 'shapes' && selectedShape) {
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
          evented: false
        };

        switch (selectedShape) {
          case 'rectangle':
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
            const arrowPath = `M ${pointer.x} ${pointer.y} L ${pointer.x} ${pointer.y}`;
            shape = new fabric.Path(arrowPath, {
              ...shapeProps,
              strokeLineCap: 'round',
              strokeLineJoin: 'round'
            });
            break;
        }

        if (shape) {
          shape.id = uuidv4(); // Добавляем id сразу при создании
          currentShape.current = shape;
          canvas.add(shape);
          canvas.renderAll();
        }
      } else if (tool === 'text') {
        const text = new fabric.IText('Click to edit', {
          left: pointer.x,
          top: pointer.y,
          fontSize: 20,
          fill: color,
          id: uuidv4()
        });
        
        canvas.add(text);
        canvas.setActiveObject(text);
        text.enterEditing();
        text.selectAll();
        canvas.requestRenderAll();
        
        setTool('select');
      }
    });

    // Mouse move handler for shape resizing
    canvas.on('mouse:move', (options) => {
      if (!isDrawing.current || !currentShape.current || tool !== 'shapes') return;

      const pointer = canvas.getPointer(options.e);
      
      if (startPoint.current) {
        const dx = Math.abs(pointer.x - startPoint.current.x);
        const dy = Math.abs(pointer.y - startPoint.current.y);
        const left = Math.min(pointer.x, startPoint.current.x);
        const top = Math.min(pointer.y, startPoint.current.y);

        if (selectedShape === 'rectangle' || selectedShape === 'triangle') {
          currentShape.current.set({
            width: dx,
            height: dy,
            left: left,
            top: top
          });
        } else if (selectedShape === 'circle') {
          const radius = Math.sqrt(dx * dx + dy * dy) / 2;
          const centerX = left + dx / 2;
          const centerY = top + dy / 2;
          currentShape.current.set({
            radius: radius,
            left: centerX - radius,
            top: centerY - radius
          });
        } else if (selectedShape === 'arrow') {
          const arrowPath = `M ${startPoint.current.x} ${startPoint.current.y} L ${pointer.x} ${pointer.y}`;
          
          // Вычисляем угол для наконечника стрелки
          const angle = Math.atan2(pointer.y - startPoint.current.y, pointer.x - startPoint.current.x);
          const arrowLength = 15;
          
          // Добавляем наконечник стрелки
          const x2 = pointer.x - arrowLength * Math.cos(angle - Math.PI / 6);
          const y2 = pointer.y - arrowLength * Math.sin(angle - Math.PI / 6);
          const x3 = pointer.x - arrowLength * Math.cos(angle + Math.PI / 6);
          const y3 = pointer.y - arrowLength * Math.sin(angle + Math.PI / 6);
          
          const finalPath = `${arrowPath} M ${x2} ${y2} L ${pointer.x} ${pointer.y} L ${x3} ${y3}`;
          
          currentShape.current.set({
            path: finalPath
          });
        }
        
        canvas.renderAll();
      }
    });

    // Mouse up handler
    canvas.on('mouse:up', () => {
      if (tool === 'shapes' && currentShape.current) {
        isDrawing.current = false;
        setIsCreatingShape(false);
        
        const shape = currentShape.current;
        shape.set({
          selectable: true,
          evented: true
        });

        // Создаем объект для сохранения
        const elementData = {
          id: shape.id,
          type: selectedShape,
          data: {
            ...shape.toObject(['id']),
            left: shape.left,
            top: shape.top,
            scaleX: shape.scaleX,
            scaleY: shape.scaleY,
            angle: shape.angle,
            width: shape.width,
            height: shape.height,
            stroke: shape.stroke || color,
            strokeWidth: shape.strokeWidth || width,
            fill: 'transparent',
            selectable: true,
            evented: true
          }
        };

        // Сохраняем фигуру
        addElement(elementData);
        
        // Очищаем ссылки
        currentShape.current = null;
        startPoint.current = null;
        
        // Обновляем canvas
        canvas.requestRenderAll();
      }
    });

    // Handle object modifications
    canvas.on('object:modified', () => {
      saveCanvasState();
    });

    // Handle path creation
    canvas.on('path:created', (e) => {
      const path = e.path;
      path.id = uuidv4();
      path.selectable = false;
      path.evented = false;
      saveCanvasState();
    });

    return () => {
      canvas.dispose();
    };
  }, [color, width, tool, selectedShape, setTool, setSelectedShape, addElement]);

  // Обновляем настройки кисти при изменении инструмента
  useEffect(() => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;

    // Устанавливаем режим рисования на основе выбранного инструмента
    canvas.isDrawingMode = tool === 'pen';

    if (tool === 'pen') {
      canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
      canvas.freeDrawingBrush.color = color;
      canvas.freeDrawingBrush.width = width;
    }

    // Обновляем режим выделения только для функции выделения
    canvas.selection = tool === 'select';
    
    // Объекты всегда должны быть видимыми, но selectable только в режиме select
    if (tool === 'select') {
      canvas.getObjects().forEach(obj => {
        obj.selectable = true;
        obj.evented = true;
      });
    } else {
      canvas.getObjects().forEach(obj => {
        obj.selectable = false;
        obj.evented = false;
      });
    }

    canvas.requestRenderAll();
  }, [color, width, tool]);

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

  return (
    <div className="relative w-full h-full flex justify-center items-center bg-gray-50">
      <canvas ref={canvasRef} className="border border-gray-300 rounded-lg shadow-lg" />
    </div>
  );
});

export default Whiteboard;
