import { useState, useCallback } from 'react';
import { fabric } from 'fabric';
import { v4 as uuidv4 } from 'uuid';
import { SOCKET_EVENTS } from '../constants';
import { getWorkspaceId } from '../utils';
import '../utils/fabricArrow';

export function useWhiteboardElements() {
  const [elements, setElements] = useState([]);

  const createFabricObject = useCallback((element) => {
    let obj;

    switch (element.type) {
      case 'path':
        obj = new fabric.Path(element.data.path, {
          ...element.data,
          stroke: element.data.stroke || '#000000',
          strokeWidth: element.data.strokeWidth || 2,
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
          fontSize: element.data.fontSize || 20,
          fill: element.data.fill || '#000000',
          fontFamily: element.data.fontFamily || 'Arial',
          selectable: true,
          hasControls: true,
          hasBorders: true,
          editable: true
        });
        break;

      case 'rect':
        obj = new fabric.Rect(element.data);
        break;
      case 'circle':
        obj = new fabric.Circle(element.data);
        break;
      case 'triangle':
        if (element.data.points) {
          obj = new fabric.Polygon(element.data.points, {
            ...element.data,
            strokeLineJoin: 'round',
            strokeLineCap: 'round',
            strokeUniform: true
          });
          obj.type = 'triangle';
        } else {
          obj = new fabric.Triangle(element.data);
        }
        break;
      case 'star':
        obj = new fabric.Polygon(element.data.points, {
          ...element.data,
          strokeLineJoin: 'round',
          strokeLineCap: 'round',
          strokeUniform: true
        });
        obj.type = 'star';
        break;
      case 'diamond':
        obj = new fabric.Polygon(element.data.points, {
          ...element.data,
          strokeLineJoin: 'round',
          strokeLineCap: 'round',
          strokeUniform: true
        });
        obj.type = 'diamond';
        break;
      case 'pentagon':
        obj = new fabric.Polygon(element.data.points, {
          ...element.data,
          strokeLineJoin: 'round',
          strokeLineCap: 'round',
          strokeUniform: true
        });
        obj.type = 'pentagon';
        break;
      case 'hexagon':
        obj = new fabric.Polygon(element.data.points, {
          ...element.data,
          strokeLineJoin: 'round',
          strokeLineCap: 'round',
          strokeUniform: true
        });
        obj.type = 'hexagon';
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
          console.warn('Diagram element has no src');
          return null;
        }

        obj = new fabric.Rect({
          ...element.data,
          fill: 'rgba(240, 240, 240, 0.5)',
          stroke: '#ccc',
          strokeDashArray: [5, 5],
          strokeWidth: 1,
          width: 200,
          height: 150
        });

        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
          const fabricImage = new fabric.Image(img, {
            ...element.data,
            id: element.id,
            left: element.data.left || 50,
            top: element.data.top || 50,
            scaleX: element.data.scaleX || 0.5,
            scaleY: element.data.scaleY || 0.5,
            angle: element.data.angle || 0,
            selectable: true,
            hasControls: true,
            hasBorders: true,
            cornerColor: '#2196F3',
            borderColor: '#2196F3',
            cornerSize: 8,
            padding: 10,
            lockMovementX: false,
            lockMovementY: false,
            lockRotation: false,
            lockScalingX: false,
            lockScalingY: false,
            data: { ...element.data, isDiagram: true }
          });

          img.fabricImage = fabricImage;
        };

        img.onerror = (error) => {
          console.error('Error loading diagram image:', error);
        };

        img.src = element.data.src;
        break;
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
      if (canvas && !canvas.getObjects().some(o => o.id === element.id)) {
        const obj = createFabricObject(element);
        if (obj) {
          canvas.add(obj);
          obj.bringToFront();
          canvas.requestRenderAll();
        }
      }
    }

    setTimeout(() => {
      const canvas = canvasRef.current;
      if (canvas) {
        const fabricObj = canvas.getObjects().find(obj => obj.id === element.id);
        if (fabricObj) {
          fabricObj.bringToFront();
          canvas.requestRenderAll();
        }
      }
    }, 0);
  }, [createFabricObject]);

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
      canvas.requestRenderAll();
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
