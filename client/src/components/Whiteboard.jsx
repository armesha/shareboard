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
    addElement
  } = useWhiteboard();

  const ARROW_HEAD_SIZE = 10;
  const ARROW_HEAD_ANGLE = Math.PI / 7;

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current) return;
    const cleanup = initCanvas(canvasRef.current);
    return cleanup;
  }, [initCanvas]);

  // Update canvas properties when tool/color/width changes
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    canvas.isDrawingMode = tool === 'pen';
    canvas.selection = tool === 'select';
    canvas.freeDrawingBrush.color = color;
    canvas.freeDrawingBrush.width = width;

    // Update selectability of all objects
    canvas.getObjects().forEach(obj => {
      obj.set({
        selectable: tool === 'select',
        hasControls: tool === 'select',
        hasBorders: tool === 'select'
      });
    });

    canvas.renderAll();
  }, [tool, color, width, fabricCanvasRef]);

  const handleMouseDown = useCallback((e) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || tool === 'select' || e.button !== 1) return;

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
        selectable: false,
        evented: false
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
        case 'arrow':
          shapeObj = new fabric.Path('M 0 0', {
            ...commonProps,
            fill: undefined
          });
          break;
      }

      if (shapeObj) {
        shapeObj.id = uuidv4();
        canvas.add(shapeObj);
        currentShape.current = shapeObj;
      }
    }
  }, [tool, selectedShape, color, width, fabricCanvasRef]);

  const handleMouseMove = useCallback((e) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !isDrawing.current || !startPoint.current) return;

    const pointer = canvas.getPointer(e.e);

    if (selectedShape && currentShape.current) {
      const shape = currentShape.current;
      const startX = startPoint.current.x;
      const startY = startPoint.current.y;
      const width = pointer.x - startX;
      const height = pointer.y - startY;

      switch (selectedShape) {
        case 'rectangle':
          shape.set({
            width: Math.abs(width),
            height: Math.abs(height),
            left: width > 0 ? startX : pointer.x,
            top: height > 0 ? startY : pointer.y
          });
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
        case 'arrow':
          const angle = Math.atan2(height, width);
          const headX = pointer.x - ARROW_HEAD_SIZE * Math.cos(angle);
          const headY = pointer.y - ARROW_HEAD_SIZE * Math.sin(angle);
          
          const path = [
            'M', startX, startY,
            'L', pointer.x, pointer.y,
            'M', headX, headY,
            'L', 
            headX - ARROW_HEAD_SIZE * Math.cos(angle - ARROW_HEAD_ANGLE),
            headY - ARROW_HEAD_SIZE * Math.sin(angle - ARROW_HEAD_ANGLE),
            'M', headX, headY,
            'L',
            headX - ARROW_HEAD_SIZE * Math.cos(angle + ARROW_HEAD_ANGLE),
            headY - ARROW_HEAD_SIZE * Math.sin(angle + ARROW_HEAD_ANGLE)
          ];
          
          shape.set({ path: path });
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
      addElement({
        id: shape.id,
        type: shape.type,
        data: shape.toObject(['id'])
      });
      currentShape.current = null;
    }
    startPoint.current = null;
  }, [addElement, fabricCanvasRef]);

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
    <div className="relative w-full h-full flex justify-center items-center bg-gray-50">
      <canvas ref={canvasRef} className="border border-gray-300 rounded-lg shadow-lg" />
    </div>
  );
});

export default Whiteboard;
