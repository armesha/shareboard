import { useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import { useCodeEditor } from '../context/CodeEditorContext';
import { useSharing } from '../context/SharingContext';

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
  
  const { canWrite } = useSharing();
  const [isReadOnly, setIsReadOnly] = useState(false);
  const editorRef = useRef(null);

  // Update read-only state when permissions change
  useEffect(() => {
    const readOnly = !canWrite();
    setIsReadOnly(readOnly);
    console.log(`CodeEditor: Setting read-only mode to ${readOnly}`);
  }, [canWrite]);

  const handleEditorDidMount = (editor) => {
    editorRef.current = editor;
    editor.focus();
    
    setTimeout(() => {
      editor.layout();
    }, 100);
  };

  const handleEditorChange = (value) => {
    if (!isReadOnly) {
      setContent(value);
    }
  };

  const handleLanguageChange = (e) => {
    if (!isReadOnly) {
      setLanguage(e.target.value);
    }
  };

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
          disabled={isReadOnly}
        >
          {SUPPORTED_LANGUAGES.map(lang => (
            <option key={lang} value={lang}>
              {lang.charAt(0).toUpperCase() + lang.slice(1)}
            </option>
          ))}
        </select>
        {isReadOnly && (
          <div className="ml-4 px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-md">
            Read-Only Mode
          </div>
        )}
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
              fixedOverflowWidgets: true,
              readOnly: isReadOnly
            }}
            theme="vs-light"
          />
        </div>
      </div>
    </div>
  );
}
