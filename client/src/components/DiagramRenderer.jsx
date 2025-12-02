import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useDiagramEditor } from '../context/DiagramEditorContext';
import mermaid from 'mermaid';
import debounce from 'lodash/debounce';

const MERMAID_CONFIG = {
  startOnLoad: false,
  theme: 'base',
  logLevel: 'error',
  securityLevel: 'loose',
  flowchart: {
    curve: 'linear',
    htmlLabels: true
  },
  fontFamily: 'sans-serif',
  themeVariables: {
    primaryColor: 'transparent',
    primaryBorderColor: '#333',
    primaryTextColor: '#333',
    secondaryColor: 'transparent',
    tertiaryColor: 'transparent',
    lineColor: '#333',
    textColor: '#333',
    nodeBorder: '#333',
    nodeBkg: 'transparent',
    mainBkg: 'transparent',
    clusterBkg: 'transparent',
    clusterBorder: '#333',
    defaultLinkColor: '#333',
    titleColor: '#333',
    edgeLabelBackground: 'transparent',
    nodeTextColor: '#333'
  }
};

let mermaidInitialized = false;

export default function DiagramRenderer({ onAddToWhiteboard, canAddToWhiteboard }) {
  const { t } = useTranslation(['editor', 'common', 'workspace']);
  const { content, setContent, isReadOnly } = useDiagramEditor();
  const [error, setError] = useState(null);
  const diagramRef = useRef(null);
  const renderIdRef = useRef(0);
  const isRenderingRef = useRef(false);

  useEffect(() => {
    if (!mermaidInitialized) {
      mermaid.initialize(MERMAID_CONFIG);
      mermaidInitialized = true;
    }
  }, []);

  const renderDiagram = useCallback(async (diagramContent) => {
    if (!diagramRef.current || !diagramContent.trim() || isRenderingRef.current) return;

    isRenderingRef.current = true;

    try {
      renderIdRef.current += 1;
      const renderId = `mermaid-render-${renderIdRef.current}`;

      const { svg } = await mermaid.render(renderId, diagramContent);

      const tempSvg = document.getElementById(renderId);
      if (tempSvg) tempSvg.remove();

      if (!diagramRef.current) return;

      const svgWithAttrs = svg.replace(
        '<svg ',
        '<svg id="diagram" class="mermaid-diagram" data-exportable="true" data-name="diagram" '
      );

      diagramRef.current.innerHTML = svgWithAttrs;

      const svgElement = diagramRef.current.querySelector('svg');
      if (svgElement) {
        svgElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

        svgElement.querySelectorAll('foreignObject, foreignObject *, .nodeLabel, .flowchart-label, .label').forEach(el => {
          el.style.backgroundColor = 'transparent';
          el.style.background = 'transparent';
        });

        svgElement.querySelectorAll('.label-container, .edgeLabel rect, rect.label-container, .edgeLabel').forEach(el => {
          el.setAttribute('fill', 'transparent');
          el.style.fill = 'transparent';
        });

        svgElement.querySelectorAll('.node rect, .node polygon, .node circle, .node ellipse, .node path').forEach(el => {
          el.setAttribute('fill', 'transparent');
        });
      }

      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to render diagram');
    } finally {
      isRenderingRef.current = false;
    }
  }, []);

  const debouncedRender = useMemo(
    () => debounce((diagramContent) => renderDiagram(diagramContent), 400),
    [renderDiagram]
  );

  useEffect(() => {
    if (content.trim()) {
      debouncedRender(content);
    }
    return () => debouncedRender.cancel();
  }, [content, debouncedRender]);

  const handleContentChange = (e) => {
    if (isReadOnly) return;
    setContent(e.target.value);
  };

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      <div className="border-b border-gray-200 p-2 flex items-center justify-between">
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
      <div className="flex-1 flex">
        <div className="w-1/2 h-full border-r border-gray-200 flex flex-col">
          <textarea
            value={content}
            onChange={handleContentChange}
            className="flex-1 p-2 font-mono text-sm focus:outline-none resize-none"
            disabled={isReadOnly}
            placeholder={isReadOnly ? t('diagram.readOnlyPlaceholder') : t('diagram.placeholder')}
          />
          {error && (
            <div className="p-2 bg-red-100 text-red-700 text-sm border-t border-red-200">
              {error}
            </div>
          )}
        </div>
        <div className="w-1/2 h-full p-4 overflow-auto">
          <div
            ref={diagramRef}
            className="flex items-center justify-center h-full diagram-container"
            style={{ minHeight: '200px' }}
          ></div>
        </div>
      </div>
    </div>
  );
}
