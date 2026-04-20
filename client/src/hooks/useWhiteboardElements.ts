import { useCallback, type MutableRefObject } from 'react';
import { Path, IText, Line, type Canvas, type FabricObject } from 'fabric';
import { v4 as uuidv4 } from 'uuid';
import { SOCKET_EVENTS, DEFAULT_COLORS, CANVAS } from '../constants';
import { getWorkspaceId } from '../utils';
import { createShapeFromData } from '../factories/shapeFactory';
import { loadDiagramToCanvas } from '../factories/diagramFactory';
import { createBatchedRender } from '../utils/batchedRender';
import { Arrow } from '../utils/fabricArrow';
import type { Socket } from 'socket.io-client';

interface Element {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

interface UseWhiteboardElementsReturn {
  createFabricObject: (element: Element) => FabricObject | null;
  addElement: (
    element: Element,
    canvasRef: MutableRefObject<Canvas | null>,
    elementsMapRef: MutableRefObject<Map<string, Element>>,
    socketRef: MutableRefObject<Socket | null>,
    isUpdatingRef: MutableRefObject<boolean>
  ) => void;
  updateElement: (
    id: string,
    element: Element,
    isMoving: boolean,
    elementsMapRef: MutableRefObject<Map<string, Element>>,
    socketRef: MutableRefObject<Socket | null>,
    isUpdatingRef: MutableRefObject<boolean>,
    emitThrottled: (workspaceId: string, elements: Element[]) => void
  ) => void;
  clearElements: (
    canvasRef: MutableRefObject<Canvas | null>,
    elementsMapRef: MutableRefObject<Map<string, Element>>,
    socketRef: MutableRefObject<Socket | null>
  ) => void;
}

export function useWhiteboardElements(): UseWhiteboardElementsReturn {
  const createFabricObject = useCallback((element: Element): FabricObject | null => {
    let obj: FabricObject | null = null;
    const data = element.data as Record<string, unknown>;

    switch (element.type) {
      case 'path': {
        const { type: _type, ...pathOptions } = data;
        obj = new Path(data.path as string, {
          ...pathOptions,
          stroke: (data.stroke as string) || DEFAULT_COLORS.BLACK,
          strokeWidth: (data.strokeWidth as number) || CANVAS.DEFAULT_BRUSH_WIDTH,
          fill: undefined,
          strokeLineCap: 'round',
          strokeLineJoin: 'round',
          strokeMiterLimit: CANVAS.STROKE_MITER_LIMIT,
          perPixelTargetFind: true
        });
        break;
      }

      case 'text': {
        const { type: _textType, ...textOptions } = data;
        obj = new IText((data.text as string) || '', {
          ...textOptions,
          left: data.left as number,
          top: data.top as number,
          fontSize: (data.fontSize as number) || CANVAS.DEFAULT_FONT_SIZE,
          fill: (data.fill as string) || DEFAULT_COLORS.BLACK,
          fontFamily: (data.fontFamily as string) || CANVAS.DEFAULT_FONT_FAMILY,
          selectable: true,
          hasControls: true,
          hasBorders: true,
          editable: true
        });
        break;
      }

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
        obj = createShapeFromData(element.type, data);
        break;
      case 'polygon': {
        const shapeType = (data.shapeType as string) || 'polygon';
        obj = createShapeFromData(shapeType, data);
        break;
      }
      case 'line': {
        const { left: _left1, top: _top1, type: _type1, x1, y1, x2, y2, ...lineOptions } = data;
        obj = new Line(
          [x1 as number, y1 as number, x2 as number, y2 as number],
          lineOptions
        );
        break;
      }
      case 'arrow': {
        const { left: _left2, top: _top2, type: _type2, x1, y1, x2, y2, ...arrowOptions } = data;
        obj = new Arrow(
          [x1 as number, y1 as number, x2 as number, y2 as number],
          arrowOptions
        );
        break;
      }
      case 'diagram':
      default:
        return null;
    }

    if (obj) {
      (obj as unknown as { id: string }).id = element.id;
    }

    return obj;
  }, []);

  const addElement = useCallback((
    element: Element,
    canvasRef: MutableRefObject<Canvas | null>,
    elementsMapRef: MutableRefObject<Map<string, Element>>,
    socketRef: MutableRefObject<Socket | null>,
    isUpdatingRef: MutableRefObject<boolean>
  ) => {
    if (!element.id) {
      element.id = uuidv4();
    }

    elementsMapRef.current.set(element.id, element);

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
        loadDiagramToCanvas(canvas, { id: element.id, data: element.data as { src: string } }, true);
      }
    }

    setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas || typeof canvas.getObjects !== 'function') {
        return;
      }
      const fabricObj = canvas.getObjects().find((obj) => (obj as unknown as { id?: string }).id === element.id);
      if (fabricObj) {
        canvas.bringObjectToFront(fabricObj);
        const batchedRender = createBatchedRender(canvas);
        batchedRender();
      }
    }, 0);
  }, []);

  const updateElement = useCallback((
    id: string,
    element: Element,
    isMoving: boolean,
    elementsMapRef: MutableRefObject<Map<string, Element>>,
    socketRef: MutableRefObject<Socket | null>,
    isUpdatingRef: MutableRefObject<boolean>,
    emitThrottled: (workspaceId: string, elements: Element[]) => void
  ) => {
    if (!id || !elementsMapRef.current.has(id)) return;

    const elementWithId = { ...element, id };

    elementsMapRef.current.set(id, elementWithId);

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

  const clearElements = useCallback((
    canvasRef: MutableRefObject<Canvas | null>,
    elementsMapRef: MutableRefObject<Map<string, Element>>,
    socketRef: MutableRefObject<Socket | null>
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.clear();
    elementsMapRef.current.clear();

    const workspaceId = getWorkspaceId();
    if (workspaceId && socketRef.current) {
      socketRef.current.emit(SOCKET_EVENTS.WHITEBOARD_CLEAR, { workspaceId });
    }
  }, []);

  return {
    createFabricObject,
    addElement,
    updateElement,
    clearElements
  };
}
