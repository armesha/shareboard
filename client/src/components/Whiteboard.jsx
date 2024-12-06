import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { fabric } from 'fabric';
import { useWhiteboard } from '../context/WhiteboardContext';
import { v4 as uuidv4 } from 'uuid';

const Whiteboard = forwardRef(({ color, width }, ref) => {
  const canvasRef = useRef(null);
  const fabricRef = useRef(null);
  const { elements, addElement } = useWhiteboard();

  // Expose the canvas reference to parent component
  useImperativeHandle(ref, () => ({
    clearCanvas: () => {
      if (fabricRef.current) {
        const canvas = fabricRef.current;
        const drawnObjects = canvas.getObjects().filter(obj => obj.type === 'path');
        drawnObjects.forEach(obj => canvas.remove(obj));
        canvas.requestRenderAll();
      }
    }
  }));

  useEffect(() => {
    // Initialize Fabric.js canvas
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

    // Handle window resize
    const handleResize = () => {
      canvas.setDimensions({
        width: window.innerWidth * 0.8,
        height: window.innerHeight * 0.8,
      });
    };
    window.addEventListener('resize', handleResize);

    // Handle path creation
    const handlePathCreated = (e) => {
      const path = e.path;
      path.id = uuidv4();
      addElement({
        id: path.id,
        type: 'path',
        data: path.toObject()
      });
    };

    canvas.on('path:created', handlePathCreated);

    return () => {
      canvas.dispose();
      window.removeEventListener('resize', handleResize);
      canvas.off('path:created', handlePathCreated);
    };
  }, []);

  // Update brush when color or width changes
  useEffect(() => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    canvas.freeDrawingBrush.color = color;
    canvas.freeDrawingBrush.width = width;
  }, [color, width]);

  // Update canvas when elements change
  useEffect(() => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    
    // Store the current elements for comparison
    const currentElements = canvas.getObjects().map(obj => obj.id);
    
    // Only update if there are new elements
    const hasNewElements = elements.some(el => !currentElements.includes(el.id));
    
    if (hasNewElements) {
      elements.forEach(element => {
        if (!currentElements.includes(element.id)) {
          fabric.util.enlivenObjects([element.data], function(objects) {
            objects[0].id = element.id;
            canvas.add(objects[0]);
            canvas.requestRenderAll();
          });
        }
      });
    }
  }, [elements]);

  return (
    <div className="relative w-full h-full flex justify-center items-center bg-gray-50">
      <canvas ref={canvasRef} className="border border-gray-300 rounded-lg shadow-lg" />
    </div>
  );
});

export default Whiteboard;
