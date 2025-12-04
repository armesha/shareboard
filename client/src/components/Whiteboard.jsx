import React, { useEffect, useRef, useCallback } from 'react';
import { fabric } from 'fabric';
import { useWhiteboard } from '../context/WhiteboardContext';
import { useSocket } from '../context/SocketContext';
import { useSharing } from '../context/SharingContext';
import { TOOLS, FABRIC_EVENTS, TIMING, CANVAS, ZOOM, SOCKET_EVENTS } from '../constants';
import { getWorkspaceId, constrainObjectToBounds } from '../utils';
import { getAbsolutePosition } from '../utils/fabricHelpers';
import { useShapeDrawing } from '../hooks/useShapeDrawing';
import { useLineDrawing } from '../hooks/useLineDrawing';
import { useTextEditing } from '../hooks/useTextEditing';

const Whiteboard = React.memo(function Whiteboard({ disabled = false, onCursorMove }) {
  const canvasRef = useRef(null);
  const isUpdatingRef = useRef(false);
  const lastEmitTimeRef = useRef(0);
  const isPanningRef = useRef(false);
  const lastPanPointRef = useRef(null);
  const isSpacePressedRef = useRef(false);
  const modificationTimeoutsRef = useRef(new Set());
  const { socket } = useSocket();
  const { canWrite } = useSharing() || { canWrite: () => false };
  const {
    tool,
    color,
    width,
    fontSize,
    selectedShape,
    initCanvas,
    canvasRef: fabricCanvasRef,
    addElement,
    updateElement,
    setTool,
    setZoomState,
  } = useWhiteboard();

  const canvas = fabricCanvasRef.current;

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

    const handleObjectModification = (e) => {
      if (disabled) {
        if (e.target?.originalState) {
          e.target.set(e.target.originalState);
          canvas.requestRenderAll();
        }
        return;
      }

      const obj = e.target;
      if (!obj || isUpdatingRef.current) return;

      const isActiveSelection = obj.type === 'activeSelection';
      const objectsToUpdate = isActiveSelection ? obj.getObjects() : [obj];

      objectsToUpdate.forEach(item => {
        if (!item.id) return;

        if (item.modificationTimeout) {
          clearTimeout(item.modificationTimeout);
        }

        let absoluteLeft = item.left;
        let absoluteTop = item.top;

        if (isActiveSelection) {
          const absPos = getAbsolutePosition(item, obj);
          absoluteLeft = absPos.left;
          absoluteTop = absPos.top;
        }

        const capturedLeft = absoluteLeft;
        const capturedTop = absoluteTop;

        const timeoutId = setTimeout(() => {
          modificationTimeoutsRef.current.delete(timeoutId);
          canvas.suspendDrawing = true;

          try {
            if (item.type === 'diagram' || (item.type === 'image' && item.data?.isDiagram)) {
              updateElement(item.id, {
                type: 'diagram',
                data: { ...item.data, left: capturedLeft, top: capturedTop, scaleX: item.scaleX, scaleY: item.scaleY, angle: item.angle }
              });
            } else if (item.type === 'text' || item.type === 'i-text') {
              updateElement(item.id, {
                type: 'text',
                data: { text: item.text, left: capturedLeft, top: capturedTop, fontSize: item.fontSize, fill: item.fill, angle: item.angle, scaleX: item.scaleX, scaleY: item.scaleY }
              });
            } else {
              updateElement(item.id, {
                type: item.type,
                data: { ...item.toObject(['left', 'top', 'scaleX', 'scaleY', 'angle']), left: capturedLeft, top: capturedTop, stroke: item.stroke, strokeWidth: item.strokeWidth, fill: item.fill }
              });
            }
          } finally {
            canvas.suspendDrawing = false;
            canvas.requestRenderAll();
          }
        }, TIMING.MOVEMENT_TIMEOUT);
        item.modificationTimeout = timeoutId;
        modificationTimeoutsRef.current.add(timeoutId);
      });
    };

    canvas.on(FABRIC_EVENTS.OBJECT_MODIFIED, handleObjectModification);
    canvas.on(FABRIC_EVENTS.OBJECT_MOVING, handleObjectModification);
    canvas.on(FABRIC_EVENTS.OBJECT_SCALING, handleObjectModification);
    canvas.on(FABRIC_EVENTS.OBJECT_ROTATING, handleObjectModification);
    canvas.on(FABRIC_EVENTS.TEXT_CHANGED, handleObjectModification);

    return () => {
      canvas.off(FABRIC_EVENTS.OBJECT_MODIFIED, handleObjectModification);
      canvas.off(FABRIC_EVENTS.OBJECT_MOVING, handleObjectModification);
      canvas.off(FABRIC_EVENTS.OBJECT_SCALING, handleObjectModification);
      canvas.off(FABRIC_EVENTS.OBJECT_ROTATING, handleObjectModification);
      canvas.off(FABRIC_EVENTS.TEXT_CHANGED, handleObjectModification);
      timeoutsSet.forEach(clearTimeout);
      timeoutsSet.clear();
    };
  }, [canvas, updateElement, disabled]);

  useEffect(() => {
    if (!canvas) return;

    const handleObjectMoving = (e) => {
      if (disabled || tool !== TOOLS.SELECT) return;

      const obj = e.target;
      if (!obj) return;

      if (obj.type === 'diagram' || (obj.type === 'image' && obj.data?.isDiagram)) {
        obj.lockMovementX = false;
        obj.lockMovementY = false;
      }
    };

    const handleObjectMoved = (e) => {
      if (disabled || tool !== TOOLS.SELECT) return;

      const obj = e.target;
      if (!obj) return;

      constrainObjectToBounds(obj, canvas, CANVAS.EDGE_BUFFER);
    };

    const handleMouseDown = (e) => {
      if (disabled) {
        canvas.selection = false;
        return;
      }
      if (e.target) {
        e.target.originalState = { left: e.target.left, top: e.target.top };
      }
    };

    canvas.on(FABRIC_EVENTS.OBJECT_MOVING, handleObjectMoving);
    canvas.on(FABRIC_EVENTS.OBJECT_MOVED, handleObjectMoved);
    canvas.on(FABRIC_EVENTS.MOUSE_DOWN, handleMouseDown);

    return () => {
      canvas.off(FABRIC_EVENTS.OBJECT_MOVING, handleObjectMoving);
      canvas.off(FABRIC_EVENTS.OBJECT_MOVED, handleObjectMoved);
      canvas.off(FABRIC_EVENTS.MOUSE_DOWN, handleMouseDown);
    };
  }, [canvas, tool, disabled]);

  useEffect(() => {
    if (!canvas) return;

    const handleKeyDown = (e) => {
      if (disabled || e.key !== 'Delete' || tool !== TOOLS.SELECT) return;

      const activeObjects = canvas.getActiveObjects();
      if (activeObjects.length === 0) return;

      const workspaceId = getWorkspaceId();
      activeObjects.forEach(obj => {
        if (obj.id) {
          canvas.remove(obj);
          socket?.emit(SOCKET_EVENTS.DELETE_ELEMENT, { workspaceId, elementId: obj.id });
        }
      });

      canvas.discardActiveObject();
      canvas.requestRenderAll();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canvas, tool, socket, disabled]);



  const handleMouseDown = useCallback((e) => {
    if (disabled || !canvas) return;
    if (e.e.button !== 0) return;

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

  const handleMouseMove = useCallback((e) => {
    if (!canvas) return;

    const pointer = canvas.getPointer(e.e);

    if (onCursorMove) {
      onCursorMove(pointer.x, pointer.y);
    }

    if (disabled) return;

    if (isDrawing.current) {
      updateShape(pointer, e.e.ctrlKey);
      return;
    }

    if (isDrawingLine.current) {
      updateLine(pointer, e.e.shiftKey);
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
      canvas.requestRenderAll();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [canvas]);

  useEffect(() => {
    if (!canvas || !socket) return;

    const handleSocketEmit = (e) => {
      const obj = e.target;
      if (!obj) return;

      const now = Date.now();
      if (now - lastEmitTimeRef.current < TIMING.MOVEMENT_TIMEOUT) {
        return;
      }
      lastEmitTimeRef.current = now;

      const workspaceId = getWorkspaceId();

      const isActiveSelection = obj.type === 'activeSelection';
      const objectsToSync = isActiveSelection ? obj.getObjects() : [obj];

      const elements = objectsToSync
        .filter(item => item.id)
        .map(item => {
          let absoluteLeft = item.left;
          let absoluteTop = item.top;

          if (isActiveSelection) {
            const absPos = getAbsolutePosition(item, obj);
            absoluteLeft = absPos.left;
            absoluteTop = absPos.top;
          }

          const isDiagram = item.type === 'diagram' || (item.type === 'image' && item.data?.isDiagram);
          if (isDiagram) {
            return {
              id: item.id,
              type: 'diagram',
              data: { ...item.data, left: absoluteLeft, top: absoluteTop, scaleX: item.scaleX, scaleY: item.scaleY, angle: item.angle }
            };
          }

          const objData = item.toObject(['id']);
          objData.left = absoluteLeft;
          objData.top = absoluteTop;
          return { id: item.id, type: item.type, data: objData };
        });

      if (elements.length > 0) {
        socket.emit(SOCKET_EVENTS.WHITEBOARD_UPDATE, { workspaceId, elements });
      }
    };

    canvas.on(FABRIC_EVENTS.OBJECT_MOVING, handleSocketEmit);
    return () => canvas.off(FABRIC_EVENTS.OBJECT_MOVING, handleSocketEmit);
  }, [canvas, socket]);

  useEffect(() => {
    if (!canvas) return;

    const handleKeyDown = (e) => {
      if (e.code === 'Space' && !e.repeat) {
        isSpacePressedRef.current = true;
        canvas.defaultCursor = 'grab';
        canvas.hoverCursor = 'grab';
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        isSpacePressedRef.current = false;
        isPanningRef.current = false;
        const cursorValue = tool === TOOLS.SELECT ? CANVAS.CUSTOM_CURSOR : 'crosshair';
        canvas.defaultCursor = cursorValue;
        canvas.hoverCursor = cursorValue;
      }
    };

    const handleMouseDown = (opt) => {
      if (isSpacePressedRef.current || opt.e.button === 1 || opt.e.button === 2) {
        isPanningRef.current = true;
        canvas.defaultCursor = 'grabbing';
        lastPanPointRef.current = { x: opt.e.clientX, y: opt.e.clientY };
        canvas.selection = false;
        if (opt.e.button === 2) {
          opt.e.preventDefault();
        }
      }
    };

    const handleMouseMove = (opt) => {
      if (!isPanningRef.current || !lastPanPointRef.current) return;

      const deltaX = opt.e.clientX - lastPanPointRef.current.x;
      const deltaY = opt.e.clientY - lastPanPointRef.current.y;

      const vpt = canvas.viewportTransform;
      vpt[4] += deltaX;
      vpt[5] += deltaY;

      canvas.requestRenderAll();
      lastPanPointRef.current = { x: opt.e.clientX, y: opt.e.clientY };
    };

    const handleMouseUp = () => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        const defaultCursor = tool === TOOLS.SELECT ? CANVAS.CUSTOM_CURSOR : 'crosshair';
        canvas.defaultCursor = isSpacePressedRef.current ? 'grab' : defaultCursor;
        canvas.selection = tool === TOOLS.SELECT;
      }
    };

    const handleWheel = (opt) => {
      opt.e.preventDefault();
      opt.e.stopPropagation();

      const delta = opt.e.deltaY;
      const multiplier = delta > 0 ? ZOOM.WHEEL_OUT_MULTIPLIER : ZOOM.WHEEL_IN_MULTIPLIER;
      let newZoom = canvas.getZoom() * multiplier;
      newZoom = Math.min(Math.max(newZoom, ZOOM.MIN), ZOOM.MAX);

      const point = new fabric.Point(opt.e.offsetX, opt.e.offsetY);
      canvas.zoomToPoint(point, newZoom);
      canvas.requestRenderAll();
      setZoomState(newZoom);
    };

    const handleContextMenu = (e) => {
      e.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    canvas.on(FABRIC_EVENTS.MOUSE_DOWN, handleMouseDown);
    canvas.on(FABRIC_EVENTS.MOUSE_MOVE, handleMouseMove);
    canvas.on(FABRIC_EVENTS.MOUSE_UP, handleMouseUp);
    canvas.on(FABRIC_EVENTS.MOUSE_WHEEL, handleWheel);
    canvas.upperCanvasEl?.addEventListener('contextmenu', handleContextMenu);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      canvas.off(FABRIC_EVENTS.MOUSE_DOWN, handleMouseDown);
      canvas.off(FABRIC_EVENTS.MOUSE_MOVE, handleMouseMove);
      canvas.off(FABRIC_EVENTS.MOUSE_UP, handleMouseUp);
      canvas.off(FABRIC_EVENTS.MOUSE_WHEEL, handleWheel);
      canvas.upperCanvasEl?.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [canvas, setZoomState, tool]);

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
