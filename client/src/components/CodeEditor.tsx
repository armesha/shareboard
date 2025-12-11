import { useEffect, useRef, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Editor, type OnMount } from '@monaco-editor/react';
import { MonacoBinding } from 'y-monaco';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { useCodeEditor } from '../context/CodeEditorContext';
import { useSharing } from '../context/SharingContext';
import { useYjs } from '../context/YjsContext';
import { CODE_EDITOR_LANGUAGES, CODE_EXAMPLES, type CodeEditorLanguage } from '../constants';
import { useClickOutside } from '../hooks';
import type { editor } from 'monaco-editor';

interface CodeEditorProps {
  onAddToWhiteboard?: () => void;
  canAddToWhiteboard?: boolean;
}

export default function CodeEditor({ onAddToWhiteboard, canAddToWhiteboard = false }: CodeEditorProps) {
  const { t } = useTranslation(['editor', 'common']);
  const {
    content,
    language,
    setContent,
    setLanguage
  } = useCodeEditor();
  const { doc, provider } = useYjs();

  const { canWrite } = useSharing();
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const bindingRef = useRef<MonacoBinding | null>(null);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    const readOnly = !canWrite();
    setIsReadOnly(readOnly);
  }, [canWrite]);

  useEffect(() => {
    if (!initializedRef.current && !content && language) {
      setContent(CODE_EXAMPLES[language as keyof typeof CODE_EXAMPLES] || '');
      initializedRef.current = true;
    }
  }, [content, language, setContent]);

  const handleEditorDidMount: OnMount = (editor) => {
    editorRef.current = editor;
    setEditorReady(true);
    editor.focus();
  };

  const handleLanguageChange = (langValue: string) => {
    if (!isReadOnly) {
      setLanguage(langValue);
      setIsLangMenuOpen(false);
    }
  };

  useClickOutside(langMenuRef as RefObject<HTMLElement>, () => setIsLangMenuOpen(false), isLangMenuOpen);

  const handleInsertExample = () => {
    if (!isReadOnly && CODE_EXAMPLES[language as keyof typeof CODE_EXAMPLES]) {
      setContent(CODE_EXAMPLES[language as keyof typeof CODE_EXAMPLES]);
    }
  };

  useEffect(() => {
    if (!doc || !provider || !editorReady || !editorRef.current) return;

    const model = editorRef.current.getModel();
    if (!model) return;

    const yText = doc.getText('code');
    const binding = new MonacoBinding(yText, model, new Set([editorRef.current]), provider.awareness);
    bindingRef.current = binding;

    return () => {
      binding.destroy();
      bindingRef.current = null;
    };
  }, [doc, provider, editorReady]);

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
        <div className="relative" ref={langMenuRef}>
          <button
            type="button"
            onClick={() => !isReadOnly && setIsLangMenuOpen(!isLangMenuOpen)}
            disabled={isReadOnly}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="font-medium">
              {CODE_EDITOR_LANGUAGES.find(l => l.value === language)?.label || language}
            </span>
            <KeyboardArrowDownIcon
              className={`w-4 h-4 text-gray-500 transition-transform ${isLangMenuOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {isLangMenuOpen && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[150px] p-1.5 grid gap-1">
              {CODE_EDITOR_LANGUAGES.map((lang: CodeEditorLanguage) => (
                <button
                  key={lang.value}
                  type="button"
                  onClick={() => handleLanguageChange(lang.value)}
                  className={`w-full px-3 py-1.5 text-left rounded border transition-colors ${
                    lang.value === language
                      ? 'bg-blue-50 text-blue-600 font-medium border-blue-300'
                      : 'text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {!isReadOnly && (
          <div className="flex items-center space-x-2">
            <button
              onClick={handleInsertExample}
              className="btn-secondary text-sm"
              title={t('code.insertExampleTitle')}
            >
              {t('code.insertExample')}
            </button>
            {canAddToWhiteboard && content.trim() && (
              <button
                onClick={onAddToWhiteboard}
                className="px-3 py-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-sm flex items-center shadow transition-all duration-200 font-medium hover:scale-105"
                title={t('code.addToWhiteboardTitle')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {t('code.addToWhiteboard')}
              </button>
            )}
          </div>
        )}
        {isReadOnly && (
          <div className="badge-readonly">
            {t('common:permissions.readOnlyMode')}
          </div>
        )}
      </div>
      <div className="flex-1 relative">
        <div className="absolute inset-0">
          <Editor
            height="100%"
            language={language}
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
