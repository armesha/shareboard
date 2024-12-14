import React, { useState, useEffect, useRef } from 'react';
import mermaid from 'mermaid';

const DiagramPanel = ({ onDiagramSubmit, currentDiagram, diagrams }) => {
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
        
        <button
          type="submit"
          className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          {currentDiagram ? 'Update Diagram' : 'Create Diagram'}
        </button>
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
