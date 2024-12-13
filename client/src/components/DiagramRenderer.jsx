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
  const editorRef = useRef(null);

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

  const handleEditorDidMount = (editor) => {
    editorRef.current = editor;
    // Focus editor when mounted
    editor.focus();
  };

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="border-b border-gray-200 p-2 flex items-center justify-between">
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {SUPPORTED_DIAGRAM_TYPES.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>
      <div className="flex-1 grid grid-cols-2 overflow-hidden">
        <div className="h-full border-r border-gray-200">
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
        <div 
          className="h-full overflow-auto p-4 bg-white"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
    </div>
  );
}
