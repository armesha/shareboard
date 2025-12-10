import React, { useEffect, useRef, useCallback } from 'react';
import type { Canvas, FabricObject, TPointerEvent, TPointerEventInfo } from 'fabric';
import { useWhiteboard } from '../context/WhiteboardContext';
import { useSocket } from '../context/SocketContext';
import { useSharing } from '../context/SharingContext';
import { TOOLS, FABRIC_EVENTS, CANVAS } from '../constants';
import { constrainObjectToBounds } from '../utils';
import { useShapeDrawing } from '../hooks/useShapeDrawing';
import { useLineDrawing } from '../hooks/useLineDrawing';
import { useTextEditing } from '../hooks/useTextEditing';
import { useObjectModification } from '../hooks/useObjectModification';
import { useCanvasPanning } from '../hooks/useCanvasPanning';
import { useKeyboardDelete } from '../hooks/useKeyboardDelete';

interface WhiteboardProps {
  disabled?: boolean;
  onCursorMove?: (x: number, y: number) => void;
}

type ExtendedFabricObject = FabricObject & {
  id?: string;
  originalState?: { left?: number; top?: number };
};

const Whiteboard = React.memo(function Whiteboard({ disabled = false, onCursorMove }: WhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
    isUpdatingRef,
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

  const { modificationTimeoutsRef } = useObjectModification({
    canvas,
    updateElement,
    disabled,
    batchedRenderRef,
    isUpdatingRef
  });

  useCanvasPanning({
    canvas,
    tool,
    setZoomState,
    batchedRenderRef
  });

  useKeyboardDelete({
    canvas,
    tool,
    socket,
    disabled,
    batchedRenderRef,
    modificationTimeoutsRef
  });

  useEffect(() => {
    if (!canvasRef.current) return;
    return initCanvas(canvasRef.current);
  }, [initCanvas]);

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
