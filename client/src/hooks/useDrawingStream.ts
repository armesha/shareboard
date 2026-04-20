import { useRef, useCallback, type MutableRefObject } from 'react';
import { PencilBrush, type Canvas, type TPointerEvent, type TPointerEventInfo } from 'fabric';
import { v4 as uuidv4 } from 'uuid';
import { SOCKET_EVENTS, TIMING, FABRIC_EVENTS } from '../constants';
import { getWorkspaceId } from '../utils';
import type { Socket } from 'socket.io-client';

interface Point {
  x: number;
  y: number;
}

interface UseDrawingStreamReturn {
  setupDrawingStreamHandlers: (canvas: Canvas) => () => void;
}

export function useDrawingStream(
  socketRef: MutableRefObject<Socket | null>,
  canWriteRef: MutableRefObject<(() => boolean) | null>,
  userIdRef: MutableRefObject<string | null>
): UseDrawingStreamReturn {
  const drawingIdRef = useRef<string | null>(null);
  const lastSentPointIndexRef = useRef(0);
  const drawingStreamThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCurrentlyDrawingRef = useRef(false);

  const setupDrawingStreamHandlers = useCallback((canvas: Canvas) => {
    const emitDrawingStream = () => {
      if (!socketRef.current || !drawingIdRef.current || !canWriteRef.current || !canWriteRef.current()) {
        return;
      }

      const currentBrush = canvas.freeDrawingBrush as PencilBrush & { _points?: Point[] };
      if (!currentBrush || !currentBrush._points || currentBrush._points.length === 0) {
        return;
      }

      const allPoints = currentBrush._points;
      const lastIndex = lastSentPointIndexRef.current;

      if (allPoints.length <= lastIndex) {
        return;
      }

      const newPoints = allPoints.slice(lastIndex).map((point: Point) => ({
        x: point.x,
        y: point.y
      }));

      if (newPoints.length === 0) {
        return;
      }

      const workspaceId = getWorkspaceId();
      if (workspaceId) {
        socketRef.current.emit(SOCKET_EVENTS.DRAWING_STREAM, {
          workspaceId,
          drawingId: drawingIdRef.current,
          points: newPoints
        });
      }

      lastSentPointIndexRef.current = allPoints.length;
    };

    const throttledEmitDrawingStream = () => {
      if (drawingStreamThrottleRef.current) {
        return;
      }

      emitDrawingStream();

      drawingStreamThrottleRef.current = setTimeout(() => {
        drawingStreamThrottleRef.current = null;

        if (isCurrentlyDrawingRef.current) {
          emitDrawingStream();

          if (isCurrentlyDrawingRef.current) {
            throttledEmitDrawingStream();
          }
        }
      }, TIMING.DRAWING_STREAM_THROTTLE);
    };

    const handleDrawingMouseDown = (e: TPointerEventInfo<TPointerEvent>) => {
      if (!canvas.isDrawingMode || !canWriteRef.current || !canWriteRef.current()) {
        return;
      }

      if ((e.e as MouseEvent).button !== 0) {
        return;
      }

      isCurrentlyDrawingRef.current = true;
      drawingIdRef.current = uuidv4();
      lastSentPointIndexRef.current = 0;

      const workspaceId = getWorkspaceId();
      if (workspaceId && socketRef.current) {
        socketRef.current.emit(SOCKET_EVENTS.DRAWING_START, {
          workspaceId,
          drawingId: drawingIdRef.current,
          userId: userIdRef.current,
          color: canvas.freeDrawingBrush?.color,
          brushWidth: canvas.freeDrawingBrush?.width
        });
      }
    };

    const handleDrawingMouseMove = () => {
      if (!isCurrentlyDrawingRef.current || !canvas.isDrawingMode) {
        return;
      }

      throttledEmitDrawingStream();
    };

    const handleDrawingMouseUp = () => {
      if (!isCurrentlyDrawingRef.current) {
        return;
      }

      if (drawingStreamThrottleRef.current) {
        clearTimeout(drawingStreamThrottleRef.current);
        drawingStreamThrottleRef.current = null;
      }

      emitDrawingStream();

      const workspaceId = getWorkspaceId();
      if (workspaceId && socketRef.current && drawingIdRef.current) {
        socketRef.current.emit(SOCKET_EVENTS.DRAWING_END, {
          workspaceId,
          drawingId: drawingIdRef.current
        });
      }

      isCurrentlyDrawingRef.current = false;
      drawingIdRef.current = null;
      lastSentPointIndexRef.current = 0;
    };

    canvas.on(FABRIC_EVENTS.MOUSE_DOWN, handleDrawingMouseDown);
    canvas.on(FABRIC_EVENTS.MOUSE_MOVE, handleDrawingMouseMove);
    canvas.on(FABRIC_EVENTS.MOUSE_UP, handleDrawingMouseUp);

    return () => {
      if (drawingStreamThrottleRef.current) {
        clearTimeout(drawingStreamThrottleRef.current);
        drawingStreamThrottleRef.current = null;
      }
      canvas.off(FABRIC_EVENTS.MOUSE_DOWN, handleDrawingMouseDown);
      canvas.off(FABRIC_EVENTS.MOUSE_MOVE, handleDrawingMouseMove);
      canvas.off(FABRIC_EVENTS.MOUSE_UP, handleDrawingMouseUp);
    };
  }, [socketRef, canWriteRef, userIdRef]);

  return { setupDrawingStreamHandlers };
}
