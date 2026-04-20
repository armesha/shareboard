import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { DIAGRAM_POSITION, MERMAID_THEME, SOCKET_EVENTS, TOOLS, type Tool } from '../constants';
import { loadMermaid } from '../utils/mermaid';
import type { Socket } from 'socket.io-client';
import type { Canvas } from 'fabric';

interface MermaidInstance {
  render: (id: string, content: string) => Promise<{ svg: string }>;
}

interface DiagramElementData {
  id: string;
  type: 'diagram';
  data: {
    src: string;
    left: number;
    top: number;
    scaleX: number;
    scaleY: number;
    angle: number;
    isDiagram: boolean;
    originalWidth: number;
    originalHeight: number;
  };
}

interface UseDiagramToCanvasProps {
  diagramContent: string;
  canvasRef: { current: Canvas | null };
  addElement: (element: DiagramElementData) => void;
  setTool: (tool: Tool) => void;
  socket: Socket | null;
  workspaceId: string;
  onSuccess: () => void;
  onError: () => void;
}

function processSvgForTransparency(svg: string): string {
  return svg
    .replace(/\.labelBkg\s*\{[^}]*background-color:[^}]*\}/gi, '.labelBkg{background-color:transparent;}')
    .replace(/fill="white"/g, 'fill="rgba(240, 245, 255, 0.7)"')
    .replace(/fill="#ffffff"/gi, 'fill="rgba(240, 245, 255, 0.7)"')
    .replace(/fill="#fff"/gi, 'fill="rgba(240, 245, 255, 0.7)"')
    .replace(/<rect.*?class="background".*?\/>/g, '')
    .replace(/style="background-color:.*?"/g, 'style="background-color:transparent"')
    .replace(/background-color:\s*rgba?\([^)]+\)/gi, 'background-color:transparent')
    .replace(/background-color:\s*#[0-9a-f]{3,6}/gi, 'background-color:transparent')
    .replace(/background:\s*rgba?\([^)]+\)/gi, 'background:transparent')
    .replace(/background:\s*#[0-9a-f]{3,6}/gi, 'background:transparent')
    .replace(/fill="rgb\([\d\s,]+\)"/gi, 'fill="rgba(240, 245, 255, 0.7)"');
}

function calculateDiagramPosition(canvas: Canvas | null): { centerX: number; centerY: number; getScale: (width: number) => number } {
  if (canvas) {
    const vpt = canvas.viewportTransform;
    const currentZoom = canvas.getZoom();
    const canvasWidth = canvas.getWidth();
    const canvasHeight = canvas.getHeight();

    const visibleCenterX = (-vpt![4] + canvasWidth / 2) / currentZoom;
    const visibleCenterY = (-vpt![5] + canvasHeight / 2) / currentZoom;

    return {
      centerX: visibleCenterX - (canvasWidth * DIAGRAM_POSITION.HORIZONTAL_OFFSET_RATIO) / currentZoom,
      centerY: visibleCenterY - (canvasHeight * DIAGRAM_POSITION.VERTICAL_OFFSET_RATIO) / currentZoom,
      getScale: (width: number) => ((canvasWidth * DIAGRAM_POSITION.SCALE_RATIO) / currentZoom) / width
    };
  }

  const container = document.querySelector('.whiteboard-container') || document.body;
  const containerWidth = container.clientWidth || window.innerWidth;
  const containerHeight = container.clientHeight || window.innerHeight;

  return {
    centerX: containerWidth * DIAGRAM_POSITION.FALLBACK_CENTER_X_RATIO,
    centerY: containerHeight * DIAGRAM_POSITION.FALLBACK_CENTER_Y_RATIO,
    getScale: (width: number) => (containerWidth * DIAGRAM_POSITION.FALLBACK_SCALE_RATIO) / width
  };
}

export function useDiagramToCanvas({
  diagramContent,
  canvasRef,
  addElement,
  setTool,
  socket,
  workspaceId,
  onSuccess,
  onError
}: UseDiagramToCanvasProps) {
  return useCallback(async () => {
    try {
      const mermaid = await loadMermaid({
        startOnLoad: false,
        securityLevel: 'loose',
        theme: 'default',
        fontFamily: "'Inter', sans-serif",
        fontSize: 16,
        flowchart: { htmlLabels: true, curve: 'basis', diagramPadding: 8, useMaxWidth: false },
        themeVariables: MERMAID_THEME
      }) as MermaidInstance;

      const { svg: rawSvg } = await mermaid.render(`diagram-${Date.now()}`, diagramContent);
      const svg = processSvgForTransparency(rawSvg);

      const img = new Image();
      img.onload = () => {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.width * DIAGRAM_POSITION.IMAGE_SCALE_MULTIPLIER;
        tempCanvas.height = img.height * DIAGRAM_POSITION.IMAGE_SCALE_MULTIPLIER;
        const ctx = tempCanvas.getContext('2d');

        if (!ctx) return;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
        ctx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);

        const pngUrl = tempCanvas.toDataURL('image/png', 1.0);
        const { centerX, centerY, getScale } = calculateDiagramPosition(canvasRef.current);
        const scaleX = getScale(tempCanvas.width);

        const elementData: DiagramElementData = {
          id: uuidv4(),
          type: 'diagram',
          data: {
            src: pngUrl,
            left: centerX,
            top: centerY,
            scaleX,
            scaleY: scaleX,
            angle: 0,
            isDiagram: true,
            originalWidth: tempCanvas.width,
            originalHeight: tempCanvas.height
          }
        };

        addElement(elementData);

        if (socket && workspaceId) {
          socket.emit(SOCKET_EVENTS.WHITEBOARD_UPDATE, { workspaceId, elements: [elementData] });
        }

        setTool(TOOLS.SELECT);
        onSuccess();
      };

      img.src = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    } catch (error) {
      console.error('Failed to render diagram:', error);
      onError();
    }
  }, [diagramContent, canvasRef, addElement, setTool, socket, workspaceId, onSuccess, onError]);
}
