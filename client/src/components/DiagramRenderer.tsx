import { useEffect, useState, useRef, useCallback, type ChangeEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import DOMPurify from 'dompurify';
import { useDiagramEditor } from '../context/DiagramEditorContext';
import { ZOOM } from '../constants';
import debounce from 'lodash/debounce';
import { loadMermaid } from '../utils/mermaid';

interface DiagramRendererProps {
  onAddToWhiteboard: () => void;
  canAddToWhiteboard: boolean;
}

interface MermaidInstance {
  render: (id: string, content: string) => Promise<{ svg: string }>;
}

const MERMAID_CONFIG = {
  startOnLoad: false,
  theme: 'neutral' as const,
  logLevel: 'error' as const,
  securityLevel: 'strict' as const,
  flowchart: {
    curve: 'linear' as const,
    useMaxWidth: false,
    padding: 15
  }
} as const;

interface PanPosition {
  x: number;
  y: number;
}

export default function DiagramRenderer({ onAddToWhiteboard, canAddToWhiteboard }: DiagramRendererProps) {
  const { t } = useTranslation(['editor', 'common', 'workspace']);
  const { content, setContent, isReadOnly } = useDiagramEditor();
  const [error, setError] = useState<string | null>(null);
  const [editorHeight, setEditorHeight] = useState(50);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<PanPosition>({ x: 0, y: 0 });
  const [mermaidReady, setMermaidReady] = useState(false);
  const diagramRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const renderIdRef = useRef(0);
  const isRenderingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const isPanningRef = useRef(false);
  const panStartRef = useRef<PanPosition>({ x: 0, y: 0 });
  const panOffsetRef = useRef<PanPosition>({ x: 0, y: 0 });
  const mermaidRef = useRef<MermaidInstance | null>(null);
  const initialRenderDoneRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    loadMermaid(MERMAID_CONFIG).then(instance => {
      if (isMounted) {
        mermaidRef.current = instance as MermaidInstance;
        setMermaidReady(true);
      }
    }).catch(err => {
      setError((err as Error).message || 'Failed to load diagram renderer');
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const renderDiagram = useCallback(async (diagramContent: string) => {
    if (!diagramRef.current || !diagramContent.trim() || isRenderingRef.current) return;
    if (!mermaidRef.current) return;

    isRenderingRef.current = true;

    try {
      renderIdRef.current += 1;
      const renderId = `mermaid-render-${renderIdRef.current}`;

      const { svg } = await mermaidRef.current.render(renderId, diagramContent);

      const tempSvg = document.getElementById(renderId);
      if (tempSvg) tempSvg.remove();

      if (!diagramRef.current) return;

      const svgWithAttrs = svg.replace(
        '<svg ',
        '<svg id="diagram" class="mermaid-diagram" data-exportable="true" data-name="diagram" '
      );

      // Sanitize SVG content to prevent XSS attacks
      const sanitizedSvg = DOMPurify.sanitize(svgWithAttrs, {
        USE_PROFILES: { svg: true, svgFilters: true }
      });

      diagramRef.current.innerHTML = sanitizedSvg;

      const svgElement = diagramRef.current.querySelector('svg');
      if (svgElement) {
        svgElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

        const viewBox = svgElement.getAttribute('viewBox');
        if (viewBox) {
          const values = viewBox.split(' ').map(Number);
          if (values.length === 4) {
            const [x, y, w, h] = values as [number, number, number, number];
            const padding = 10;
            svgElement.setAttribute('viewBox', `${x - padding} ${y - padding} ${w + padding * 2} ${h + padding * 2}`);
          }
        }
      }

      setError(null);
    } catch (err) {
      setError((err as Error).message || 'Failed to render diagram');
    } finally {
      isRenderingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!mermaidReady || !content.trim()) return;

    if (!initialRenderDoneRef.current) {
      initialRenderDoneRef.current = true;
      renderDiagram(content);
      return;
    }

    const debouncedRender = debounce((diagramContent: string) => {
      renderDiagram(diagramContent);
    }, 400);
    debouncedRender(content);
    return () => debouncedRender.cancel();
  }, [content, renderDiagram, mermaidReady]);

  const handleContentChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    if (isReadOnly) return;
    setContent(e.target.value);
  };

  const resizeMoveHandlerRef = useRef<((e: globalThis.MouseEvent) => void) | null>(null);
  const resizeEndHandlerRef = useRef<(() => void) | null>(null);
  const panMoveHandlerRef = useRef<((e: globalThis.MouseEvent) => void) | null>(null);
  const panEndHandlerRef = useRef<(() => void) | null>(null);

  const handleResizeMove = useCallback((e: globalThis.MouseEvent) => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const headerHeight = 45;
    const availableHeight = containerRect.height - headerHeight;
    const mouseY = e.clientY - containerRect.top - headerHeight;

    const newHeightPercent = Math.max(20, Math.min(80, (mouseY / availableHeight) * 100));
    setEditorHeight(newHeightPercent);
  }, []);

  const handleResizeEnd = useCallback(() => {
    isDraggingRef.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    if (resizeMoveHandlerRef.current) {
      document.removeEventListener('mousemove', resizeMoveHandlerRef.current);
    }
    if (resizeEndHandlerRef.current) {
      document.removeEventListener('mouseup', resizeEndHandlerRef.current);
    }
  }, []);

  const handleResizeStart = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    isDraggingRef.current = true;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    resizeMoveHandlerRef.current = handleResizeMove;
    resizeEndHandlerRef.current = handleResizeEnd;
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  }, [handleResizeMove, handleResizeEnd]);

  const handleWheelRef = useRef<((e: WheelEvent) => void) | null>(null);
  handleWheelRef.current = (e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? ZOOM.WHEEL_OUT_MULTIPLIER : ZOOM.WHEEL_IN_MULTIPLIER;
    setZoom(prev => Math.max(ZOOM.MIN, Math.min(ZOOM.MAX, prev * delta)));
  };

  useEffect(() => {
    const previewEl = previewRef.current;
    if (!previewEl) return;

    const handler = (e: WheelEvent) => handleWheelRef.current?.(e);
    previewEl.addEventListener('wheel', handler, { passive: false });
    return () => previewEl.removeEventListener('wheel', handler);
  }, []);

  const handlePanMove = useCallback((e: globalThis.MouseEvent) => {
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    setPan({
      x: panOffsetRef.current.x + dx,
      y: panOffsetRef.current.y + dy
    });
  }, []);

  const handlePanEnd = useCallback(() => {
    isPanningRef.current = false;
    document.body.style.cursor = '';
    if (panMoveHandlerRef.current) {
      document.removeEventListener('mousemove', panMoveHandlerRef.current);
    }
    if (panEndHandlerRef.current) {
      document.removeEventListener('mouseup', panEndHandlerRef.current);
    }
  }, []);

  const handlePanStart = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    isPanningRef.current = true;
    panStartRef.current = { x: e.clientX, y: e.clientY };
    panOffsetRef.current = { x: pan.x, y: pan.y };
    document.body.style.cursor = 'grabbing';
    panMoveHandlerRef.current = handlePanMove;
    panEndHandlerRef.current = handlePanEnd;
    document.addEventListener('mousemove', handlePanMove);
    document.addEventListener('mouseup', handlePanEnd);
  }, [pan, handlePanMove, handlePanEnd]);

  const handleContextMenu = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    return () => {
      if (resizeMoveHandlerRef.current) {
        document.removeEventListener('mousemove', resizeMoveHandlerRef.current);
      }
      if (resizeEndHandlerRef.current) {
        document.removeEventListener('mouseup', resizeEndHandlerRef.current);
      }
      if (panMoveHandlerRef.current) {
        document.removeEventListener('mousemove', panMoveHandlerRef.current);
      }
      if (panEndHandlerRef.current) {
        document.removeEventListener('mouseup', panEndHandlerRef.current);
      }
    };
  }, []);

  return (
    <div ref={containerRef} className="h-full flex flex-col bg-white overflow-hidden">
      <div className="border-b border-gray-200 p-2 flex items-center justify-between shrink-0">
        <div className="flex items-center">
          {isReadOnly && (
            <div className="badge-readonly">
              {t('common:permissions.readOnlyMode')}
            </div>
          )}
        </div>
        {canAddToWhiteboard && !error && content.trim() && (
          <button
            onClick={onAddToWhiteboard}
            className="px-3 py-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-sm flex items-center shadow transition-all duration-200 font-medium hover:scale-105"
            title={t('workspace:codeboard.addToWhiteboard')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t('workspace:codeboard.addToWhiteboard')}
          </button>
        )}
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <div
          className="border-b border-gray-200 flex flex-col overflow-hidden"
          style={{ height: `${editorHeight}%` }}
        >
          <textarea
            value={content}
            onChange={handleContentChange}
            className="flex-1 p-2 font-mono text-sm focus:outline-none resize-none"
            disabled={isReadOnly}
            placeholder={isReadOnly ? t('editor:diagram.readOnlyPlaceholder') : t('editor:diagram.placeholder')}
          />
          {error && (
            <div className="p-2 bg-red-100 text-red-700 text-sm border-t border-red-200 shrink-0">
              {error}
            </div>
          )}
        </div>
        <div
          onMouseDown={handleResizeStart}
          className="h-2 bg-gray-100 hover:bg-blue-200 cursor-row-resize flex items-center justify-center shrink-0 transition-colors"
        >
          <div className="w-10 h-1 bg-gray-300 rounded-full"></div>
        </div>
        <div
          ref={previewRef}
          className="overflow-hidden relative"
          style={{ height: `calc(${100 - editorHeight}% - 8px)` }}
          onMouseDown={handlePanStart}
          onContextMenu={handleContextMenu}
        >
          <style>{`
            .diagram-container,
            .diagram-container svg,
            .diagram-container svg * {
              overflow: visible !important;
            }
          `}</style>
          <div className="absolute top-2 right-2 z-10 flex items-center gap-2 bg-white/80 rounded px-2 py-1 text-xs text-gray-500">
            <span>{Math.round(zoom * 100)}%</span>
            {(zoom !== 1 || pan.x !== 0 || pan.y !== 0) && (
              <button
                onClick={resetView}
                className="text-blue-600 hover:text-blue-800"
                title={t('common:reset')}
              >
                Reset
              </button>
            )}
          </div>
          <div
            ref={diagramRef}
            className="flex items-center justify-center h-full diagram-container p-8"
            style={{
              minHeight: '100px',
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
              cursor: isPanningRef.current ? 'grabbing' : 'grab'
            }}
          ></div>
        </div>
      </div>
    </div>
  );
}
