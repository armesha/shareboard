import React, { useEffect, useRef, useCallback } from 'react';
import { Point, type Canvas, type FabricObject, type TPointerEvent, type TPointerEventInfo } from 'fabric';
import { useWhiteboard } from '../context/WhiteboardContext';
import { useSocket } from '../context/SocketContext';
import { useSharing } from '../context/SharingContext';
import { TOOLS, FABRIC_EVENTS, TIMING, CANVAS, ZOOM, SOCKET_EVENTS } from '../constants';
import { getWorkspaceId, constrainObjectToBounds } from '../utils';
import { getAbsolutePosition } from '../utils/fabricHelpers';
import { useShapeDrawing } from '../hooks/useShapeDrawing';
import { useLineDrawing } from '../hooks/useLineDrawing';
import { useTextEditing } from '../hooks/useTextEditing';

interface WhiteboardProps {
  disabled?: boolean;
  onCursorMove?: (x: number, y: number) => void;
}

type ExtendedFabricObject = FabricObject & {
  id?: string;
  data?: { isDiagram?: boolean; shapeType?: string };
  originalState?: { left?: number; top?: number };
  modificationTimeout?: ReturnType<typeof setTimeout>;
  text?: string;
  fontSize?: number;
  rx?: number;
  ry?: number;
  points?: { x: number; y: number }[];
  headLength?: number;
  headAngle?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  radius?: number;
}

const POLYGON_SHAPE_TYPES = ['triangle', 'star', 'diamond', 'pentagon', 'hexagon', 'octagon', 'cross'];

interface ActiveSelection extends FabricObject {
  getObjects: () => ExtendedFabricObject[];
}

interface WheelEventInfo {
  e: WheelEvent;
}

