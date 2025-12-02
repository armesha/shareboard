import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Editor } from '@monaco-editor/react';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { useCodeEditor } from '../context/CodeEditorContext';
import { useSharing } from '../context/SharingContext';
import { CODE_EDITOR_LANGUAGES, CODE_EXAMPLES } from '../constants';
import { useClickOutside } from '../hooks';

export default function CodeEditor() {
  const { t } = useTranslation(['editor', 'common']);
  const {
    content,
    language,
    setContent,
    setLanguage
  } = useCodeEditor();

  const { canWrite } = useSharing();
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const editorRef = useRef(null);
  const langMenuRef = useRef(null);

  useEffect(() => {
    const readOnly = !canWrite();
    setIsReadOnly(readOnly);
  }, [canWrite]);

  useEffect(() => {
    if (!content && language) {
      setContent(CODE_EXAMPLES[language] || '');
    }
  }, [content, language, setContent]);

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

  const handleLanguageChange = (langValue) => {
    if (!isReadOnly) {
      setLanguage(langValue);
      setIsLangMenuOpen(false);
    }
  };

  useClickOutside(langMenuRef, () => setIsLangMenuOpen(false), isLangMenuOpen);

  const handleInsertExample = () => {
    if (!isReadOnly && CODE_EXAMPLES[language]) {
      setContent(CODE_EXAMPLES[language]);
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
              {CODE_EDITOR_LANGUAGES.map((lang) => (
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
          <button
            onClick={handleInsertExample}
            className="btn-secondary text-sm"
            title={t('code.insertExampleTitle')}
          >
            {t('code.insertExample')}
          </button>
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
