import { useCallback } from 'react';
import { IText, type Canvas } from 'fabric';
import { v4 as uuidv4 } from 'uuid';
import { SOCKET_EVENTS, TOOLS, CANVAS, type Tool } from '../constants';
import type { Socket } from 'socket.io-client';
import { createBatchedRender } from '../utils/batchedRender';

interface TextElementData {
  id: string;
  type: 'text';
  data: {
    text: string;
    left: number;
    top: number;
    fontSize: number;
    fill: string;
    fontFamily: string;
    selectable: boolean;
    hasControls: boolean;
    hasBorders: boolean;
  };
}

interface UseCodeToCanvasProps {
  codeContent: string;
  canvasRef: { current: Canvas | null };
  addElement: (element: TextElementData) => void;
  setTool: (tool: Tool) => void;
  socket: Socket | null;
  workspaceId: string;
  onSuccess: () => void;
  onError: () => void;
}

function calculateTextPosition(canvas: Canvas | null): { centerX: number; centerY: number } {
  if (canvas) {
    const vpt = canvas.viewportTransform;
    const currentZoom = canvas.getZoom();
    const canvasWidth = canvas.getWidth();
    const canvasHeight = canvas.getHeight();

    const visibleCenterX = (-vpt![4] + canvasWidth / 2) / currentZoom;
    const visibleCenterY = (-vpt![5] + canvasHeight / 2) / currentZoom;

    return {
      centerX: visibleCenterX - 200,
      centerY: visibleCenterY - 100
    };
  }

  return {
    centerX: 100,
    centerY: 100
  };
}

export function useCodeToCanvas({
  codeContent,
  canvasRef,
  addElement,
  setTool,
  socket,
  workspaceId,
  onSuccess,
  onError
}: UseCodeToCanvasProps) {
  return useCallback(() => {
    try {
      const canvas = canvasRef.current;
      if (!canvas || !codeContent.trim()) {
        onError();
        return;
      }

      const batchedRender = createBatchedRender(canvas);
      const { centerX, centerY } = calculateTextPosition(canvas);
      const currentZoom = canvas.getZoom();
      const fontSize = 14 / currentZoom;

      const textId = uuidv4();
      const textObj = new IText(codeContent, {
        left: centerX,
        top: centerY,
        fontSize,
        fill: '#1f2937',
        selectable: true,
        hasControls: true,
        hasBorders: true,
        fontFamily: CANVAS.CODE_FONT_FAMILY,
      });

      (textObj as unknown as { id: string }).id = textId;

      canvas.add(textObj);
      canvas.setActiveObject(textObj);

      const elementData: TextElementData = {
        id: textId,
        type: 'text',
        data: {
          text: codeContent,
          left: centerX,
          top: centerY,
          fontSize,
          fill: '#1f2937',
          fontFamily: CANVAS.CODE_FONT_FAMILY,
          selectable: true,
          hasControls: true,
          hasBorders: true
        }
      };

      addElement(elementData);

      if (socket && workspaceId) {
        socket.emit(SOCKET_EVENTS.WHITEBOARD_UPDATE, { workspaceId, elements: [elementData] });
      }

      setTool(TOOLS.SELECT);
      batchedRender();
      onSuccess();
    } catch (error) {
      console.error('Failed to add code to canvas:', error);
      onError();
    }
  }, [codeContent, canvasRef, addElement, setTool, socket, workspaceId, onSuccess, onError]);
}
