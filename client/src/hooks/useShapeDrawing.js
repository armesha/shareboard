import { useCallback, useRef } from 'react';
import { fabric } from 'fabric';
import { v4 as uuidv4 } from 'uuid';
import { SHAPES } from '../constants';

export function useShapeDrawing({ canvas, selectedShape, color, width, addElement, disabled }) {
  const isDrawing = useRef(false);
  const currentShape = useRef(null);
  const startPoint = useRef(null);

  const startShape = useCallback((pointer) => {
    if (disabled || !canvas || !selectedShape) return;

    isDrawing.current = true;
    startPoint.current = pointer;

    const commonProps = {
      left: pointer.x,
      top: pointer.y,
      fill: 'transparent',
      stroke: color,
      strokeWidth: width,
      selectable: false,
      evented: false,
      hasControls: false,
      hasBorders: false,
      lockMovementX: true,
      lockMovementY: true,
      id: uuidv4(),
    };

    let shapeObj;

    switch (selectedShape) {
      case SHAPES.RECTANGLE:
        shapeObj = new fabric.Rect({
          ...commonProps,
          width: 0,
          height: 0
        });
        break;
      case SHAPES.CIRCLE:
        shapeObj = new fabric.Circle({
          ...commonProps,
          radius: 0
        });
        break;
      case SHAPES.TRIANGLE:
        shapeObj = new fabric.Triangle({
          ...commonProps,
          width: 0,
          height: 0
        });
        break;
      default:
        return;
    }

    canvas.add(shapeObj);
    currentShape.current = shapeObj;
  }, [canvas, selectedShape, color, width, disabled]);

  const updateShape = useCallback((pointer, isCtrlPressed = false) => {
    if (disabled || !isDrawing.current || !startPoint.current || !currentShape.current) return;

    const shape = currentShape.current;
    const startX = startPoint.current.x;
    const startY = startPoint.current.y;
    const deltaWidth = pointer.x - startX;
    const deltaHeight = pointer.y - startY;

    switch (selectedShape) {
      case SHAPES.RECTANGLE:
        if (isCtrlPressed) {
          const size = Math.max(Math.abs(deltaWidth), Math.abs(deltaHeight));
          shape.set({
            width: size,
            height: size,
            left: deltaWidth > 0 ? startX : startX - size,
            top: deltaHeight > 0 ? startY : startY - size
          });
        } else {
          shape.set({
            width: Math.abs(deltaWidth),
            height: Math.abs(deltaHeight),
            left: deltaWidth > 0 ? startX : pointer.x,
            top: deltaHeight > 0 ? startY : pointer.y
          });
        }
        break;

      case SHAPES.CIRCLE:
        const radius = Math.sqrt(deltaWidth * deltaWidth + deltaHeight * deltaHeight) / 2;
        shape.set({
          radius: radius,
          left: startX - radius,
          top: startY - radius
        });
        break;

      case SHAPES.TRIANGLE:
        const isUpsideDown = deltaHeight < 0;
        if (isCtrlPressed) {
          const size = Math.max(Math.abs(deltaWidth), Math.abs(deltaHeight));
          shape.set({
            width: size,
            height: isUpsideDown ? -size : size,
            left: startX - (size / 2),
            top: startY,
            originY: 'top'
          });
        } else {
          shape.set({
            width: Math.abs(deltaWidth),
            height: isUpsideDown ? -Math.abs(deltaHeight) : Math.abs(deltaHeight),
            left: startX - (Math.abs(deltaWidth) / 2),
            top: startY,
            originY: 'top'
          });
        }
        break;
    }

    shape.setCoords();
    canvas.renderAll();
  }, [canvas, selectedShape, disabled]);

  const finishShape = useCallback(() => {
    if (disabled || !isDrawing.current || !canvas) return;

    isDrawing.current = false;

    if (currentShape.current) {
      const shape = currentShape.current;
      shape.setCoords();

      addElement({
        id: shape.id,
        type: shape.type,
        data: {
          ...shape.toObject(['id'])
        }
      });

      currentShape.current = null;
    }

    startPoint.current = null;
    canvas.renderAll();
  }, [canvas, addElement, disabled]);

  const cancelShape = useCallback(() => {
    if (currentShape.current && canvas) {
      canvas.remove(currentShape.current);
      canvas.renderAll();
    }
    isDrawing.current = false;
    currentShape.current = null;
    startPoint.current = null;
  }, [canvas]);

  return {
    isDrawing,
    startShape,
    updateShape,
    finishShape,
    cancelShape
  };
}
