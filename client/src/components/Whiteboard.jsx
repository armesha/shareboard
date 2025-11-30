import React, { useEffect, useRef, useCallback, useState } from 'react';
import { fabric } from 'fabric';
import { useWhiteboard } from '../context/WhiteboardContext';
import { useSocket } from '../context/SocketContext';
import { ZoomControls } from './ui';
import { TOOLS, FABRIC_EVENTS, TIMING, CANVAS, ZOOM, KEYBOARD, SOCKET_EVENTS } from '../constants';
import { getWorkspaceId, constrainObjectToBounds } from '../utils';
import { useShapeDrawing } from '../hooks/useShapeDrawing';
import { useLineDrawing } from '../hooks/useLineDrawing';
import { useTextEditing } from '../hooks/useTextEditing';

const Whiteboard = React.memo(function Whiteboard({ disabled = false }) {
  const canvasRef = useRef(null);
  const isUpdatingRef = useRef(false);
  const lastEmitTimeRef = useRef(0);
  const [zoom, setZoom] = useState(1);
  const isPanningRef = useRef(false);
  const lastPanPointRef = useRef(null);
  const isSpacePressedRef = useRef(false);
  const { socket } = useSocket();
  const {
    tool,
    color,
    width,
    selectedShape,
    initCanvas,
    canvasRef: fabricCanvasRef,
    addElement,
    updateElement,
    setTool,
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
    disabled
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
    disabled
  });

  const {
    addText
  } = useTextEditing({
    canvas,
    color,
    addElement,
    setTool
  });

  useEffect(() => {
    if (!canvasRef.current) return;
    return initCanvas(canvasRef.current);
  }, [initCanvas]);

  useEffect(() => {
    if (!canvas) return;

    const handleObjectModification = (e) => {
      if (disabled) {
        if (e.target?.originalState) {
          e.target.set(e.target.originalState);
          canvas.requestRenderAll();
        }
        return;
      }

      const obj = e.target;
      if (!obj || !obj.id || isUpdatingRef.current) return;

      if (obj.modificationTimeout) {
        clearTimeout(obj.modificationTimeout);
      }

      obj.modificationTimeout = setTimeout(() => {
        canvas.suspendDrawing = true;

        try {
          if (obj.type === 'image' && obj.data?.isDiagram) {
            updateElement(obj.id, {
              type: 'diagram',
              data: { ...obj.data, left: obj.left, top: obj.top, scaleX: obj.scaleX, scaleY: obj.scaleY, angle: obj.angle }
            });
          } else if (obj.type === 'text' || obj.type === 'i-text') {
            updateElement(obj.id, {
              type: 'text',
              data: { text: obj.text, left: obj.left, top: obj.top, fontSize: obj.fontSize, fill: obj.fill, angle: obj.angle, scaleX: obj.scaleX, scaleY: obj.scaleY }
            });
          } else {
            updateElement(obj.id, {
              type: obj.type,
              data: { ...obj.toObject(['left', 'top', 'scaleX', 'scaleY', 'angle']), stroke: obj.stroke, strokeWidth: obj.strokeWidth, fill: obj.fill }
            });
          }
        } finally {
          canvas.suspendDrawing = false;
          canvas.requestRenderAll();
        }
      }, TIMING.MOVEMENT_TIMEOUT);
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
    };
  }, [canvas, updateElement, disabled]);

  useEffect(() => {
    if (!canvas) return;

    const handleObjectMoving = (e) => {
      if (disabled || tool !== TOOLS.SELECT) return;

      const obj = e.target;
      if (!obj) return;

      if (obj.type === 'image' && obj.data?.isDiagram) {
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
    if (disabled || !canvas) return;

    const pointer = canvas.getPointer(e.e);

    if (isDrawing.current) {
      updateShape(pointer, e.e.ctrlKey);
      return;
    }

    if (isDrawingLine.current) {
      updateLine(pointer, e.e.shiftKey);
    }
  }, [canvas, disabled, isDrawing, isDrawingLine, updateShape, updateLine]);

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
      if (!obj || !obj.id) return;

      const now = Date.now();
      if (now - lastEmitTimeRef.current < TIMING.MOVEMENT_TIMEOUT) {
        return;
      }
      lastEmitTimeRef.current = now;

      const workspaceId = getWorkspaceId();
      const elementData = obj.type === 'image' && obj.data?.isDiagram
        ? { id: obj.id, type: 'diagram', data: { ...obj.data, left: obj.left, top: obj.top, scaleX: obj.scaleX, scaleY: obj.scaleY, angle: obj.angle } }
        : { id: obj.id, type: obj.type, data: obj.toObject(['id']) };

      socket.emit(SOCKET_EVENTS.WHITEBOARD_UPDATE, { workspaceId, elements: [elementData] });
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
        canvas.defaultCursor = 'default';
        canvas.hoverCursor = 'move';
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
        canvas.defaultCursor = isSpacePressedRef.current ? 'grab' : 'default';
        canvas.selection = true;
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
      setZoom(newZoom);
    };

    const handleContextMenu = (e) => {
      e.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);
    canvas.on('mouse:wheel', handleWheel);
    canvas.upperCanvasEl?.addEventListener('contextmenu', handleContextMenu);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      canvas.off('mouse:down', handleMouseDown);
      canvas.off('mouse:move', handleMouseMove);
      canvas.off('mouse:up', handleMouseUp);
      canvas.off('mouse:wheel', handleWheel);
      canvas.upperCanvasEl?.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [canvas]);

  const handleZoomChange = useCallback((newZoom) => {
    setZoom(newZoom);
    if (canvas) {
      const center = canvas.getCenter();
      canvas.zoomToPoint({ x: center.left, y: center.top }, newZoom);
      canvas.requestRenderAll();
    }
  }, [canvas]);

  return (
    <>
      <div className={`relative w-full h-full canvas-grid ${disabled ? 'cursor-not-allowed' : ''}`}>
        <canvas
          ref={canvasRef}
          style={{
            pointerEvents: disabled ? 'none' : 'auto',
            userSelect: disabled ? 'none' : 'auto'
          }}
        />
        {disabled && (
          <>
            <div
              className="absolute inset-0 bg-transparent z-10"
              title="Read-only mode"
              aria-hidden="true"
            />
            <div
              className="absolute bottom-4 left-4 z-20 bg-yellow-50 text-yellow-700 px-3 py-2 rounded-md shadow-md border border-yellow-200 flex items-center opacity-70"
              role="status"
              aria-live="polite"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              View Only Mode
            </div>
          </>
        )}
        <ZoomControls zoom={zoom} onZoomChange={handleZoomChange} />
      </div>
    </>
  );
});

export default Whiteboard;
