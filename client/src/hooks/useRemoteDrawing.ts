import { useEffect, useRef, useCallback, type MutableRefObject } from 'react';
import type { Canvas } from 'fabric';
import { SOCKET_EVENTS } from '../constants';
import { createBatchedRender } from '../utils/batchedRender';
import { useRemotePathDrawing } from './useRemotePathDrawing';
import { useRemoteShapeDrawing } from './useRemoteShapeDrawing';
import type { DrawingData } from './remoteDrawingTypes';
import type { Socket } from 'socket.io-client';

export function useRemoteDrawing(socket: Socket | null, canvasRef: MutableRefObject<Canvas | null>): void {
  const activeDrawingsRef = useRef<Map<string, DrawingData>>(new Map());
  const batchedRenderRef = useRef<((() => void) & { _canvas?: Canvas }) | null>(null);
  const cleanupTimeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const getBatchedRender = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return () => {};
    if (!batchedRenderRef.current || batchedRenderRef.current._canvas !== canvas) {
      const render = createBatchedRender(canvas) as (() => void) & { _canvas?: Canvas };
      render._canvas = canvas;
      batchedRenderRef.current = render;
    }
    return batchedRenderRef.current;
  }, [canvasRef]);

  const {
    handleDrawingStart,
    handleDrawingStream,
    handleDrawingEnd
  } = useRemotePathDrawing({
    canvasRef,
    socket,
    activeDrawingsRef,
    cleanupTimeoutsRef,
    getBatchedRender
  });

  const {
    handleShapeDrawingStart,
    handleShapeDrawingUpdate,
    handleShapeDrawingEnd
  } = useRemoteShapeDrawing({
    canvasRef,
    socket,
    activeDrawingsRef,
    cleanupTimeoutsRef,
    getBatchedRender
  });

  useEffect(() => {
    if (!socket) return;

    const canvasInstance = canvasRef.current;
    const activeDrawings = activeDrawingsRef.current;
    const batchedRender = getBatchedRender();

    socket.on(SOCKET_EVENTS.DRAWING_START, handleDrawingStart);
    socket.on(SOCKET_EVENTS.DRAWING_STREAM, handleDrawingStream);
    socket.on(SOCKET_EVENTS.DRAWING_END, handleDrawingEnd);
    socket.on(SOCKET_EVENTS.SHAPE_DRAWING_START, handleShapeDrawingStart);
    socket.on(SOCKET_EVENTS.SHAPE_DRAWING_UPDATE, handleShapeDrawingUpdate);
    socket.on(SOCKET_EVENTS.SHAPE_DRAWING_END, handleShapeDrawingEnd);

    return () => {
      socket.off(SOCKET_EVENTS.DRAWING_START, handleDrawingStart);
      socket.off(SOCKET_EVENTS.DRAWING_STREAM, handleDrawingStream);
      socket.off(SOCKET_EVENTS.DRAWING_END, handleDrawingEnd);
      socket.off(SOCKET_EVENTS.SHAPE_DRAWING_START, handleShapeDrawingStart);
      socket.off(SOCKET_EVENTS.SHAPE_DRAWING_UPDATE, handleShapeDrawingUpdate);
      socket.off(SOCKET_EVENTS.SHAPE_DRAWING_END, handleShapeDrawingEnd);

      cleanupTimeoutsRef.current.forEach(clearTimeout);
      cleanupTimeoutsRef.current.clear();

      if (canvasInstance) {
        activeDrawings.forEach((drawingData) => {
          if (drawingData.fabricPath) {
            canvasInstance.remove(drawingData.fabricPath);
          }
          if (drawingData.fabricShape) {
            canvasInstance.remove(drawingData.fabricShape);
          }
        });
        batchedRender();
      }
      activeDrawings.clear();
    };
  }, [socket, canvasRef, handleDrawingStart, handleDrawingStream, handleDrawingEnd, handleShapeDrawingStart, handleShapeDrawingUpdate, handleShapeDrawingEnd, getBatchedRender]);
}
