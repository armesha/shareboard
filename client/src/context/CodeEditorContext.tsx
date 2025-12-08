import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import type * as Y from 'yjs';
import { useSocket } from './SocketContext';
import { getWorkspaceId } from '../utils';
import { SOCKET_EVENTS, CODE_EXAMPLES } from '../constants';
import { useYjs } from './YjsContext';

type LanguageKey = keyof typeof CODE_EXAMPLES;

interface CodeEditorContextValue {
  content: string;
  language: string;
  setContent: (value: string) => void;
  setLanguage: (language: string) => void;
}

interface CodeEditorProviderProps {
  children: ReactNode;
}

interface CodeUpdateData {
  language?: string;
}

interface WorkspaceStateData {
  codeSnippets?: {
    language?: string;
    content?: string;
  };
}

const CodeEditorContext = createContext<CodeEditorContextValue | null>(null);

export function useCodeEditor(): CodeEditorContextValue {
  const context = useContext(CodeEditorContext);
  if (!context) {
    throw new Error('useCodeEditor must be used within a CodeEditorProvider');
  }
  return context;
}

export function CodeEditorProvider({ children }: CodeEditorProviderProps) {
  const socketContext = useSocket();
  const socket = socketContext?.socket ?? null;
  const yjsContext = useYjs();
  const doc = yjsContext?.doc ?? null;
  const synced = yjsContext?.synced ?? false;
  const [language, setLanguageState] = useState('javascript');
  const [content, setContentState] = useState('');
  const yText = useMemo((): Y.Text | null => doc?.getText('code') ?? null, [doc]);

  useEffect(() => {
    if (!yText || !doc) return;

    const syncContent = (): void => {
      const text = yText.toString();
      setContentState(text || CODE_EXAMPLES[language as LanguageKey] || '');
    };
    syncContent();

    const observer = (): void => syncContent();
    yText.observe(observer);

    return () => {
      yText.unobserve(observer);
    };
  }, [yText, doc, language]);

  useEffect(() => {
    if (!yText || !doc || !synced) return;

    const meta = doc.getMap('meta');
    if (yText.length === 0 && CODE_EXAMPLES[language as LanguageKey] && !meta.get('codeInitialized')) {
      doc.transact(() => {
        if (yText.length === 0 && !meta.get('codeInitialized')) {
          meta.set('codeInitialized', true);
          yText.insert(0, CODE_EXAMPLES[language as LanguageKey]);
        }
      });
    }
  }, [yText, doc, synced, language]);

  const setContent = useCallback((value: string): void => {
    if (!yText) return;
    yText.delete(0, yText.length);
    if (value) {
      yText.insert(0, value);
    }
  }, [yText]);

  useEffect(() => {
    if (!socket) return;

    const handleCodeUpdate = ({ language: newLanguage }: CodeUpdateData): void => {
      if (newLanguage) {
        setLanguageState(newLanguage);
      }
    };

    const handleWorkspaceState = (state: WorkspaceStateData): void => {
      if (state.codeSnippets?.language) {
        setLanguageState(state.codeSnippets.language);
      }
      if (state.codeSnippets?.content && yText && yText.length === 0) {
        setContent(state.codeSnippets.content);
      }
    };

    socket.on(SOCKET_EVENTS.CODE_UPDATE, handleCodeUpdate);
    socket.on(SOCKET_EVENTS.WORKSPACE_STATE, handleWorkspaceState);

    return () => {
      socket.off(SOCKET_EVENTS.CODE_UPDATE, handleCodeUpdate);
      socket.off(SOCKET_EVENTS.WORKSPACE_STATE, handleWorkspaceState);
    };
  }, [socket, setContent, yText]);

  const updateLanguage = useCallback((newLanguage: string): void => {
    setLanguageState(newLanguage);
    const workspaceId = getWorkspaceId();
    if (socket && workspaceId) {
      socket.emit(SOCKET_EVENTS.CODE_UPDATE, {
        workspaceId,
        language: newLanguage
      });
    }
  }, [socket]);

  const value = useMemo((): CodeEditorContextValue => ({
    content,
    language,
    setContent,
    setLanguage: updateLanguage
  }), [content, language, setContent, updateLanguage]);

  return (
    <CodeEditorContext.Provider value={value}>
      {children}
    </CodeEditorContext.Provider>
  );
}
