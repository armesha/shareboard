import { useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import { fabric } from 'fabric';
import { useWhiteboard } from '../context/WhiteboardContext';
import { v4 as uuidv4 } from 'uuid';

const Whiteboard = forwardRef(({ color, width }, ref) => {
  const canvasRef = useRef(null);
  const fabricRef = useRef(null);
  const isDrawing = useRef(false);
  const { elements, addElement, updateElement, socket } = useWhiteboard();

  // Expose the canvas reference to parent component
  useImperativeHandle(ref, () => ({
    clearCanvas: () => {
      if (fabricRef.current) {
        const canvas = fabricRef.current;
        canvas.getObjects().forEach(obj => canvas.remove(obj));
        canvas.requestRenderAll();
      }
    }
  }));

  const initializeCanvas = useCallback(() => {
    fabricRef.current = new fabric.Canvas(canvasRef.current, {
      isDrawingMode: true,
      width: window.innerWidth * 0.8,
      height: window.innerHeight * 0.8,
      backgroundColor: '#ffffff'
    });

    const canvas = fabricRef.current;
    
    // Initialize brush
    canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
    canvas.freeDrawingBrush.color = color;
    canvas.freeDrawingBrush.width = width;

    // Handle mouse events for real-time drawing
    canvas.on('mouse:down', () => {
      isDrawing.current = true;
    });

    canvas.on('mouse:up', () => {
      isDrawing.current = false;
    });

    canvas.on('mouse:move', (event) => {
      if (isDrawing.current && event.e) {
        const pointer = canvas.getPointer(event.e);
        socket?.emit('drawing', {
          x: pointer.x,
          y: pointer.y,
          color: canvas.freeDrawingBrush.color,
          width: canvas.freeDrawingBrush.width
        });
      }
    });

    // Handle path creation
    canvas.on('path:created', (e) => {
      const path = e.path;
      path.id = uuidv4();
      
      // Convert path to a simpler format for transmission
      const pathData = {
        id: path.id,
        type: 'path',
        data: {
          path: path.path,
          stroke: path.stroke,
          strokeWidth: path.strokeWidth,
          strokeLineCap: path.strokeLineCap,
          strokeLineJoin: path.strokeLineJoin,
          fill: null, // Explicitly set fill to null
          backgroundColor: null // Ensure no background color
        }
      };
      
      addElement(pathData);
    });

    return canvas;
  }, [color, width, addElement, socket]);

  // Initialize canvas
  useEffect(() => {
    const canvas = initializeCanvas();
    
    // Handle window resize
    const handleResize = () => {
      canvas.setDimensions({
        width: window.innerWidth * 0.8,
        height: window.innerHeight * 0.8,
      });
    };
    window.addEventListener('resize', handleResize);

    return () => {
      canvas.dispose();
      window.removeEventListener('resize', handleResize);
    };
  }, [initializeCanvas]);

  // Update brush when color or width changes
  useEffect(() => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    canvas.freeDrawingBrush.color = color;
    canvas.freeDrawingBrush.width = width;
  }, [color, width]);

  // Handle real-time drawing updates from other users
  useEffect(() => {
    if (!socket || !fabricRef.current) return;

    const handleDrawing = (data) => {
      const canvas = fabricRef.current;
      if (!canvas || !canvas.freeDrawingBrush) return;

      // Create a new path if needed
      if (!isDrawing.current) {
        canvas.freeDrawingBrush.onMouseDown({ x: data.x, y: data.y });
        isDrawing.current = true;
      }

      // Add point to the path
      canvas.freeDrawingBrush.onMouseMove({ x: data.x, y: data.y });
      canvas.requestRenderAll();
    };

    const handleDrawingEnd = () => {
      if (!isDrawing.current) return;
      
      const canvas = fabricRef.current;
      canvas.freeDrawingBrush.onMouseUp();
      isDrawing.current = false;
    };

    socket.on('drawing', handleDrawing);
    socket.on('drawing-end', handleDrawingEnd);

    return () => {
      socket.off('drawing', handleDrawing);
      socket.off('drawing-end', handleDrawingEnd);
    };
  }, [socket]);

  // Sync canvas with elements state
  useEffect(() => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    
    // Remove elements that no longer exist in state
    const currentIds = elements.map(el => el.id);
    canvas.getObjects().forEach(obj => {
      if (!currentIds.includes(obj.id)) {
        canvas.remove(obj);
      }
    });
    
    // Add or update elements from state
    elements.forEach(element => {
      if (element.type === 'path') {
        const existingObject = canvas.getObjects().find(obj => obj.id === element.id);
        
        if (!existingObject) {
          // Create new path with explicit fill settings
          const path = new fabric.Path(element.data.path, {
            ...element.data,
            id: element.id,
            fill: null,
            backgroundColor: null,
            selectable: false,
            evented: false
          });
          canvas.add(path);
        }
      }
    });
    
    canvas.requestRenderAll();
  }, [elements]);

  return (
    <div className="relative w-full h-full flex justify-center items-center bg-gray-50">
      <canvas ref={canvasRef} className="border border-gray-300 rounded-lg shadow-lg" />
    </div>
  );
});

export default Whiteboard;
