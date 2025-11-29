import React, { useEffect, useState, useRef } from 'react';
import { useDiagramEditor } from '../context/DiagramEditorContext';
import mermaid from 'mermaid';

export default function DiagramRenderer({ workspaceId }) {
  const { content, setContent, debouncedEmit, isReadOnly } = useDiagramEditor();
  const [error, setError] = useState(null);
  const diagramRef = useRef(null);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: true,
      theme: 'base',
      logLevel: 'error',
      securityLevel: 'loose',
      flowchart: { curve: 'basis' },
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
        clusterBkg: 'transparent',
        clusterBorder: '#333',
        defaultLinkColor: '#333',
        titleColor: '#333',
        edgeLabelBackground: 'transparent'
      }
    });
  }, []);

  useEffect(() => {
    const renderDiagram = async () => {
      if (diagramRef.current) {
        try {
          diagramRef.current.innerHTML = '';
          const { svg } = await mermaid.render('diagram', content);
          
          let svgWithId = svg;
          if (!svgWithId.includes('id="diagram"')) {
            svgWithId = svg.replace('<svg ', '<svg id="diagram" class="mermaid-diagram" data-exportable="true" data-name="diagram" ');
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

            const edgeLabelSpans = svgElement.querySelectorAll('.edgeLabel span, .edgeLabel div, foreignObject span, foreignObject div');
            edgeLabelSpans.forEach(el => {
              el.style.backgroundColor = 'transparent';
              el.style.background = 'transparent';
            });

            const labelContainers = svgElement.querySelectorAll('.label-container, .edgeLabel rect, rect.label-container');
            labelContainers.forEach(el => {
              el.setAttribute('fill', 'transparent');
              el.style.fill = 'transparent';
            });

            const nodeRects = svgElement.querySelectorAll('.node rect, .node polygon, .node circle, .node ellipse');
            nodeRects.forEach(el => {
              el.setAttribute('fill', 'transparent');
              el.style.fill = 'transparent';
            });
          }
          
          setError(null);
        } catch (err) {
          console.error('Error rendering diagram:', err);
          setError(err.message || 'Failed to render diagram');
        }
      }
    };

    renderDiagram();
  }, [content]);

  const handleContentChange = (e) => {
    if (isReadOnly) return;
    const newContent = e.target.value;
    setContent(newContent);
    debouncedEmit(workspaceId, newContent);
  };

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      <div className="border-b border-gray-200 p-2 flex items-center space-x-4">
        <h2 className="text-lg font-medium">Diagram Editor</h2>
        {isReadOnly && (
          <div className="ml-4 px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-md">
            Read-Only Mode
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
            placeholder={isReadOnly ? "Read-only" : "Enter diagram code here..."}
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
