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
    WHITEBOARD_BG_COLOR,
    selectedShape,
    initCanvas,
    canvasRef: fabricCanvasRef,
    addElement,
    updateElement,
    setTool, 
    setColor, 
    setWidth 
  } = useWhiteboard();

  useEffect(() => {
    if (!canvasRef.current) return;
    const cleanup = initCanvas(canvasRef.current);
    return cleanup;
  }, [initCanvas]);

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    
    // Unified drawing mode handling
    const isDrawingTool = ['pen', 'eraser'].includes(tool);
    canvas.isDrawingMode = isDrawingTool;
    canvas.selection = tool === 'select';

    // Brush configuration
    if (canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.color = tool === 'eraser' 
        ? WHITEBOARD_BG_COLOR 
        : color;
      canvas.freeDrawingBrush.width = width;
      
      // Force brush update
      const currentBrush = canvas.freeDrawingBrush;
      canvas.freeDrawingBrush = currentBrush;
    }

    // Object interaction setup
    canvas.getObjects().forEach(obj => {
      const isInteractive = obj.type === 'image' || obj.type === 'text' || obj.type === 'i-text';
      const isSelectable = tool === 'select' && isInteractive;
      obj.set({
        selectable: isSelectable,
        hasControls: isSelectable,
        hasBorders: isSelectable,
        evented: isInteractive,
        lockMovementX: !isSelectable,
        lockMovementY: !isSelectable
      });
    });

    canvas.renderAll();
  }, [tool, color, width, WHITEBOARD_BG_COLOR]);

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const handleObjectModification = (e) => {
      const obj = e.target;
      if (!obj || !obj.id) return;

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
      } else {
        updateElement(obj.id, {
          type: obj.type,
          data: obj.toObject(['id'])
        });
      }
    };

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
  }, [updateElement, fabricCanvasRef]);

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
              canvas.remove(obj);
              socket.emit('delete-element', { 
                workspaceId,
                elementId: obj.id 
              });
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

    return () => {
    };
  }, [socket, tool, color]);

  const handleMouseDown = useCallback((e) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || tool === 'select') return;

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
      
      shape.set({
        selectable: false,
        hasControls: false,
        hasBorders: false,
        evented: false,
        lockMovementX: true,
        lockMovementY: true,
        hoverCursor: 'default',
        perPixelTargetFind: false,
        targetFindTolerance: 0,
        selection: false,
        selectionBackgroundColor: 'transparent',
        transparentCorners: true,
        padding: 0,
        borderColor: 'transparent',
        cornerColor: 'transparent',
        cornerSize: 0,
        borderOpacityWhenMoving: 0
      });

      addElement({
        id: shape.id,
        type: shape.type,
        data: {
          ...shape.toObject(['id']),
          selectable: false,
          hasControls: false,
          hasBorders: false,
          evented: false,
          lockMovementX: true,
          lockMovementY: true,
          perPixelTargetFind: false,
          targetFindTolerance: 0,
          selection: false,
          selectionBackgroundColor: 'transparent',
          transparentCorners: true,
          padding: 0,
          borderColor: 'transparent',
          cornerColor: 'transparent',
          cornerSize: 0,
          borderOpacityWhenMoving: 0
        }
      });

      currentShape.current = null;
    }

    startPoint.current = null;
    canvas.renderAll();
  }, [addElement, fabricCanvasRef]);

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const handlePathCreated = (e) => {
      const path = e.path;
      if (!path) return;

      path.id = uuidv4();
      path.selectable = false;
      path.hasControls = false;
      path.hasBorders = false;
      path.evented = false;
      path.lockMovementX = true;
      path.lockMovementY = true;

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

  return (
    <div className="whiteboard-container" style={{ width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} />
    </div>
  );
});

export default Whiteboard;
