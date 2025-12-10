import { useEffect, useRef } from 'react';
import { Point, type Canvas, type TPointerEvent, type TPointerEventInfo } from 'fabric';
import { TOOLS, FABRIC_EVENTS, CANVAS, ZOOM } from '../constants';

interface WheelEventInfo {
  e: WheelEvent;
}

interface UseCanvasPanningProps {
  canvas: Canvas | null;
  tool: string;
  setZoomState: (zoom: number) => void;
  batchedRenderRef: React.MutableRefObject<(() => void) | null>;
}

export function useCanvasPanning({
  canvas,
  tool,
  setZoomState,
  batchedRenderRef
}: UseCanvasPanningProps) {
  const isPanningRef = useRef(false);
  const lastPanPointRef = useRef<{ x: number; y: number } | null>(null);
  const isSpacePressedRef = useRef(false);

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

  return { isPanningRef, isSpacePressedRef };
}
