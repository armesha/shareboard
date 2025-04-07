import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useWhiteboard } from '../context/WhiteboardContext';
import { useSocket } from '../context/SocketContext';
import { v4 as uuidv4 } from 'uuid';
import TextInputModal from './TextInputModal';

const Whiteboard = React.memo(({ disabled = false }) => {
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const currentShape = useRef(null);
  const startPoint = useRef(null);
  const clickPosition = useRef(null);
  const { socket, connectionStatus, connectionError } = useSocket();
  const { 
    tool, 
    color, 
    width,
    WHITEBOARD_BG_COLOR,
    selectedShape,
    initCanvas,
    canvasRef: fabricCanvasRef,
    addElement,
    updateElement,
    setTool, 
    setColor, 
    setWidth,
    elements // Added elements to the destructured context
  } = useWhiteboard();
  const [isTextModalOpen, setIsTextModalOpen] = useState(false);
  const [editingText, setEditingText] = useState(null);
  const isUpdatingRef = useRef(false);

  // Add ref to track previous tool
  const previousToolRef = useRef(tool);
  const previousColorRef = useRef(color);
  const previousWidthRef = useRef(width);

  // Single canvas initialization
  useEffect(() => {
    if (!canvasRef.current) return;

    // Create canvas only once during mount
    const cleanup = initCanvas(canvasRef.current);
    return cleanup;
  }, []); // Empty dependency array - only run once on mount

  // Tool switching effect
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    let needRerender = false;
    canvas.suspendDrawing = true;

    try {
      const shouldBeDrawing = tool === 'pen';
      // В режиме 'select' объекты должны быть выделяемыми, НО не в режиме disabled
      const shouldBeSelection = tool === 'select' && !disabled;
      const isShapesMode = tool === 'shapes';
      const isTextMode = tool === 'text';

      // Update drawing mode
      if (canvas.isDrawingMode !== shouldBeDrawing) {
        canvas.isDrawingMode = shouldBeDrawing;
        needRerender = true;
      }

      // Update selection mode - только в режиме select и не disabled разрешаем выделение
      if (canvas.selection !== shouldBeSelection) {
        canvas.selection = shouldBeSelection;
        needRerender = true;
      }

      // Update brush properties if in drawing mode
      if (shouldBeDrawing && canvas.freeDrawingBrush) {
        if (canvas.freeDrawingBrush.color !== color) {
          canvas.freeDrawingBrush.color = color;
          needRerender = true;
        }
        if (canvas.freeDrawingBrush.width !== width) {
          canvas.freeDrawingBrush.width = width;
          needRerender = true;
        }
        canvas.freeDrawingBrush.strokeLineCap = 'round';
        canvas.freeDrawingBrush.strokeLineJoin = 'round';
      }

      // Update object properties
      canvas.getObjects().forEach(obj => {
        const isInteractiveTypes = ['image', 'text', 'i-text', 'rect', 'circle', 'triangle', 'path'];
        const isInteractive = isInteractiveTypes.includes(obj.type);
        // В режиме 'select' объекты должны быть выделяемыми, НО не в режиме disabled
        const shouldBeSelectable = shouldBeSelection && isInteractive && !disabled;
        // В режиме text разрешаем взаимодействие только с текстовыми объектами, НО не в режиме disabled
        const shouldBeEvented = (shouldBeSelection || (isTextMode && (obj.type === 'text' || obj.type === 'i-text'))) && !disabled;

        const currentProps = {
          selectable: obj.selectable,
          evented: obj.evented,
          hasControls: obj.hasControls,
          hasBorders: obj.hasBorders,
          lockMovementX: obj.lockMovementX,
          lockMovementY: obj.lockMovementY,
          lockRotation: obj.lockRotation,
          lockScalingX: obj.lockScalingX,
          lockScalingY: obj.lockScalingY
        };

        const newProps = {
          selectable: shouldBeSelectable,
          evented: shouldBeEvented,
          hasControls: shouldBeSelectable,
          hasBorders: shouldBeSelectable,
          lockMovementX: !shouldBeSelectable,
          lockMovementY: !shouldBeSelectable,
          lockRotation: !shouldBeSelectable,
          lockScalingX: !shouldBeSelectable,
          lockScalingY: !shouldBeSelectable
        };

        // Only update if properties actually changed
        if (JSON.stringify(currentProps) !== JSON.stringify(newProps)) {
          obj.set(newProps);
          needRerender = true;
        }
      });
    } finally {
      canvas.suspendDrawing = false;
      if (needRerender) {
        canvas.requestRenderAll();
      }
    }
  }, [tool, color, width, elements, disabled]);

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const handleObjectModification = (e) => {
      // Если в режиме только для чтения, отменяем модификацию
      if (disabled) {
        // Отменяем все изменения
        if (e.target && e.target.originalState) {
          e.target.set(e.target.originalState);
          canvas.renderAll();
        }
        return;
      }
    
      const obj = e.target;
      if (!obj || !obj.id || isUpdatingRef.current) return;

      // Use a single timeout for all modification events
      if (obj.modificationTimeout) {
        clearTimeout(obj.modificationTimeout);
      }

      obj.modificationTimeout = setTimeout(() => {
        canvas.suspendDrawing = true;
        
        try {
          if (obj.type === 'image' && obj.data?.isDiagram) {
            updateElement(obj.id, {
              type: 'diagram',
              data: {
                ...obj.data,
                src: obj.data.src,
                left: obj.left,
                top: obj.top,
                scaleX: obj.scaleX,
                scaleY: obj.scaleY,
                angle: obj.angle
              }
            });
          } else if (obj.type === 'text' || obj.type === 'i-text') {
            const data = {
              text: obj.text,
              left: obj.left,
              top: obj.top,
              fontSize: obj.fontSize,
              fill: obj.fill,
              angle: obj.angle,
              scaleX: obj.scaleX,
              scaleY: obj.scaleY,
              selectable: true,
              hasControls: true,
              hasBorders: true
            };

            // For text objects, we want to both update and potentially add new elements
            updateElement(obj.id, { type: 'text', data });
            if (e.transform?.action === 'drag' || e.transform?.action === 'scale') {
              addElement({ id: obj.id, type: 'text', data });
            }
          } else {
            // Сохраняем все данные объекта, включая масштаб
            const data = {
              ...obj.toObject(['left', 'top', 'scaleX', 'scaleY', 'angle']),
              stroke: obj.stroke,
              strokeWidth: obj.strokeWidth,
              fill: obj.fill
            };

            updateElement(obj.id, {
              type: obj.type,
              data: data
            });
          }
        } finally {
          canvas.suspendDrawing = false;
          canvas.requestRenderAll();
        }
      }, 50); // 50ms debounce for all modifications
    };

    // Single handler for all modification events
    canvas.on('object:modified', handleObjectModification);
    canvas.on('object:moving', handleObjectModification);
    canvas.on('object:scaling', handleObjectModification);
    canvas.on('object:rotating', handleObjectModification);

    return () => {
      canvas.off('object:modified', handleObjectModification);
      canvas.off('object:moving', handleObjectModification);
      canvas.off('object:scaling', handleObjectModification);
      canvas.off('object:rotating', handleObjectModification);
    };
  }, [updateElement, addElement, disabled]);

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const handleObjectMoving = (e) => {
      // Если в режиме чтения или не в режиме select, отменяем перемещение объекта
      if (disabled || tool !== 'select') {
        if (e.target.originalState) {
          e.target.set({
            left: e.target.originalState.left,
            top: e.target.originalState.top
          });
          canvas.renderAll();
        }
        return;
      }

      const obj = e.target;
      const boundingRect = canvas.calcViewportBoundaries();
      const objBoundingRect = obj.getBoundingRect();
      
      // Ограничиваем перемещение объекта в пределах холста
      if (objBoundingRect.left < boundingRect.tl.x) {
        obj.left = boundingRect.tl.x;
      }
      if (objBoundingRect.top < boundingRect.tl.y) {
        obj.top = boundingRect.tl.y;
      }
      if (objBoundingRect.left + objBoundingRect.width > boundingRect.br.x) {
        obj.left = boundingRect.br.x - objBoundingRect.width;
      }
      if (objBoundingRect.top + objBoundingRect.height > boundingRect.br.y) {
        obj.top = boundingRect.br.y - objBoundingRect.height;
      }
    };

    const handleMouseDown = (e) => {
      if (disabled) {
        // В режиме чтения отменяем все событие
        canvas.selection = false;
        if (e.target) {
          e.target.selectable = false;
          e.target.evented = false;
        }
        return;
      }
      
      if (e.target) {
        e.target.originalState = {
          left: e.target.left,
          top: e.target.top
        };
      }
    };

    canvas.on('object:moving', handleObjectMoving);
    canvas.on('mouse:down', handleMouseDown);

    return () => {
      canvas.off('object:moving', handleObjectMoving);
      canvas.off('mouse:down', handleMouseDown);
    };
  }, [tool, fabricCanvasRef, disabled]);

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const handleKeyDown = (e) => {
      if (disabled) return;
      
      if (e.key === 'Delete' && tool === 'select') {
        const activeObjects = canvas.getActiveObjects();
        if (activeObjects.length > 0) {
          const workspaceId = window.location.pathname.split('/')[2];
          
          activeObjects.forEach(obj => {
            if (obj.id) {
              canvas.remove(obj);
              if (socket) {
                socket.emit('delete-element', { 
                  workspaceId,
                  elementId: obj.id 
                });
              }
            }
          });

          canvas.discardActiveObject();
          canvas.renderAll();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [fabricCanvasRef, tool, socket, disabled]);

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const handleScaling = (e) => {
      const object = e.target;
      if (object.strokeWidth) {
        // Только обновляем координаты во время масштабирования
        object.setCoords();
      }
    };

    canvas.on('object:scaling', handleScaling);
    canvas.on('object:modified', (e) => {
      const object = e.target;
      if (object.strokeWidth) {
        // При модификации объекта не изменяем толщину линии
        // Это позволит сохранять одну и ту же толщину линии независимо от масштаба
        object.setCoords();
        canvas.requestRenderAll();
      }
    });

    return () => {
      canvas.off('object:scaling', handleScaling);
      canvas.off('object:modified');
    };
  }, [fabricCanvasRef]);

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const handleDblClick = (opt) => {
      if (disabled) return;
      
      if (tool !== 'select') return;

      const pointer = canvas.getPointer(opt.e);
      const objects = canvas.getObjects();
      
      for (let i = objects.length - 1; i >= 0; i--) {
        const obj = objects[i];
        if (obj.type === 'text' && obj.containsPoint(pointer)) {
          console.log('Found text object:', obj);
          const currentText = obj.text || '';
          console.log('Current text:', currentText);
          setEditingText({
            id: obj.id,
            text: currentText,
            left: obj.left,
            top: obj.top,
            fontSize: obj.fontSize,
            fill: obj.fill,
            angle: obj.angle,
            scaleX: obj.scaleX,
            scaleY: obj.scaleY
          });
          setIsTextModalOpen(true);
          break;
        }
      }
    };

    canvas.on('mouse:dblclick', handleDblClick);

    return () => {
      canvas.off('mouse:dblclick', handleDblClick);
    };
  }, [tool, disabled]);

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const handleObjectMoving = (e) => {
      // Если в режиме чтения, отменяем перемещение
      if (disabled) {
        if (e.target && e.target.originalState) {
          e.target.set({
            left: e.target.originalState.left,
            top: e.target.originalState.top
          });
          canvas.renderAll();
        }
        return;
      }
      
      const obj = e.target;
      if (!obj || !obj.id) return;

      if (obj.movementTimeout) {
        clearTimeout(obj.movementTimeout);
      }
      
      obj.movementTimeout = setTimeout(() => {
        const data = {
          ...obj.toObject(['left', 'top', 'scaleX', 'scaleY', 'angle']),
          text: obj.text || '',
          fontSize: obj.fontSize,
          fill: obj.fill,
          selectable: true,
          hasControls: true,
          hasBorders: true
        };

        addElement({
          id: obj.id,
          type: obj.type || 'text',
          data: data
        });
      }, 50); // 50ms debounce
    };

    canvas.on('object:moving', handleObjectMoving);

    return () => {
      canvas.off('object:moving', handleObjectMoving);
    };
  }, [addElement]);

  // Add a useEffect to respond to permission changes
  useEffect(() => {
    // If permissions change and we're now disabled, reset to select tool
    if (disabled && tool !== 'select') {
      setTool('select');
      
      // If we have an active canvas, deselect all objects
      const canvas = fabricCanvasRef.current;
      if (canvas) {
        canvas.discardActiveObject();
        canvas.requestRenderAll();
      }
      
      console.log('Tools disabled due to permission change, switched to select tool');
    }
  }, [disabled, setTool, tool]);

  const handleMouseDown = useCallback((e) => {
    // Return early if disabled 
    if (disabled) return;
    
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    if (e.e.button !== 0) return;

    // В режиме text, если нажали на текстовый объект, позволяем его редактировать
    if (tool === 'text' && e.target && (e.target.type === 'text' || e.target.type === 'i-text')) {
      // Разрешаем редактирование текста
      return;
    }

    // В режиме shapes игнорируем клики по существующим объектам
    if (tool === 'shapes' && selectedShape && e.target) {
      // Если нажали на объект, игнорируем это событие
      return;
    }

    if (tool === 'text' && !e.target) {
      const pointer = canvas.getPointer(e.e);
      clickPosition.current = pointer;
      setIsTextModalOpen(true);
      return;
    }

    isDrawing.current = true;
    const pointer = canvas.getPointer(e.e);
    startPoint.current = pointer;

    if (selectedShape) {
      let shapeObj;
      const commonProps = {
        left: pointer.x,
        top: pointer.y,
        fill: 'transparent',
        stroke: color,
        strokeWidth: width,
        selectable: false, // Фигура не выделяемая в режиме рисования
        evented: false,    // Фигура не реагирует на события мыши в режиме рисования
        hasControls: false,
        hasBorders: false,
        lockMovementX: true,
        lockMovementY: true,
        id: uuidv4(),
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
  }, [tool, selectedShape, color, width, fabricCanvasRef, disabled]);

  const handleMouseMove = useCallback((e) => {
    if (disabled) return;
    
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
            const size = Math.abs(width) > Math.abs(height) ? Math.abs(width) : Math.abs(height);
            shape.set({
              width: size,
              height: size,
              left: width > 0 ? startX : startX - size,
              top: height > 0 ? startY : startY - size
            });
          } else {
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
          const isUpsideDown = height < 0;
          if (isCtrlPressed) {
            const size = Math.abs(width) > Math.abs(height) ? Math.abs(width) : Math.abs(height);
            shape.set({
              width: size,
              height: isUpsideDown ? -size : size,
              left: startX - (size / 2),
              top: startY,
              originY: 'top'
            });
          } else {
            shape.set({
              width: Math.abs(width),
              height: isUpsideDown ? -Math.abs(height) : Math.abs(height),
              left: startX - (Math.abs(width) / 2),
              top: startY,
              originY: 'top'
            });
          }
          break;
      }

      shape.setCoords(); // Add setCoords() after updating shape properties
      canvas.renderAll();
    }
  }, [selectedShape, fabricCanvasRef, disabled]);

  const handleMouseUp = useCallback(() => {
    if (disabled) return;
    
    const canvas = fabricCanvasRef.current;
    if (!canvas || !isDrawing.current) return;

    isDrawing.current = false;
    
    if (currentShape.current) {
      const shape = currentShape.current;
      shape.setCoords(); // Add setCoords() before adding the element
      
      // После завершения рисования фигуры, добавляем её в элементы
      addElement({
        id: shape.id,
        type: shape.type,
        data: {
          ...shape.toObject(['id'])
        }
      });
      
      // Убираем автоматическое переключение в режим select
      // setTool('select');
      
      // Очищаем текущую фигуру
      currentShape.current = null;
    }

    startPoint.current = null;
    canvas.renderAll();
  }, [addElement, disabled]);

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

  useEffect(() => {
    const handleResize = () => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      const container = canvas.wrapperEl.parentElement;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      canvas.setDimensions({
        width: rect.width,
        height: rect.height
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
      
      const elementData = obj.type === 'image' && obj.data?.isDiagram ? {
        id: obj.id,
        type: 'diagram',
        data: {
          ...obj.data,
          left: obj.left,
          top: obj.top,
          scaleX: obj.scaleX,
          scaleY: obj.scaleY,
          angle: obj.angle
        }
      } : {
        id: obj.id,
        type: obj.type,
        data: obj.toObject(['id'])
      };

      socket.emit('whiteboard-update', {
        workspaceId,
        elements: [elementData]
      });
    };

    canvas.on('object:moving', handleObjectMoving);

    return () => {
      canvas.off('object:moving', handleObjectMoving);
    };
  }, [socket]);

  const handleAddImage = useCallback((imageUrl) => {
    const id = uuidv4();
    const element = {
      id,
      type: 'diagram',
      data: {
        src: imageUrl,
        left: 50,
        top: 50,
        scaleX: 1,
        scaleY: 1,
        angle: 0
      }
    };
    addElement(element);
  }, [addElement]);

  const handleTextSubmit = (text) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    if (editingText) {
      const obj = canvas.getObjects().find(o => o.id === editingText.id);
      if (obj) {
        obj.set('text', text);
        canvas.renderAll();
        
        addElement({
          id: editingText.id,
          type: 'text',
          data: {
            ...editingText,
            text: text
          }
        });
      }
      setEditingText(null);
    } else {
      const textId = uuidv4();
      const textObj = new fabric.Text(text, {
        left: clickPosition.current.x,
        top: clickPosition.current.y,
        fontSize: 20,
        fill: color,
        id: textId,
        selectable: true,
        hasControls: true,
        hasBorders: true
      });
      
      canvas.add(textObj);
      canvas.setActiveObject(textObj);
      canvas.renderAll();

      addElement({
        id: textId,
        type: 'text',
        data: {
          text: text,
          left: clickPosition.current.x,
          top: clickPosition.current.y,
          fontSize: 20,
          fill: color,
          selectable: true,
          hasControls: true,
          hasBorders: true
        }
      });
    }

    setIsTextModalOpen(false);
    clickPosition.current = null;
    setTool('select');
  };

  return (
    <>
      <div className={`relative ${disabled ? 'cursor-not-allowed' : ''}`}>
        <canvas 
          ref={canvasRef} 
          style={{ 
            pointerEvents: disabled ? 'none' : 'auto', 
            userSelect: disabled ? 'none' : 'auto'
          }} 
        />
        {disabled && (
          <>
            <div 
              className="absolute inset-0 bg-transparent z-10" 
              title="Read-only mode"
            />
            <div className="absolute bottom-4 right-4 z-20 bg-yellow-50 text-yellow-700 px-3 py-2 rounded-md shadow-md border border-yellow-200 flex items-center opacity-70">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              View Only Mode
            </div>
          </>
        )}
      </div>
      <TextInputModal
        isOpen={isTextModalOpen}
        onClose={() => {
          setIsTextModalOpen(false);
          clickPosition.current = null;
          setEditingText(null);
        }}
        onSubmit={disabled ? null : handleTextSubmit}
        initialText={editingText ? editingText.text : ''}
        disabled={disabled}
      />
    </>
  );
});

export default Whiteboard;
