import { useCallback } from 'react';
import { fabric } from 'fabric';
import { v4 as uuidv4 } from 'uuid';
import { TOOLS, CANVAS } from '../constants';

export function useTextEditing({ canvas, color, addElement, setTool }) {
  const addText = useCallback((position) => {
    if (!canvas) return;

    const textId = uuidv4();
    const textObj = new fabric.IText('', {
      left: position.x,
      top: position.y,
      fontSize: CANVAS.DEFAULT_FONT_SIZE,
      fill: color,
      id: textId,
      selectable: true,
      hasControls: true,
      hasBorders: true,
      fontFamily: CANVAS.DEFAULT_FONT_FAMILY,
    });

    canvas.add(textObj);
    canvas.setActiveObject(textObj);
    textObj.enterEditing();
    textObj.hiddenTextarea.focus();

    // Add initial element state
    addElement({
      id: textId,
      type: 'i-text',
      data: {
        text: '',
        left: position.x,
        top: position.y,
        fontSize: CANVAS.DEFAULT_FONT_SIZE,
        fill: color,
        fontFamily: CANVAS.DEFAULT_FONT_FAMILY,
        selectable: true,
        hasControls: true,
        hasBorders: true
      }
    });

    setTool(TOOLS.SELECT);
    canvas.requestRenderAll();
  }, [canvas, color, addElement, setTool]);

  return {
    addText
  };
}
