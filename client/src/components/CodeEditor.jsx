import { useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { useCodeEditor } from '../context/CodeEditorContext';

const SUPPORTED_LANGUAGES = [
  'javascript',
  'typescript',
  'python',
  'java',
  'cpp',
  'csharp',
  'html',
  'css',
  'json',
  'markdown'
];

export default function CodeEditor() {
  const {
    content,
    language,
    setContent,
    setLanguage,
    isEditing,
    setIsEditing
  } = useCodeEditor();
  
  const editorRef = useRef(null);

  const handleEditorDidMount = (editor) => {
    editorRef.current = editor;
    editor.focus();
    
    // Force layout update
    setTimeout(() => {
      editor.layout();
    }, 100);
  };

  const handleEditorChange = (value) => {
    setContent(value);
  };

  const handleLanguageChange = (e) => {
    setLanguage(e.target.value);
  };

  // Force editor layout update when container size changes
  useEffect(() => {
    const updateLayout = () => {
      if (editorRef.current) {
        editorRef.current.layout();
      }
    };

    window.addEventListener('resize', updateLayout);
    return () => window.removeEventListener('resize', updateLayout);
  }, []);

  return (
    <div className="h-full w-full flex flex-col bg-white">
      <div className="border-b border-gray-200 p-2 flex items-center space-x-4">
        <select
          value={language}
          onChange={handleLanguageChange}
          className="px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {SUPPORTED_LANGUAGES.map(lang => (
            <option key={lang} value={lang}>
              {lang.charAt(0).toUpperCase() + lang.slice(1)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex-1 relative">
        <div className="absolute inset-0">
          <Editor
            height="100%"
            language={language}
            value={content}
            onChange={handleEditorChange}
            onMount={handleEditorDidMount}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              wordWrap: 'on',
              fixedOverflowWidgets: true
            }}
            theme="vs-light"
          />
        </div>
      </div>
    </div>
  );
}
