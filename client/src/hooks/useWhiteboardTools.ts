import { useState, useCallback, useEffect, type MutableRefObject } from 'react';
import { type Canvas, type FabricObject, type PencilBrush } from 'fabric';
import { TOOLS, INTERACTIVE_TYPES, CANVAS, DEFAULT_COLORS, type Tool, type Shape } from '../constants';

interface SetCanvasDrawingMode {
  (isDrawing: boolean, color: string, width: number): void;
}

interface UseWhiteboardToolsReturn {
  tool: Tool;
  selectedShape: Shape | null;
  color: string;
  width: number;
  fontSize: number;
  setTool: React.Dispatch<React.SetStateAction<Tool>>;
  setSelectedShape: React.Dispatch<React.SetStateAction<Shape | null>>;
  setColor: (newColor: string, setCanvasDrawingMode?: SetCanvasDrawingMode) => void;
  setWidth: (newWidth: number) => void;
  setFontSize: React.Dispatch<React.SetStateAction<number>>;
}

type CanvasWithDrawingMode = Canvas & {
  isDrawingMode: boolean;
  freeDrawingBrush: PencilBrush | null;
  selection: boolean;
  skipTargetFind: boolean;
};

export function useWhiteboardTools(
  canvasRef: MutableRefObject<Canvas | null>,
  isLoading: boolean,
  isConnected: boolean,
  canWrite: () => boolean
): UseWhiteboardToolsReturn {
  const [tool, setTool] = useState<Tool>(TOOLS.SELECT);
  const [selectedShape, setSelectedShape] = useState<Shape | null>(null);
  const [color, setColorState] = useState<string>(DEFAULT_COLORS.BLACK);
  const [width, setWidthState] = useState<number>(CANVAS.DEFAULT_BRUSH_WIDTH);
  const [fontSize, setFontSize] = useState<number>(CANVAS.DEFAULT_FONT_SIZE);

  const handleColorChange = useCallback((newColor: string, setCanvasDrawingMode?: SetCanvasDrawingMode) => {
    setColorState(newColor);

    const canvas = canvasRef.current as CanvasWithDrawingMode | null;
    if (canvas && canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.color = newColor;
    }

    if (setCanvasDrawingMode) {
      const hasWriteAccess = canWrite();
      setCanvasDrawingMode(tool === TOOLS.PEN && hasWriteAccess, newColor, width);
    }
  }, [tool, canvasRef, canWrite, width]);

  const handleWidthChange = useCallback((newWidth: number) => {
    setWidthState(newWidth);

    const canvas = canvasRef.current as CanvasWithDrawingMode | null;
    if (canvas && canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.width = newWidth;
    }
  }, [canvasRef]);

  useEffect(() => {
    const canvas = canvasRef.current as CanvasWithDrawingMode | null;
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

    canvas.getObjects().forEach((obj: FabricObject) => {
      const objType = (obj as unknown as { type: string }).type;
      const isInteractive = (INTERACTIVE_TYPES as readonly string[]).includes(objType);
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
    const canvas = canvasRef.current as CanvasWithDrawingMode | null;
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
