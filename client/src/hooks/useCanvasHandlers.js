import { useCallback, useRef, useEffect } from 'react';
import { FABRIC_EVENTS, TOOLS, INTERACTIVE_TYPES, TIMING, SOCKET_EVENTS, CANVAS } from '../constants';
import { getWorkspaceId } from '../utils';

export function useCanvasObjectHandlers({
  canvas,
  tool,
  disabled,
  updateElement,
  addElement,
  socket
}) {
  const isUpdatingRef = useRef(false);
  const lastPanTimeRef = useRef(0);
  const panAnimationRef = useRef(null);

  const handleObjectModification = useCallback((e) => {
    if (disabled) {
      if (e.target?.originalState) {
        e.target.set(e.target.originalState);
        canvas?.renderAll();
      }
      return;
    }

    const obj = e.target;
    if (!obj || !obj.id || isUpdatingRef.current) return;

    if (obj.modificationTimeout) {
      clearTimeout(obj.modificationTimeout);
    }

    obj.modificationTimeout = setTimeout(() => {
      if (!canvas) return;
      canvas.suspendDrawing = true;

      try {
        if (obj.type === 'image' && obj.data?.isDiagram) {
          updateElement(obj.id, {
            type: 'diagram',
            data: {
              ...obj.data,
              src: obj.data.src,
              left: obj.left,
              top: obj.top,
              scaleX: obj.scaleX,
              scaleY: obj.scaleY,
              angle: obj.angle
            }
          });
        } else if (obj.type === 'text' || obj.type === 'i-text') {
          const data = {
            text: obj.text,
            left: obj.left,
            top: obj.top,
            fontSize: obj.fontSize,
            fill: obj.fill,
            angle: obj.angle,
            scaleX: obj.scaleX,
            scaleY: obj.scaleY,
            selectable: true,
            hasControls: true,
            hasBorders: true
          };
          updateElement(obj.id, { type: 'text', data });

          if (e.transform?.action === 'drag' || e.transform?.action === 'scale') {
            addElement({ id: obj.id, type: 'text', data });
          }
        } else {
          const data = {
            ...obj.toObject(['left', 'top', 'scaleX', 'scaleY', 'angle']),
            stroke: obj.stroke,
            strokeWidth: obj.strokeWidth,
            fill: obj.fill
          };
          updateElement(obj.id, { type: obj.type, data });
        }
      } finally {
        canvas.suspendDrawing = false;
        canvas.requestRenderAll();
      }
    }, TIMING.MOVEMENT_TIMEOUT);
  }, [canvas, disabled, updateElement, addElement]);

  const handleObjectMoving = useCallback((e) => {
    if (disabled || tool !== TOOLS.SELECT) {
      if (e.target?.originalState) {
        e.target.set({
          left: e.target.originalState.left,
          top: e.target.originalState.top
        });
        canvas?.renderAll();
      }
      return;
    }

    const obj = e.target;
    if (!obj || !canvas) return;

    if (obj.type === 'image' && obj.data?.isDiagram) {
      obj.lockMovementX = false;
      obj.lockMovementY = false;
      obj.selectable = true;
      obj.evented = true;
    }

    obj.selectable = true;
    obj.evented = true;

    const now = Date.now();
    if (now - lastPanTimeRef.current < CANVAS.AUTO_PAN_INTERVAL) {
      return;
    }

    const pointer = canvas.getPointer(e.e, true);
    const canvasWidth = canvas.getWidth();
    const canvasHeight = canvas.getHeight();
    const edge = CANVAS.AUTO_PAN_EDGE;
    const speed = CANVAS.AUTO_PAN_SPEED;

    let panX = 0;
    let panY = 0;

    if (pointer.x < edge) {
      panX = speed;
    } else if (pointer.x > canvasWidth - edge) {
      panX = -speed;
    }

    if (pointer.y < edge) {
      panY = speed;
    } else if (pointer.y > canvasHeight - edge) {
      panY = -speed;
    }

    if (panX !== 0 || panY !== 0) {
      lastPanTimeRef.current = now;

      if (panAnimationRef.current) {
        cancelAnimationFrame(panAnimationRef.current);
      }

      panAnimationRef.current = requestAnimationFrame(() => {
        if (!canvas) return;

        const vpt = canvas.viewportTransform.slice();
        vpt[4] += panX;
        vpt[5] += panY;

        canvas.setViewportTransform(vpt);

        obj.left -= panX / canvas.getZoom();
        obj.top -= panY / canvas.getZoom();
        obj.setCoords();
        canvas.calcOffset();
      });
    }
  }, [canvas, tool, disabled]);

  const handleMouseDown = useCallback((e) => {
    if (disabled) {
      if (canvas) {
        canvas.selection = false;
      }
      if (e.target) {
        e.target.selectable = false;
        e.target.evented = false;
      }
      return;
    }

    if (e.target) {
      e.target.originalState = {
        left: e.target.left,
        top: e.target.top
      };
    }
  }, [canvas, disabled]);

  const handleSocketEmit = useCallback((e) => {
    const obj = e.target;
    if (!obj || !obj.id || !socket) return;

    const workspaceId = getWorkspaceId();
    if (!workspaceId) return;

    const elementData = obj.type === 'image' && obj.data?.isDiagram ? {
      id: obj.id,
      type: 'diagram',
      data: {
        ...obj.data,
        left: obj.left,
        top: obj.top,
        scaleX: obj.scaleX,
        scaleY: obj.scaleY,
        angle: obj.angle
      }
    } : {
      id: obj.id,
      type: obj.type,
      data: obj.toObject(['id'])
    };

    socket.emit(SOCKET_EVENTS.WHITEBOARD_UPDATE, {
      workspaceId,
      elements: [elementData]
    });
  }, [socket]);

  return {
    handleObjectModification,
    handleObjectMoving,
    handleMouseDown,
    handleSocketEmit,
    isUpdatingRef
  };
}

