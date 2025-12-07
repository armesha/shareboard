import { useState, useCallback } from 'react';
import { fabric } from 'fabric';
import { v4 as uuidv4 } from 'uuid';
import { SOCKET_EVENTS, DEFAULT_COLORS, CANVAS } from '../constants';
import { getWorkspaceId } from '../utils';
import { createShapeFromData } from '../factories/shapeFactory';
import { loadDiagramToCanvas } from '../factories/diagramFactory';
import { createBatchedRender } from '../utils/batchedRender';
import '../utils/fabricArrow';

export function useWhiteboardElements() {
  const [elements, setElements] = useState([]);

  const createFabricObject = useCallback((element) => {
    let obj;

    switch (element.type) {
      case 'path':
        obj = new fabric.Path(element.data.path, {
          ...element.data,
          stroke: element.data.stroke || DEFAULT_COLORS.BLACK,
          strokeWidth: element.data.strokeWidth || CANVAS.DEFAULT_BRUSH_WIDTH,
          fill: null,
          strokeLineCap: 'round',
          strokeLineJoin: 'round',
          strokeMiterLimit: 10,
          perPixelTargetFind: true
        });
        break;

      case 'text':
        obj = new fabric.IText(element.data.text || '', {
          ...element.data,
          left: element.data.left,
          top: element.data.top,
          fontSize: element.data.fontSize || CANVAS.DEFAULT_FONT_SIZE,
          fill: element.data.fill || DEFAULT_COLORS.BLACK,
          fontFamily: element.data.fontFamily || CANVAS.DEFAULT_FONT_FAMILY,
          selectable: true,
          hasControls: true,
          hasBorders: true,
          editable: true
        });
        break;

      case 'rect':
      case 'circle':
      case 'ellipse':
      case 'triangle':
      case 'star':
      case 'diamond':
      case 'pentagon':
      case 'hexagon':
      case 'octagon':
      case 'cross':
        obj = createShapeFromData(element.type, element.data);
        break;
      case 'line': {
        const { left: _left1, top: _top1, ...lineOptions } = element.data;
        obj = new fabric.Line([element.data.x1, element.data.y1, element.data.x2, element.data.y2], lineOptions);
        break;
      }
      case 'arrow': {
        const { left: _left2, top: _top2, ...arrowOptions } = element.data;
        obj = new fabric.Arrow([element.data.x1, element.data.y1, element.data.x2, element.data.y2], arrowOptions);
        break;
      }
      case 'diagram': {
        if (!element.data.src) {
          return null;
        }
        return null;
      }
      default:
        return null;
    }

    if (obj) {
      obj.id = element.id;
    }

    return obj;
  }, []);

  const addElement = useCallback((element, canvasRef, elementsMapRef, socketRef, isUpdatingRef) => {
    if (!element.id) {
      element.id = uuidv4();
    }

    elementsMapRef.current.set(element.id, element);

    const updatedElements = Array.from(elementsMapRef.current.values());
    setElements(updatedElements);

    const workspaceId = getWorkspaceId();
    if (workspaceId && socketRef.current && !isUpdatingRef.current) {
      socketRef.current.emit(SOCKET_EVENTS.WHITEBOARD_UPDATE, {
        workspaceId,
        elements: [element]
      });
    }

    if (element.type === 'diagram') {
      const canvas = canvasRef.current;
      if (canvas && element.data.src) {
        loadDiagramToCanvas(canvas, element, true);
      }
    }

    setTimeout(() => {
      const canvas = canvasRef.current;
      // Defensive check: ensure canvas exists and hasn't been disposed
      if (!canvas || typeof canvas.getObjects !== 'function') {
        return;
      }
      const fabricObj = canvas.getObjects().find(obj => obj.id === element.id);
      if (fabricObj) {
        fabricObj.bringToFront();
        const batchedRender = createBatchedRender(canvas);
        batchedRender();
      }
    }, 0);
  }, []);

  const updateElement = useCallback((id, element, isMoving, elementsMapRef, socketRef, isUpdatingRef, emitThrottled) => {
    if (!id || !elementsMapRef.current.has(id)) return;

    const elementWithId = { ...element, id };

    elementsMapRef.current.set(id, elementWithId);

    if (!isMoving) {
      const updatedElements = Array.from(elementsMapRef.current.values());
      setElements(updatedElements);
    }

    const workspaceId = getWorkspaceId();
    if (workspaceId && socketRef.current && !isUpdatingRef.current) {
      if (isMoving) {
        emitThrottled(workspaceId, [elementWithId]);
      } else {
        socketRef.current.emit(SOCKET_EVENTS.WHITEBOARD_UPDATE, {
          workspaceId,
          elements: [elementWithId]
        });
      }
    }
  }, []);

  const deleteElement = useCallback((elementId, canvasRef, elementsMapRef, socketRef) => {
    elementsMapRef.current.delete(elementId);

    const canvas = canvasRef.current;
    if (canvas) {
      const obj = canvas.getObjects().find(o => o.id === elementId);
      if (obj) {
        canvas.remove(obj);
      }
    }

    const updatedElements = Array.from(elementsMapRef.current.values());
    setElements(updatedElements);

    if (canvas) {
      const batchedRender = createBatchedRender(canvas);
      batchedRender();
    }

    const workspaceId = getWorkspaceId();
    if (workspaceId && socketRef.current) {
      socketRef.current.emit(SOCKET_EVENTS.DELETE_ELEMENT, {
        workspaceId,
        elementId
      });
    }
  }, []);

  const clearElements = useCallback((canvasRef, elementsMapRef, socketRef) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.clear();
    elementsMapRef.current.clear();
    setElements([]);

    const workspaceId = getWorkspaceId();
    if (workspaceId && socketRef.current) {
      socketRef.current.emit(SOCKET_EVENTS.WHITEBOARD_CLEAR, { workspaceId });
    }
  }, []);

  return {
    elements,
    setElements,
    createFabricObject,
    addElement,
    updateElement,
    deleteElement,
    clearElements
  };
}
