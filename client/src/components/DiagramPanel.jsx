import React, { useState, useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import html2canvas from 'html2canvas';

const DiagramPanel = ({ onDiagramSubmit, currentDiagram, diagrams, onAddImageToWhiteboard }) => {
  const [diagramDefinition, setDiagramDefinition] = useState(currentDiagram?.definition || '');
  const [diagramTitle, setDiagramTitle] = useState(currentDiagram?.title || '');
  const [lineWidth, setLineWidth] = useState(2);
  const [lineColor, setLineColor] = useState('#000000');
  const diagramRef = useRef(null);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: true,
      theme: 'default',
      securityLevel: 'loose',
      themeVariables: {
        lineWidth: `${lineWidth}px`,
        lineColor: lineColor,
      }
    });
    if (diagramDefinition) {
      renderDiagram();
    }
  }, [diagramDefinition, lineWidth, lineColor]);

  useEffect(() => {
    if (currentDiagram) {
      setDiagramDefinition(currentDiagram.definition);
      setDiagramTitle(currentDiagram.title);
    }
  }, [currentDiagram]);

  const renderDiagram = async () => {
    if (diagramRef.current) {
      try {
        diagramRef.current.innerHTML = diagramDefinition;
        await mermaid.run({
          nodes: [diagramRef.current],
        });
      } catch (error) {
        console.error('Failed to render diagram:', error);
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onDiagramSubmit({
      id: currentDiagram?.id || Date.now().toString(),
      title: diagramTitle,
      definition: diagramDefinition,
    });
  };

  const saveAsImage = async () => {
    if (diagramRef.current) {
      try {
        const svgElement = diagramRef.current.querySelector('svg');
        if (!svgElement) return;

        const canvas = await html2canvas(svgElement, {
          backgroundColor: null,
          scale: 2, 
        });

        canvas.toBlob((blob) => {
          const imageUrl = URL.createObjectURL(blob);
          onAddImageToWhiteboard(imageUrl);
        }, 'image/png');
      } catch (error) {
        console.error('Failed to save diagram as image:', error);
      }
    }
  };

  return (
    <div className="p-4 space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="diagramTitle" className="block text-sm font-medium text-gray-700">
            Diagram Title
          </label>
          <input
            type="text"
            id="diagramTitle"
            value={diagramTitle}
            onChange={(e) => setDiagramTitle(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            required
          />
        </div>

        <div className="flex gap-4">
          <div>
            <label htmlFor="lineWidth" className="block text-sm font-medium text-gray-700">
              Line Width
            </label>
            <input
              type="number"
              id="lineWidth"
              value={lineWidth}
              onChange={(e) => setLineWidth(Number(e.target.value))}
              min="1"
              max="10"
              className="mt-1 block w-24 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
          
          <div>
            <label htmlFor="lineColor" className="block text-sm font-medium text-gray-700">
              Line Color
            </label>
            <input
              type="color"
              id="lineColor"
              value={lineColor}
              onChange={(e) => setLineColor(e.target.value)}
              className="mt-1 block w-24 h-9 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div>
          <label htmlFor="diagramDefinition" className="block text-sm font-medium text-gray-700">
            Diagram Definition (Mermaid Syntax)
          </label>
          <textarea
            id="diagramDefinition"
            value={diagramDefinition}
            onChange={(e) => setDiagramDefinition(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            rows={6}
            required
          />
        </div>
        
        <div className="flex gap-2">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            {currentDiagram ? 'Update Diagram' : 'Create Diagram'}
          </button>
          <button
            type="button"
            onClick={saveAsImage}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Add to Whiteboard
          </button>
        </div>
      </form>

      <div className="mt-4">
        <h3 className="text-lg font-medium text-gray-900">Preview</h3>
        <div className="mt-2 p-4 border rounded-md bg-white">
          <div ref={diagramRef} className="mermaid"></div>
        </div>
      </div>
    </div>
  );
};

export default DiagramPanel;