export function useCanvasKeyboardHandlers({ canvas, tool, socket, disabled }) {
  useEffect(() => {
    if (!canvas) return;

    const handleKeyDown = (e) => {
      if (disabled) return;

      if (e.key === 'Delete' && tool === TOOLS.SELECT) {
        const activeObjects = canvas.getActiveObjects();
        if (activeObjects.length > 0) {
          const workspaceId = getWorkspaceId();

          activeObjects.forEach(obj => {
            if (obj.id) {
              canvas.remove(obj);
              if (socket) {
                socket.emit(SOCKET_EVENTS.DELETE_ELEMENT, {
                  workspaceId,
                  elementId: obj.id
                });
              }
            }
          });

          canvas.discardActiveObject();
          canvas.requestRenderAll();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canvas, tool, socket, disabled]);
}

export function useCanvasResize(canvas) {
  useEffect(() => {
    if (!canvas) return;

    const handleResize = () => {
      const container = canvas.wrapperEl?.parentElement;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      canvas.setDimensions({
        width: rect.width,
        height: rect.height
      });
      canvas.requestRenderAll();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [canvas]);
}

export function useObjectSelectability({ canvas, tool, disabled, canWrite }) {
  useEffect(() => {
    if (!canvas) return;

    let needRerender = false;
    canvas.suspendDrawing = true;

    try {
      const shouldBeDrawing = tool === TOOLS.PEN;
      const shouldBeSelection = tool === TOOLS.SELECT && !disabled;
      const isTextMode = tool === TOOLS.TEXT;

      if (canvas.isDrawingMode !== shouldBeDrawing) {
        canvas.isDrawingMode = shouldBeDrawing;
        needRerender = true;
      }

      if (canvas.selection !== shouldBeSelection) {
        canvas.selection = shouldBeSelection;
        needRerender = true;
      }

      canvas.getObjects().forEach(obj => {
        const isInteractive = INTERACTIVE_TYPES.includes(obj.type);
        const shouldBeSelectable = shouldBeSelection && isInteractive && !disabled;
        const shouldBeEvented = (shouldBeSelection || (isTextMode && (obj.type === 'text' || obj.type === 'i-text'))) && !disabled;

        const newProps = {
          selectable: shouldBeSelectable,
          evented: shouldBeEvented,
          hasControls: shouldBeSelectable,
          hasBorders: shouldBeSelectable,
          lockMovementX: !shouldBeSelectable,
          lockMovementY: !shouldBeSelectable,
          lockRotation: !shouldBeSelectable,
          lockScalingX: !shouldBeSelectable,
          lockScalingY: !shouldBeSelectable
        };

        const changed = Object.keys(newProps).some(key => obj[key] !== newProps[key]);
        if (changed) {
          obj.set(newProps);
          needRerender = true;
        }
      });
    } finally {
      canvas.suspendDrawing = false;
      if (needRerender) {
        canvas.requestRenderAll();
      }
    }
  }, [canvas, tool, disabled, canWrite]);
}