const Whiteboard = React.memo(function Whiteboard({ disabled = false, onCursorMove }: WhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isUpdatingRef = useRef(false);
  const isPanningRef = useRef(false);
  const lastPanPointRef = useRef<{ x: number; y: number } | null>(null);
  const isSpacePressedRef = useRef(false);
  const modificationTimeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const { socket } = useSocket();
  const sharingContext = useSharing();
  const canWrite = sharingContext?.canWrite ?? (() => false);
  const {
    tool,
    color,
    width,
    fontSize,
    selectedShape,
    initCanvas,
    canvasRef: fabricCanvasRef,
    batchedRenderRef,
    addElement,
    updateElement,
    setTool,
    setZoomState,
  } = useWhiteboard();

  const canvas = fabricCanvasRef.current as Canvas | null;

  const {
    isDrawing,
    startShape,
    updateShape,
    finishShape
  } = useShapeDrawing({
    canvas,
    selectedShape,
    color,
    width,
    addElement,
    disabled,
    socket,
    canWrite
  });

  const {
    isDrawingLine,
    startLine,
    updateLine,
    finishLine
  } = useLineDrawing({
    canvas,
    tool,
    color,
    width,
    addElement,
    disabled,
    socket
  });

  const {
    addText
  } = useTextEditing({
    canvas,
    color,
    fontSize,
    addElement,
    setTool
  });

  useEffect(() => {
    if (!canvasRef.current) return;
    return initCanvas(canvasRef.current);
  }, [initCanvas]);

  useEffect(() => {
    if (!canvas) return;

    const timeoutsSet = modificationTimeoutsRef.current;

    const handleObjectModification = (e: { target?: ExtendedFabricObject | null }) => {
      if (disabled) {
        if (e.target?.originalState) {
          e.target.set(e.target.originalState);
          if (batchedRenderRef.current) {
            batchedRenderRef.current();
          }
        }
        return;
      }

      const obj = e.target as ExtendedFabricObject | null;
      if (!obj || isUpdatingRef.current) return;

      if (obj.type === 'diagram' || (obj.type === 'image' && obj.data?.isDiagram)) {
        obj.lockMovementX = false;
        obj.lockMovementY = false;
      }

      const isActiveSelection = obj.type === 'activeSelection';
      const objectsToUpdate = isActiveSelection ? (obj as unknown as ActiveSelection).getObjects() : [obj];

      objectsToUpdate.forEach(item => {
        if (!item.id) return;

        if (item.modificationTimeout) {
          clearTimeout(item.modificationTimeout);
        }

        let absoluteLeft = item.left ?? 0;
        let absoluteTop = item.top ?? 0;

        if (isActiveSelection) {
          const absPos = getAbsolutePosition(item, obj as unknown as import('fabric').Group);
          absoluteLeft = absPos.left;
          absoluteTop = absPos.top;
        }

        const capturedLeft = absoluteLeft;
        const capturedTop = absoluteTop;

        const timeoutId = setTimeout(() => {
          modificationTimeoutsRef.current.delete(timeoutId);
          (canvas as Canvas & { suspendDrawing?: boolean }).suspendDrawing = true;

          try {
            if (item.data?.isDiagram) {
              updateElement(item.id!, {
                id: item.id!,
                type: 'diagram',
                data: { ...item.data, left: capturedLeft, top: capturedTop, scaleX: item.scaleX, scaleY: item.scaleY, angle: item.angle }
              });
            } else if (item.type === 'text' || item.type === 'i-text') {
              updateElement(item.id!, {
                id: item.id!,
                type: 'text',
                data: { text: item.text, left: capturedLeft, top: capturedTop, fontSize: item.fontSize, fill: item.fill, angle: item.angle, scaleX: item.scaleX, scaleY: item.scaleY }
              });
            } else if (item.type === 'path') {
              updateElement(item.id!, {
                id: item.id!,
                type: 'path',
                data: {
                  left: capturedLeft,
                  top: capturedTop,
                  scaleX: item.scaleX,
                  scaleY: item.scaleY,
                  angle: item.angle,
                  path: (item as unknown as { path: unknown }).path,
                  stroke: item.stroke,
                  strokeWidth: item.strokeWidth,
                  fill: item.fill,
                  strokeLineCap: item.strokeLineCap,
                  strokeLineJoin: item.strokeLineJoin
                }
              });
            } else if (item.type === 'line' || item.type === 'arrow') {
              updateElement(item.id!, {
                id: item.id!,
                type: item.type,
                data: {
                  left: capturedLeft,
                  top: capturedTop,
                  scaleX: item.scaleX,
                  scaleY: item.scaleY,
                  angle: item.angle,
                  x1: item.x1,
                  y1: item.y1,
                  x2: item.x2,
                  y2: item.y2,
                  stroke: item.stroke,
                  strokeWidth: item.strokeWidth,
                  strokeLineCap: item.strokeLineCap,
                  headLength: item.headLength,
                  headAngle: item.headAngle
                }
              });
            } else if (item.type === 'circle') {
              updateElement(item.id!, {
                id: item.id!,
                type: 'circle',
                data: {
                  left: capturedLeft,
                  top: capturedTop,
                  scaleX: item.scaleX,
                  scaleY: item.scaleY,
                  angle: item.angle,
                  radius: item.radius,
                  stroke: item.stroke,
                  strokeWidth: item.strokeWidth,
                  fill: item.fill,
                  strokeUniform: item.strokeUniform
                }
              });
            } else if (item.type === 'rect') {
              updateElement(item.id!, {
                id: item.id!,
                type: 'rect',
                data: {
                  left: capturedLeft,
                  top: capturedTop,
                  scaleX: item.scaleX,
                  scaleY: item.scaleY,
                  angle: item.angle,
                  width: item.width,
                  height: item.height,
                  stroke: item.stroke,
                  strokeWidth: item.strokeWidth,
                  fill: item.fill,
                  strokeUniform: item.strokeUniform
                }
              });
            } else if (item.type === 'ellipse') {
              updateElement(item.id!, {
                id: item.id!,
                type: 'ellipse',
                data: {
                  left: capturedLeft,
                  top: capturedTop,
                  scaleX: item.scaleX,
                  scaleY: item.scaleY,
                  angle: item.angle,
                  rx: item.rx,
                  ry: item.ry,
                  stroke: item.stroke,
                  strokeWidth: item.strokeWidth,
                  fill: item.fill,
                  strokeUniform: item.strokeUniform
                }
              });
            } else if (item.data?.shapeType && POLYGON_SHAPE_TYPES.includes(item.data.shapeType)) {
              updateElement(item.id!, {
                id: item.id!,
                type: item.data.shapeType,
                data: {
                  left: capturedLeft,
                  top: capturedTop,
                  scaleX: item.scaleX,
                  scaleY: item.scaleY,
                  angle: item.angle,
                  points: item.points,
                  stroke: item.stroke,
                  strokeWidth: item.strokeWidth,
                  fill: item.fill,
                  strokeUniform: item.strokeUniform,
                  strokeLineJoin: item.strokeLineJoin,
                  strokeLineCap: item.strokeLineCap
                }
              });
            } else {
              updateElement(item.id!, {
                id: item.id!,
                type: item.type,
                data: {
                  left: capturedLeft,
                  top: capturedTop,
                  scaleX: item.scaleX,
                  scaleY: item.scaleY,
                  angle: item.angle,
                  width: item.width,
                  height: item.height,
                  stroke: item.stroke,
                  strokeWidth: item.strokeWidth,
                  fill: item.fill
                }
              });
            }
          } finally {
            (canvas as Canvas & { suspendDrawing?: boolean }).suspendDrawing = false;
            if (batchedRenderRef.current) {
              batchedRenderRef.current();
            }
          }
        }, TIMING.MOVEMENT_TIMEOUT);
        item.modificationTimeout = timeoutId;
        modificationTimeoutsRef.current.add(timeoutId);
      });
    };

    canvas.on(FABRIC_EVENTS.OBJECT_MODIFIED, handleObjectModification as (e: unknown) => void);
    canvas.on(FABRIC_EVENTS.OBJECT_MOVING, handleObjectModification as (e: unknown) => void);
    canvas.on(FABRIC_EVENTS.OBJECT_SCALING, handleObjectModification as (e: unknown) => void);
    canvas.on(FABRIC_EVENTS.OBJECT_ROTATING, handleObjectModification as (e: unknown) => void);
    canvas.on(FABRIC_EVENTS.TEXT_CHANGED, handleObjectModification as (e: unknown) => void);

    return () => {
      canvas.off(FABRIC_EVENTS.OBJECT_MODIFIED, handleObjectModification as (e: unknown) => void);
      canvas.off(FABRIC_EVENTS.OBJECT_MOVING, handleObjectModification as (e: unknown) => void);
      canvas.off(FABRIC_EVENTS.OBJECT_SCALING, handleObjectModification as (e: unknown) => void);
      canvas.off(FABRIC_EVENTS.OBJECT_ROTATING, handleObjectModification as (e: unknown) => void);
      canvas.off(FABRIC_EVENTS.TEXT_CHANGED, handleObjectModification as (e: unknown) => void);
      timeoutsSet.forEach(clearTimeout);
      timeoutsSet.clear();
    };
  }, [canvas, updateElement, disabled, batchedRenderRef]);

  useEffect(() => {
    if (!canvas) return;

    const handleObjectMoved = (e: { target?: ExtendedFabricObject | null }) => {
      if (disabled || tool !== TOOLS.SELECT) return;

      const obj = e.target;
      if (!obj) return;

      constrainObjectToBounds(obj, canvas, CANVAS.EDGE_BUFFER);
    };

    const handleMouseDown = (e: TPointerEventInfo<TPointerEvent>) => {
      if (disabled) {
        canvas.selection = false;
        return;
      }
      const target = e.target as ExtendedFabricObject | undefined;
      if (target) {
        target.originalState = { left: target.left, top: target.top };
      }
    };

    canvas.on(FABRIC_EVENTS.OBJECT_MODIFIED, handleObjectMoved as (e: unknown) => void);
    canvas.on(FABRIC_EVENTS.MOUSE_DOWN, handleMouseDown);

    return () => {
      canvas.off(FABRIC_EVENTS.OBJECT_MODIFIED, handleObjectMoved as (e: unknown) => void);
      canvas.off(FABRIC_EVENTS.MOUSE_DOWN, handleMouseDown);
    };
  }, [canvas, tool, disabled]);

  useEffect(() => {
    if (!canvas) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (disabled || e.key !== 'Delete' || tool !== TOOLS.SELECT) return;

      const activeObjects = canvas.getActiveObjects() as ExtendedFabricObject[];
      if (activeObjects.length === 0) return;

      const workspaceId = getWorkspaceId();
      activeObjects.forEach(obj => {
        if (obj.id) {
          if (obj.modificationTimeout) {
            clearTimeout(obj.modificationTimeout);
            obj.modificationTimeout = undefined;
          }
          canvas.remove(obj);
          socket?.emit(SOCKET_EVENTS.DELETE_ELEMENT, { workspaceId, elementId: obj.id });
        }
      });

      canvas.discardActiveObject();
      if (batchedRenderRef.current) {
        batchedRenderRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canvas, tool, socket, disabled, batchedRenderRef]);



  const handleMouseDown = useCallback((e: TPointerEventInfo<TPointerEvent>) => {
    if (disabled || !canvas) return;
    if ((e.e as MouseEvent).button !== 0) return;

    if (tool === TOOLS.TEXT && !e.target) {
      const pointer = canvas.getPointer(e.e);
      addText(pointer);
      return;
    }

    if (tool === TOOLS.SHAPES && selectedShape && !e.target) {
      const pointer = canvas.getPointer(e.e);
      startShape(pointer);
      return;
    }

    if ((tool === TOOLS.LINE || tool === TOOLS.ARROW) && !e.target) {
      const pointer = canvas.getPointer(e.e);
      startLine(pointer);
    }
  }, [canvas, tool, selectedShape, disabled, addText, startShape, startLine]);

  const handleMouseMove = useCallback((e: TPointerEventInfo<TPointerEvent>) => {
    if (!canvas) return;

    const pointer = canvas.getPointer(e.e);

    if (onCursorMove) {
      onCursorMove(pointer.x, pointer.y);
    }

    if (disabled) return;

    if (isDrawing.current) {
      const mouseEvent = e.e as MouseEvent;
      updateShape(pointer, mouseEvent.ctrlKey);
      return;
    }

    if (isDrawingLine.current) {
      const mouseEvent = e.e as MouseEvent;
      updateLine(pointer, mouseEvent.shiftKey);
    }
  }, [canvas, disabled, isDrawing, isDrawingLine, updateShape, updateLine, onCursorMove]);

  const handleMouseUp = useCallback(() => {
    if (disabled || !canvas) return;

    if (isDrawing.current) {
      finishShape();
      return;
    }

    if (isDrawingLine.current) {
      finishLine();
    }
  }, [canvas, disabled, isDrawing, isDrawingLine, finishShape, finishLine]);

  useEffect(() => {
    if (!canvas) return;

    canvas.on(FABRIC_EVENTS.MOUSE_DOWN, handleMouseDown);
    canvas.on(FABRIC_EVENTS.MOUSE_MOVE, handleMouseMove);
    canvas.on(FABRIC_EVENTS.MOUSE_UP, handleMouseUp);

    return () => {
      canvas.off(FABRIC_EVENTS.MOUSE_DOWN, handleMouseDown);
      canvas.off(FABRIC_EVENTS.MOUSE_MOVE, handleMouseMove);
      canvas.off(FABRIC_EVENTS.MOUSE_UP, handleMouseUp);
    };
  }, [canvas, handleMouseDown, handleMouseMove, handleMouseUp]);

  useEffect(() => {
    const handleResize = () => {
      if (!canvas) return;
      const container = canvas.wrapperEl?.parentElement;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      canvas.setDimensions({ width: rect.width, height: rect.height });
      if (batchedRenderRef.current) {
        batchedRenderRef.current();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [canvas, batchedRenderRef]);


  useEffect(() => {
    if (!canvas) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        isSpacePressedRef.current = true;
        canvas.defaultCursor = 'grab';
        canvas.hoverCursor = 'grab';
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressedRef.current = false;
        isPanningRef.current = false;
        const cursorValue = tool === TOOLS.SELECT ? CANVAS.CUSTOM_CURSOR : 'crosshair';
        canvas.defaultCursor = cursorValue;
        canvas.hoverCursor = cursorValue;
      }
    };

    const handlePanMouseDown = (opt: TPointerEventInfo<TPointerEvent>) => {
      const mouseEvent = opt.e as MouseEvent;
      if (isSpacePressedRef.current || mouseEvent.button === 1 || mouseEvent.button === 2) {
        isPanningRef.current = true;
        canvas.defaultCursor = 'grabbing';
        lastPanPointRef.current = { x: mouseEvent.clientX, y: mouseEvent.clientY };
        canvas.selection = false;
        if (mouseEvent.button === 2) {
          mouseEvent.preventDefault();
        }
      }
    };

    const handlePanMouseMove = (opt: TPointerEventInfo<TPointerEvent>) => {
      if (!isPanningRef.current || !lastPanPointRef.current) return;

      const mouseEvent = opt.e as MouseEvent;
      const deltaX = mouseEvent.clientX - lastPanPointRef.current.x;
      const deltaY = mouseEvent.clientY - lastPanPointRef.current.y;

      const vpt = canvas.viewportTransform;
      if (vpt) {
        vpt[4]! += deltaX;
        vpt[5]! += deltaY;
      }

      if (batchedRenderRef.current) {
        batchedRenderRef.current();
      }
      lastPanPointRef.current = { x: mouseEvent.clientX, y: mouseEvent.clientY };
    };

    const handlePanMouseUp = () => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        const defaultCursor = tool === TOOLS.SELECT ? CANVAS.CUSTOM_CURSOR : 'crosshair';
        canvas.defaultCursor = isSpacePressedRef.current ? 'grab' : defaultCursor;
        canvas.selection = tool === TOOLS.SELECT;
      }
    };

    const handleWheel = (opt: WheelEventInfo) => {
      opt.e.preventDefault();
      opt.e.stopPropagation();

      const delta = opt.e.deltaY;
      const multiplier = delta > 0 ? ZOOM.WHEEL_OUT_MULTIPLIER : ZOOM.WHEEL_IN_MULTIPLIER;
      let newZoom = canvas.getZoom() * multiplier;
      newZoom = Math.min(Math.max(newZoom, ZOOM.MIN), ZOOM.MAX);

      const point = new Point(opt.e.offsetX, opt.e.offsetY);
      canvas.zoomToPoint(point, newZoom);
      if (batchedRenderRef.current) {
        batchedRenderRef.current();
      }
      setZoomState(newZoom);
    };

    const handleContextMenu = (e: Event) => {
      e.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    canvas.on(FABRIC_EVENTS.MOUSE_DOWN, handlePanMouseDown);
    canvas.on(FABRIC_EVENTS.MOUSE_MOVE, handlePanMouseMove);
    canvas.on(FABRIC_EVENTS.MOUSE_UP, handlePanMouseUp);
    canvas.on(FABRIC_EVENTS.MOUSE_WHEEL, handleWheel as unknown as (e: unknown) => void);
    canvas.upperCanvasEl?.addEventListener('contextmenu', handleContextMenu);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      canvas.off(FABRIC_EVENTS.MOUSE_DOWN, handlePanMouseDown);
      canvas.off(FABRIC_EVENTS.MOUSE_MOVE, handlePanMouseMove);
      canvas.off(FABRIC_EVENTS.MOUSE_UP, handlePanMouseUp);
      canvas.off(FABRIC_EVENTS.MOUSE_WHEEL, handleWheel as unknown as (e: unknown) => void);
      canvas.upperCanvasEl?.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [canvas, setZoomState, tool, batchedRenderRef]);

  useEffect(() => {
    if (!canvas) return;
    const cursorValue = tool === TOOLS.SELECT ? CANVAS.CUSTOM_CURSOR : 'crosshair';
    canvas.defaultCursor = cursorValue;
    canvas.hoverCursor = cursorValue;
  }, [canvas, tool]);

  return (
    <>
      <div className="relative w-full h-full canvas-grid">
        <canvas
          ref={canvasRef}
          style={{
            userSelect: 'none'
          }}
        />
      </div>
    </>
  );
});

export default Whiteboard;
