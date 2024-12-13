import { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import mermaid from 'mermaid';

// Initialize mermaid
mermaid.initialize({
  startOnLoad: true,
  theme: 'default',
  securityLevel: 'loose',
});

const SAMPLE_DIAGRAM = `graph TD
    A[Start] --> B{Is it?}
    B -- Yes --> C[OK]
    B -- No --> D[End]`;

const SUPPORTED_DIAGRAM_TYPES = [
  { value: 'mermaid', label: 'Mermaid Diagram' },
  { value: 'plantuml', label: 'PlantUML' },
  { value: 'nomnoml', label: 'Nomnoml' }
];

export default function DiagramRenderer({ splitPosition, onSplitChange }) {
  const [code, setCode] = useState(SAMPLE_DIAGRAM);
  const [type, setType] = useState('mermaid');
  const [svg, setSvg] = useState('');
  const previewRef = useRef(null);
  const isDragging = useRef(false);

  useEffect(() => {
    const renderDiagram = async () => {
      if (!code) return;

      try {
        switch (type) {
          case 'mermaid':
            const { svg } = await mermaid.render('diagram-' + Date.now(), code);
            setSvg(svg);
            break;
          default:
            console.warn('Unsupported diagram type:', type);
        }
      } catch (error) {
        console.error('Error rendering diagram:', error);
      }
    };

    renderDiagram();
  }, [code, type]);

  // Adjust preview size when window resizes
  useEffect(() => {
    const handleResize = () => {
      if (previewRef.current) {
        const svg = previewRef.current.querySelector('svg');
        if (svg) {
          svg.style.maxWidth = '100%';
          svg.style.height = 'auto';
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleMouseDown = (e) => {
    e.preventDefault();
    isDragging.current = true;
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging.current) return;
      
      const container = e.currentTarget;
      const containerRect = container.getBoundingClientRect();
      let newPosition = ((e.clientX - containerRect.left) / containerRect.width) * 100;
      
      // Limit the split position between 20% and 80%
      newPosition = Math.max(20, Math.min(80, newPosition));
      onSplitChange(newPosition);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [onSplitChange]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center px-4 py-2 bg-gray-50 border-b border-gray-200">
        <select 
          className="px-3 py-1.5 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          {SUPPORTED_DIAGRAM_TYPES.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor */}
        <div style={{ width: `${splitPosition}%` }} className="h-full">
          <Editor
            height="100%"
            defaultLanguage="markdown"
            value={code}
            onChange={setCode}
            theme="vs-light"
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              wrappingIndent: 'indent',
            }}
          />
        </div>

        {/* Resizer */}
        <div
          className="w-1 bg-gray-300 hover:bg-blue-500 cursor-col-resize transition-colors"
          onMouseDown={handleMouseDown}
        />

        {/* Preview */}
        <div style={{ width: `${100 - splitPosition}%` }} className="h-full bg-white">
          <div 
            ref={previewRef}
            className="w-full h-full flex items-center justify-center p-4 overflow-auto"
            dangerouslySetInnerHTML={{ __html: svg }} 
          />
        </div>
      </div>
    </div>
  );
}
