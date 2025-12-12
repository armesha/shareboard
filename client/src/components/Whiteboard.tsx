import React, { useEffect, useRef, useCallback } from 'react';
import type { Canvas, FabricObject, TPointerEvent, TPointerEventInfo } from 'fabric';
import { useWhiteboard } from '../context/WhiteboardContext';
import { useSocket } from '../context/SocketContext';
import { useSharing } from '../context/SharingContext';
import { TOOLS, FABRIC_EVENTS, CANVAS, SOCKET_EVENTS } from '../constants';
import { constrainObjectToBounds, getWorkspaceId } from '../utils';
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
  const currentUserId = sharingContext?.currentUser ?? null;
  const textLocksRef = useRef<Record<string, string>>({});
  const localEditingIdRef = useRef<string | null>(null);
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

  // Sync text edit locks from server and disable editing for locked objects
  useEffect(() => {
    if (!socket || !canvas) return;

    const handleLocks = ({ workspaceId, locks }: { workspaceId: string; locks: Record<string, string> }) => {
      const currentWorkspaceId = getWorkspaceId();
      if (workspaceId !== currentWorkspaceId) return;

      textLocksRef.current = locks || {};

      canvas.getObjects().forEach((obj) => {
        const anyObj = obj as unknown as { id?: string; type?: string; editable?: boolean; isEditing?: boolean; exitEditing?: () => void };
        if (anyObj.type !== 'text' && anyObj.type !== 'i-text') return;
        const id = anyObj.id;
        if (!id) return;
        const lockedBy = textLocksRef.current[id];
        const lockedByOther = !!lockedBy && lockedBy !== currentUserId;
        anyObj.editable = canWrite() && !lockedByOther;

        if (lockedByOther && localEditingIdRef.current === id && anyObj.isEditing) {
          anyObj.exitEditing?.();
          canvas.discardActiveObject();
        }
      });

      if (batchedRenderRef.current) {
        batchedRenderRef.current();
      }
    };

    socket.on(SOCKET_EVENTS.TEXT_EDIT_LOCKS, handleLocks);
    return () => {
      socket.off(SOCKET_EVENTS.TEXT_EDIT_LOCKS, handleLocks);
    };
  }, [socket, canvas, canWrite, batchedRenderRef, currentUserId]);

  // Emit lock/unlock when entering/exiting text editing
  useEffect(() => {
    if (!socket || !canvas) return;

    const handleEditingEntered = (e: { target?: FabricObject | null }) => {
      const target = e.target as unknown as { id?: string; type?: string; exitEditing?: () => void };
      if (!target?.id || (target.type !== 'text' && target.type !== 'i-text')) return;
      const id = target.id;
      const lockedBy = textLocksRef.current[id];

      if (lockedBy && lockedBy !== currentUserId) {
        target.exitEditing?.();
        canvas.discardActiveObject();
        if (batchedRenderRef.current) batchedRenderRef.current();
        return;
      }

      localEditingIdRef.current = id;
      const workspaceId = getWorkspaceId();
      if (workspaceId) {
        socket.emit(SOCKET_EVENTS.TEXT_EDIT_START, { workspaceId, elementId: id });
      }
    };

    const handleEditingExited = (e: { target?: FabricObject | null }) => {
      const target = e.target as unknown as { id?: string; type?: string };
      const id = target?.id || localEditingIdRef.current;
      if (!id) return;

      // Commit final text once on exit (no streaming updates).
      const obj = canvas.getObjects().find((o) => (o as unknown as { id?: string }).id === id) as unknown as {
        id?: string;
        type?: string;
        text?: string;
        fontSize?: number;
        fill?: string;
        fontFamily?: string;
        left?: number;
        top?: number;
        scaleX?: number;
        scaleY?: number;
        angle?: number;
      } | undefined;

      if (obj && (obj.type === 'text' || obj.type === 'i-text') && obj.id) {
        updateElement(obj.id, {
          id: obj.id,
          type: 'text',
          data: {
            text: obj.text || '',
            fontSize: obj.fontSize,
            fill: obj.fill,
            fontFamily: obj.fontFamily,
            left: obj.left,
            top: obj.top,
            scaleX: obj.scaleX,
            scaleY: obj.scaleY,
            angle: obj.angle
          }
        });
      }

      localEditingIdRef.current = null;
      const workspaceId = getWorkspaceId();
      if (workspaceId) {
        socket.emit(SOCKET_EVENTS.TEXT_EDIT_END, { workspaceId, elementId: id });
      }
    };

    canvas.on('text:editing:entered', handleEditingEntered as unknown as (e: unknown) => void);
    canvas.on('text:editing:exited', handleEditingExited as unknown as (e: unknown) => void);

    return () => {
      canvas.off('text:editing:entered', handleEditingEntered as unknown as (e: unknown) => void);
      canvas.off('text:editing:exited', handleEditingExited as unknown as (e: unknown) => void);
    };
  }, [socket, canvas, currentUserId, batchedRenderRef, updateElement]);

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
