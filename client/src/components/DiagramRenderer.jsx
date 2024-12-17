import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import mermaid from 'mermaid';
import nomnoml from 'nomnoml';
import plantumlEncoder from 'plantuml-encoder';
import html2canvas from 'html2canvas';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';

const SAMPLE_DIAGRAMS = {
  mermaid: `graph TD
    A[Start] --> B{Is it?}
    B -- Yes --> C[OK]
    B -- No --> D[End]`,
  nomnoml: `[Pirate|eyeCount: Int|raid();pillage()|
    [beard]--[parrot]
    [beard]-:>[foul mouth]]`,
  plantuml: `@startuml
    Alice -> Bob: Authentication Request
    Bob --> Alice: Authentication Response
    @enduml`
};

const SUPPORTED_DIAGRAM_TYPES = [
  { value: 'mermaid', label: 'Mermaid Diagram' },
  { value: 'plantuml', label: 'PlantUML' },
  { value: 'nomnoml', label: 'Nomnoml' }
];

export default function DiagramRenderer({ splitPosition = 50, onSplitChange, onAddImageToWhiteboard }) {
  const [code, setCode] = useState(SAMPLE_DIAGRAMS.mermaid);
  const [type, setType] = useState('mermaid');
  const [svg, setSvg] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [currentSplit, setCurrentSplit] = useState(splitPosition);
  const containerRef = useRef(null);
  const diagramRef = useRef(null);
  const editorRef = useRef(null);
  const initialMouseX = useRef(0);
  const initialSplit = useRef(0);

  // Initialize mermaid with secure settings
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
        switch (type) {
          case 'mermaid':
            const { svg } = await mermaid.render('diagram-' + Date.now(), code);
            setSvg(svg);
            break;
          case 'nomnoml':
            const nomnomlSvg = nomnoml.renderSvg(code);
            setSvg(nomnomlSvg);
            break;
          case 'plantuml':
            const encoded = plantumlEncoder.encode(code);
            const plantUmlSvg = `http://www.plantuml.com/plantuml/svg/${encoded}`;
            setSvg(`<img src="${plantUmlSvg}" alt="PlantUML diagram" />`);
            break;
          default:
            console.warn('Unsupported diagram type:', type);
        }
      } catch (error) {
        console.error('Error rendering diagram:', error);
        setSvg('<div class="text-red-500">Error rendering diagram</div>');
      }
    };

    renderDiagram();
  }, [code, type]);

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    initialMouseX.current = e.clientX;
    initialSplit.current = currentSplit;

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !containerRef.current) return;
    
    const container = containerRef.current.getBoundingClientRect();
    const deltaX = e.clientX - initialMouseX.current;
    const deltaPercent = (deltaX / container.width) * 100;
    const newSplit = initialSplit.current + deltaPercent;
    
    // Limit size between 20% and 80%
    const clampedSplit = Math.min(Math.max(20, newSplit), 80);
    setCurrentSplit(clampedSplit);
    onSplitChange?.(clampedSplit);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const exportDiagram = async () => {
    try {
      // Wait for the SVG to be rendered
      await new Promise(resolve => setTimeout(resolve, 100));

      const svgElement = diagramRef.current?.querySelector('svg');
      if (!svgElement) {
        console.error('SVG element not found');
        return;
      }

      // Deep clone the SVG and inline all styles
      const svgClone = svgElement.cloneNode(true);
      const computedStyle = window.getComputedStyle(svgElement);
      
      // Apply computed styles to the clone
      Array.from(computedStyle).forEach(key => {
        svgClone.style[key] = computedStyle.getPropertyValue(key);
      });

      // Set dimensions and background
      svgClone.setAttribute('width', '800');
      svgClone.setAttribute('height', '600');
      svgClone.style.backgroundColor = 'white';

      // Convert SVG to a data URL
      const serializer = new XMLSerializer();
      const svgStr = serializer.serializeToString(svgClone);
      const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
      
      // Create a safe data URL
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Create canvas
          const canvas = document.createElement('canvas');
          canvas.width = 800;
          canvas.height = 600;
          const ctx = canvas.getContext('2d');

          // Fill white background
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Draw image
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          // Convert to blob and send to whiteboard
          canvas.toBlob((blob) => {
            if (blob && onAddImageToWhiteboard) {
              const imageUrl = URL.createObjectURL(blob);
              onAddImageToWhiteboard(imageUrl);
            }
          }, 'image/png', 1.0);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(svgBlob);

    } catch (error) {
      console.error('Error exporting diagram:', error);
    }
  };

  const handleEditorDidMount = (editor) => {
    editorRef.current = editor;
    editor.focus();
  };

  const handleTypeChange = (newType) => {
    setType(newType);
    setCode(SAMPLE_DIAGRAMS[newType]);
  };

  return (
    <div ref={containerRef} className="h-full flex flex-col bg-white">
      <div className="border-b border-gray-200 p-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <select
            value={type}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {SUPPORTED_DIAGRAM_TYPES.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <button
            onClick={exportDiagram}
            className="p-1.5 text-gray-700 hover:text-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 rounded-md"
            title="Add to Whiteboard"
          >
            <AddPhotoAlternateIcon />
          </button>
        </div>
      </div>
      <div className="flex-1 flex overflow-hidden relative">
        <div style={{ width: `${currentSplit}%` }} className="h-full">
          <Editor
            height="100%"
            language="markdown"
            value={code}
            onChange={setCode}
            onMount={handleEditorDidMount}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              wordWrap: 'on'
            }}
            theme="vs-light"
          />
        </div>
        
        {/* Разделитель */}
        <div
          className={`w-1 h-full bg-gray-200 hover:bg-blue-300 cursor-col-resize ${isDragging ? 'bg-blue-400' : ''}`}
          onMouseDown={handleMouseDown}
          style={{ cursor: 'col-resize' }}
        />

        <div style={{ width: `${100 - currentSplit}%` }} className="h-full">
          <div 
            ref={diagramRef}
            className="h-full overflow-auto p-4 bg-white diagram-container"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </div>
      </div>
    </div>
  );
}
