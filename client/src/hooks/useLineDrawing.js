import { useCallback, useRef } from 'react';
import { fabric } from 'fabric';
import { v4 as uuidv4 } from 'uuid';
import { TOOLS } from '../constants';
import '../utils/fabricArrow';

export function useLineDrawing({ canvas, tool, color, width, addElement, disabled }) {
  const isDrawing = useRef(false);
  const currentLine = useRef(null);
  const startPoint = useRef(null);

  const startLine = useCallback((pointer) => {
    if (disabled || !canvas) return;
    if (tool !== TOOLS.LINE && tool !== TOOLS.ARROW) return;

    isDrawing.current = true;
    startPoint.current = { x: pointer.x, y: pointer.y };

    const points = [pointer.x, pointer.y, pointer.x, pointer.y];

    const commonProps = {
      stroke: color,
      strokeWidth: width,
      strokeLineCap: 'round',
      selectable: false,
      evented: false,
      hasControls: false,
      hasBorders: false,
      id: uuidv4(),
      objectCaching: false,
    };

    let lineObj;

    if (tool === TOOLS.ARROW) {
      lineObj = new fabric.Arrow(points, {
        ...commonProps,
        headLength: Math.max(width * 3, 12),
      });
    } else {
      lineObj = new fabric.Line(points, commonProps);
    }

    canvas.add(lineObj);
    currentLine.current = lineObj;
  }, [canvas, tool, color, width, disabled]);

  const updateLine = useCallback((pointer, isShiftPressed = false) => {
    if (disabled || !isDrawing.current || !startPoint.current || !currentLine.current) return;

    const line = currentLine.current;
    const startX = startPoint.current.x;
    const startY = startPoint.current.y;

    let endX = pointer.x;
    let endY = pointer.y;

    if (isShiftPressed) {
      const deltaX = pointer.x - startX;
      const deltaY = pointer.y - startY;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      if (absX > absY * 2) {
        endY = startY;
      } else if (absY > absX * 2) {
        endX = startX;
      } else {
        const dist = Math.max(absX, absY);
        endX = startX + (deltaX > 0 ? dist : -dist);
        endY = startY + (deltaY > 0 ? dist : -dist);
      }
    }

    line.set({
      x1: startX,
      y1: startY,
      x2: endX,
      y2: endY,
    });

    line.setCoords();
    canvas.requestRenderAll();
  }, [canvas, disabled]);

  const finishLine = useCallback(() => {
    if (disabled || !isDrawing.current || !canvas) return;

    isDrawing.current = false;

    if (currentLine.current) {
      const line = currentLine.current;

      line.set({
        selectable: true,
        evented: true,
        hasControls: true,
        hasBorders: true,
      });
      line.setCoords();

      const baseData = line.toObject(['id', 'headLength', 'headAngle']);
      addElement({
        id: line.id,
        type: line.type,
        data: {
          ...baseData,
          x1: line.x1,
          y1: line.y1,
          x2: line.x2,
          y2: line.y2,
        }
      });

      currentLine.current = null;
    }

    startPoint.current = null;
    canvas.requestRenderAll();
  }, [canvas, addElement, disabled]);

  const cancelLine = useCallback(() => {
    if (currentLine.current && canvas) {
      canvas.remove(currentLine.current);
      canvas.requestRenderAll();
    }
    isDrawing.current = false;
    currentLine.current = null;
    startPoint.current = null;
  }, [canvas]);

  return {
    isDrawingLine: isDrawing,
    startLine,
    updateLine,
    finishLine,
    cancelLine
  };
}
