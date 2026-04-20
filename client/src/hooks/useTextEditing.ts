import { useCallback } from 'react';
import { IText, type Canvas } from 'fabric';
import { v4 as uuidv4 } from 'uuid';
import { TOOLS, CANVAS } from '../constants';

type Tool = typeof TOOLS[keyof typeof TOOLS];
import { createBatchedRender } from '../utils/batchedRender';

interface Position {
  x: number;
  y: number;
}

interface TextElement {
  id: string;
  type: string;
  data: {
    text: string;
    left: number;
    top: number;
    fontSize: number;
    fill: string;
    fontFamily: string;
    selectable: boolean;
    hasControls: boolean;
    hasBorders: boolean;
  };
}

interface UseTextEditingProps {
  canvas: Canvas | null;
  color: string;
  fontSize: number;
  addElement: (element: TextElement) => void;
  setTool: (tool: Tool) => void;
}

interface UseTextEditingReturn {
  addText: (position: Position) => void;
}

export function useTextEditing({ canvas, color, fontSize, addElement, setTool }: UseTextEditingProps): UseTextEditingReturn {
  const addText = useCallback((position: Position) => {
    if (!canvas) return;

    const batchedRender = createBatchedRender(canvas);
    const currentZoom = canvas.getZoom();
    const adaptiveFontSize = fontSize / currentZoom;

    const textId = uuidv4();
    const textObj = new IText('', {
      left: position.x,
      top: position.y,
      fontSize: adaptiveFontSize,
      fill: color,
      selectable: true,
      hasControls: true,
      hasBorders: true,
      fontFamily: CANVAS.DEFAULT_FONT_FAMILY,
    });

    (textObj as unknown as { id: string }).id = textId;

    canvas.add(textObj);
    canvas.setActiveObject(textObj);
    textObj.enterEditing();
    if (textObj.hiddenTextarea) {
      textObj.hiddenTextarea.focus();
    }

    addElement({
      id: textId,
      type: 'text',
      data: {
        text: '',
        left: position.x,
        top: position.y,
        fontSize: adaptiveFontSize,
        fill: color,
        fontFamily: CANVAS.DEFAULT_FONT_FAMILY,
        selectable: true,
        hasControls: true,
        hasBorders: true
      }
    });

    setTool(TOOLS.SELECT);
    batchedRender();
  }, [canvas, color, fontSize, addElement, setTool]);

  return {
    addText
  };
}
