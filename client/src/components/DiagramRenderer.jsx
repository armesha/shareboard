import { useState, useEffect, useRef } from 'react';
import mermaid from 'mermaid';

// Initialize mermaid
mermaid.initialize({
  startOnLoad: true,
  theme: 'default',
  securityLevel: 'loose',
});

const SAMPLE_DIAGRAM = `
graph TD
    A[Start] --> B{Is it?}
    B -- Yes --> C[OK]
    B -- No --> D[End]
`;

export default function DiagramRenderer() {
  const [code, setCode] = useState(SAMPLE_DIAGRAM);
  const [type, setType] = useState('mermaid');
  const [svg, setSvg] = useState('');
  const editorRef = useRef(null);
  const previewRef = useRef(null);

  useEffect(() => {
    const renderDiagram = async () => {
      if (!code) return;

      try {
        switch (type) {
          case 'mermaid':
            const { svg } = await mermaid.render('diagram-' + Date.now(), code);
            setSvg(svg);
            break;
          // Add support for other diagram types here
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
        const container = previewRef.current;
        const svg = container.querySelector('svg');
        if (svg) {
          svg.style.maxWidth = '100%';
          svg.style.height = 'auto';
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 bg-gray-50">
        <select 
          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="mermaid">Mermaid</option>
          <option value="plantuml">PlantUML</option>
          <option value="nomnoml">Nomnoml</option>
        </select>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Editor */}
        <div className="w-full md:w-1/2 h-1/2 md:h-full border-b md:border-b-0 md:border-r border-gray-200">
          <textarea
            ref={editorRef}
            className="w-full h-full p-4 font-mono text-sm resize-none focus:outline-none"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter your diagram code here..."
          />
        </div>

        {/* Preview */}
        <div className="w-full md:w-1/2 h-1/2 md:h-full overflow-auto p-4 bg-white">
          <div 
            ref={previewRef}
            className="w-full h-full flex items-center justify-center"
            dangerouslySetInnerHTML={{ __html: svg }} 
          />
        </div>
      </div>
    </div>
  );
}
