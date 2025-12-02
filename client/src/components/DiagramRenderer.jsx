import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useDiagramEditor } from '../context/DiagramEditorContext';
import mermaid from 'mermaid';
import debounce from 'lodash/debounce';

export default function DiagramRenderer() {
  const { t } = useTranslation(['editor', 'common']);
  const { content, setContent, isReadOnly } = useDiagramEditor();
  const [error, setError] = useState(null);
  const diagramRef = useRef(null);

  useEffect(() => {
    mermaid.initialize({
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
    });
  }, []);

  const renderIdRef = useRef(0);

  const renderDiagram = async (diagramContent) => {
    if (!diagramRef.current) return;

    try {
      renderIdRef.current += 1;
      const renderId = `diagram-${renderIdRef.current}`;

      const oldTempSvg = document.getElementById(renderId);
      if (oldTempSvg) oldTempSvg.remove();

      const { svg } = await mermaid.render(renderId, diagramContent);

      const tempSvg = document.getElementById(renderId);
      if (tempSvg) tempSvg.remove();

      let svgWithId = svg;
      if (!svgWithId.includes('id="diagram"')) {
        svgWithId = svg.replace('<svg ', '<svg id="diagram" class="mermaid-diagram" data-exportable="true" data-name="diagram" ');
      }

      while (diagramRef.current.firstChild) {
        diagramRef.current.removeChild(diagramRef.current.firstChild);
      }
      diagramRef.current.innerHTML = svgWithId;

      const svgElement = diagramRef.current.querySelector('svg');
      if (svgElement) {
        if (!svgElement.id) {
          svgElement.id = 'diagram';
          svgElement.classList.add('mermaid-diagram');
        }

        svgElement.setAttribute('data-exportable', 'true');
        svgElement.setAttribute('data-name', 'diagram');
        svgElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

        const allForeignObjectElements = svgElement.querySelectorAll('foreignObject, foreignObject *, .nodeLabel, .flowchart-label, .label');
        allForeignObjectElements.forEach(el => {
          el.style.backgroundColor = 'transparent';
          el.style.background = 'transparent';
          if (el.tagName === 'foreignObject') {
            el.querySelectorAll('*').forEach(child => {
              child.style.backgroundColor = 'transparent';
              child.style.background = 'transparent';
            });
          }
        });

        const labelContainers = svgElement.querySelectorAll('.label-container, .edgeLabel rect, rect.label-container, .edgeLabel');
        labelContainers.forEach(el => {
          el.setAttribute('fill', 'transparent');
          el.style.fill = 'transparent';
          el.style.backgroundColor = 'transparent';
        });

        const nodeRects = svgElement.querySelectorAll('.node rect, .node polygon, .node circle, .node ellipse, .node path');
        nodeRects.forEach(el => {
          el.setAttribute('fill', 'transparent');
          el.style.fill = 'transparent';
        });
      }

      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to render diagram');
    }
  };

  const debouncedRenderRef = useRef(null);

  useEffect(() => {
    if (!debouncedRenderRef.current) {
      debouncedRenderRef.current = debounce((diagramContent) => {
        renderDiagram(diagramContent);
      }, 500);
    }
  });

  useEffect(() => {
    if (debouncedRenderRef.current) {
      debouncedRenderRef.current(content);
    }
    return () => {
      if (debouncedRenderRef.current) {
        debouncedRenderRef.current.cancel();
      }
    };
  }, [content]);

  const handleContentChange = (e) => {
    if (isReadOnly) return;
    setContent(e.target.value);
  };

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      <div className="border-b border-gray-200 p-2 flex items-center space-x-4">
        <h2 className="text-lg font-medium">{t('diagram.title')}</h2>
        {isReadOnly && (
          <div className="ml-4 badge-readonly">
            {t('common:permissions.readOnlyMode')}
          </div>
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
