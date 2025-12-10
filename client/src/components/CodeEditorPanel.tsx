import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import CodeEditor from './CodeEditor';
import DiagramRenderer from './DiagramRenderer';

type ActiveTab = 'code' | 'diagram';

interface CodeEditorPanelProps {
  canWrite: () => boolean;
  onAddToWhiteboard: () => void;
  onClose: () => void;
}

export default function CodeEditorPanel({ canWrite, onAddToWhiteboard, onClose }: CodeEditorPanelProps) {
  const { t } = useTranslation(['workspace', 'editor', 'common']);
  const [activeTab, setActiveTab] = useState<ActiveTab>('code');

  const tabButtons = useMemo(() => (
    <div className="flex space-x-2 items-center">
      <button
        onClick={() => setActiveTab('code')}
        className={`px-3 py-1 rounded text-sm transition-colors ${
          activeTab === 'code' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
        }`}
        aria-pressed={activeTab === 'code'}
      >
        {t('codeboard.code')}
      </button>
      <button
        onClick={() => setActiveTab('diagram')}
        className={`px-3 py-1 rounded text-sm transition-colors ${
          activeTab === 'diagram' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
        }`}
        aria-pressed={activeTab === 'diagram'}
      >
        {t('codeboard.diagram')}
      </button>
      <button
        onClick={onClose}
        className="ml-2 p-1 rounded hover:bg-gray-200 transition-colors"
        aria-label={t('codeboard.closePanel')}
        title={t('codeboard.closePanel')}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  ), [activeTab, onClose, t]);

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-gray-200 p-2 flex justify-between items-center">
        <div className="flex items-center">
          <span className="text-sm font-medium text-gray-700 mr-4">
            {activeTab === 'code' ? t('editor:code.title') : t('editor:diagram.title')}
          </span>
          {!canWrite() && (
            <div className="ml-1 badge-readonly">
              {t('common:permissions.readOnly')}
            </div>
          )}
        </div>
        {tabButtons}
      </div>
      {activeTab === 'code' ? (
        <CodeEditor />
      ) : (
        <DiagramRenderer
          onAddToWhiteboard={onAddToWhiteboard}
          canAddToWhiteboard={canWrite()}
        />
      )}
    </div>
  );
}
