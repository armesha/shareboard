import { useState, useCallback, useEffect } from 'react';
import { TOOLS, INTERACTIVE_TYPES, CANVAS, DEFAULT_COLORS } from '../constants';

export function useWhiteboardTools(canvasRef, isLoading, isConnected, canWrite) {
  const [tool, setTool] = useState(TOOLS.SELECT);
  const [selectedShape, setSelectedShape] = useState(null);
  const [color, setColor] = useState(DEFAULT_COLORS.BLACK);
  const [width, setWidth] = useState(CANVAS.DEFAULT_BRUSH_WIDTH);
  const [fontSize, setFontSize] = useState(CANVAS.DEFAULT_FONT_SIZE);

  const handleColorChange = useCallback((newColor, setCanvasDrawingMode) => {
    setColor(newColor);

    const canvas = canvasRef.current;
    if (canvas && canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.color = newColor;
    }

    if (setCanvasDrawingMode) {
      const hasWriteAccess = canWrite();
      setCanvasDrawingMode(tool === TOOLS.PEN && hasWriteAccess, newColor, width);
    }
  }, [tool, canvasRef, canWrite, width]);

  const handleWidthChange = useCallback((newWidth) => {
    setWidth(newWidth);

    const canvas = canvasRef.current;
    if (canvas && canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.width = newWidth;
    }
  }, [canvasRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const hasWriteAccess = canWrite();
    const shouldBeDrawingMode = tool === TOOLS.PEN && hasWriteAccess;

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

    const userCanDraw = !isLoading && isConnected && hasWriteAccess;
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
  }, [tool, isLoading, isConnected, canWrite, canvasRef, color, width]);

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
      const hasWriteAccess = canWrite();
      canvas.isDrawingMode = hasWriteAccess;

      if (!hasWriteAccess) {
        setTool(TOOLS.SELECT);
      }
    }
  }, [canWrite, tool, canvasRef]);

  return {
    tool,
    selectedShape,
    color,
    width,
    fontSize,
    setTool,
    setSelectedShape,
    setColor: handleColorChange,
    setWidth: handleWidthChange,
    setFontSize
  };
}
