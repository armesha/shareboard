import { useCallback, type MutableRefObject } from 'react';
import { Path, util, type Canvas } from 'fabric';
import type { Socket } from 'socket.io-client';
import type { DrawingData } from './remoteDrawingTypes';

interface Point {
  x: number;
  y: number;
}

interface DrawingStartEvent {
  drawingId: string;
  userId: string;
  color: string;
  brushWidth: number;
}

interface DrawingStreamEvent {
  drawingId: string;
  points: Point[];
}

interface DrawingEndEvent {
  drawingId: string;
}

function pointsToSvgPath(points: Point[]): string {
  if (!points || points.length === 0) return '';
  if (points.length === 1) {
    return `M ${points[0]!.x} ${points[0]!.y}`;
  }
  if (points.length === 2) {
    return `M ${points[0]!.x} ${points[0]!.y} L ${points[1]!.x} ${points[1]!.y}`;
  }

  let path = `M ${points[0]!.x} ${points[0]!.y}`;

  for (let i = 1; i < points.length - 1; i++) {
    const curr = points[i]!;
    const next = points[i + 1]!;
    const midX = (curr.x + next.x) / 2;
    const midY = (curr.y + next.y) / 2;
    path += ` Q ${curr.x} ${curr.y} ${midX} ${midY}`;
  }

  const last = points[points.length - 1]!;
  path += ` L ${last.x} ${last.y}`;

  return path;
}

interface UseRemotePathDrawingProps {
  canvasRef: MutableRefObject<Canvas | null>;
  socket: Socket | null;
  activeDrawingsRef: MutableRefObject<Map<string, DrawingData>>;
  cleanupTimeoutsRef: MutableRefObject<Set<ReturnType<typeof setTimeout>>>;
  getBatchedRender: () => () => void;
}

export function useRemotePathDrawing({
  canvasRef,
  socket,
  activeDrawingsRef,
  cleanupTimeoutsRef,
  getBatchedRender
}: UseRemotePathDrawingProps) {
  const handleDrawingStart = useCallback((data: DrawingStartEvent) => {
    const { drawingId, userId, color, brushWidth } = data;
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (socket && userId === socket.id) return;

    activeDrawingsRef.current.set(drawingId, {
      fabricPath: null,
      points: [],
      color,
      brushWidth,
      userId,
    });
  }, [canvasRef, socket, activeDrawingsRef]);

  const handleDrawingStream = useCallback((data: DrawingStreamEvent) => {
    const { drawingId, points: newPoints } = data;
    const canvas = canvasRef.current;
    if (!canvas || !newPoints || newPoints.length === 0) return;

    const batchedRender = getBatchedRender();

    let drawingData = activeDrawingsRef.current.get(drawingId);

    if (!drawingData) {
      drawingData = {
        fabricPath: null,
        points: [],
        color: '#000000',
        brushWidth: 2,
      };
      activeDrawingsRef.current.set(drawingId, drawingData);
    }

    drawingData.points.push(...newPoints);

    const svgPathString = pointsToSvgPath(drawingData.points);

    if (drawingData.fabricPath) {
      drawingData.fabricPath.set({
        path: util.parsePath(svgPathString),
        stroke: drawingData.color,
        strokeWidth: drawingData.brushWidth,
      });
      drawingData.fabricPath.setCoords();
    } else {
      const updatedPath = new Path(svgPathString, {
        stroke: drawingData.color,
        strokeWidth: drawingData.brushWidth,
        fill: undefined,
        strokeLineCap: 'round',
        strokeLineJoin: 'round',
        selectable: false,
        evented: false,
        objectCaching: false,
      }) as Path & { _isRemoteDrawing?: boolean; _drawingId?: string };

      updatedPath._isRemoteDrawing = true;
      updatedPath._drawingId = drawingId;

      canvas.add(updatedPath);
      drawingData.fabricPath = updatedPath;
    }

    batchedRender();
  }, [canvasRef, activeDrawingsRef, getBatchedRender]);

  const handleDrawingEnd = useCallback((data: DrawingEndEvent) => {
    const { drawingId } = data;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const batchedRender = getBatchedRender();

    const drawingData = activeDrawingsRef.current.get(drawingId);
    if (!drawingData) return;

    const timeoutId = setTimeout(() => {
      cleanupTimeoutsRef.current.delete(timeoutId);
      if (drawingData.fabricPath && canvasRef.current) {
        canvasRef.current.remove(drawingData.fabricPath);
        batchedRender();
      }
      activeDrawingsRef.current.delete(drawingId);
    }, 100);
    cleanupTimeoutsRef.current.add(timeoutId);
  }, [canvasRef, activeDrawingsRef, cleanupTimeoutsRef, getBatchedRender]);

  return {
    handleDrawingStart,
    handleDrawingStream,
    handleDrawingEnd
  };
}
