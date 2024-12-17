import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import mermaid from 'mermaid';
import { fabric } from 'fabric';

const SAMPLE_DIAGRAM = `graph TD
  A[Start] --> B{Is it?}
  B -- Yes --> C[OK]
  B -- No --> D[End]`;

export default function DiagramRenderer({ onAddImageToWhiteboard }) {
  const [code, setCode] = useState(SAMPLE_DIAGRAM);
  const [svg, setSvg] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: true,
      theme: 'default',
      securityLevel: 'loose',
      themeVariables: {
        fontFamily: 'Arial',
        fontSize: '16px'
      }
    });
  }, []);

  useEffect(() => {
    const renderDiagram = async () => {
      if (!code) return;

      try {
        const { svg } = await mermaid.render('diagram-' + Date.now(), code);
        setSvg(svg);
        setError(null);
      } catch (error) {
        console.error('Error rendering diagram:', error);
        setError(error.message);
      }
    };

    renderDiagram();
  }, [code]);

  const handleAddToWhiteboard = async () => {
    try {
      const svgElement = document.querySelector('#diagram-preview svg');
      if (!svgElement) return;

      // Create a canvas element
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Set canvas size to match SVG
      const svgRect = svgElement.getBoundingClientRect();
      canvas.width = svgRect.width * 2; // Higher resolution
      canvas.height = svgRect.height * 2;
      
      // Create image from SVG
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const img = new Image();
      img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      // Draw image with white background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Convert to blob and add to whiteboard
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        onAddImageToWhiteboard(url);
      }, 'image/png');
    } catch (error) {
      console.error('Error adding diagram to whiteboard:', error);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-none p-2 border-b flex justify-between items-center">
        <span className="text-sm font-medium text-gray-700">Mermaid Diagram Editor</span>
        <button
          onClick={handleAddToWhiteboard}
          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
        >
          Add to Whiteboard
        </button>
      </div>
      <div className="flex-1 flex">
        <div className="w-1/2 h-full border-r">
          <Editor
            height="100%"
            defaultLanguage="markdown"
            value={code}
            onChange={setCode}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              wordWrap: 'on',
              padding: { top: 10 }
            }}
          />
        </div>
        <div className="w-1/2 h-full bg-white">
          <div className="h-full overflow-auto p-4" id="diagram-preview">
            {error ? (
              <div className="text-red-500 p-4 bg-red-50 rounded">
                <div className="font-medium">Error rendering diagram:</div>
                <div className="mt-1">{error}</div>
              </div>
            ) : (
              <div dangerouslySetInnerHTML={{ __html: svg }} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
