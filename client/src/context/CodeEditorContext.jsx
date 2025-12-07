import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useSocket } from './SocketContext';
import { getWorkspaceId } from '../utils';
import { SOCKET_EVENTS, CODE_EXAMPLES } from '../constants';
import { useYjs } from './YjsContext';

const CodeEditorContext = createContext(null);

export function useCodeEditor() {
  return useContext(CodeEditorContext);
}

export function CodeEditorProvider({ children }) {
  const socketContext = useSocket();
  const socket = socketContext?.socket;
  const { doc } = useYjs();
  const [language, setLanguageState] = useState('javascript');
  const [content, setContentState] = useState('');
  const yText = useMemo(() => doc?.getText('code') ?? null, [doc]);

  useEffect(() => {
    if (!yText) return;

    const syncContent = () => setContentState(yText.toString());
    syncContent();

    const observer = () => syncContent();
    yText.observe(observer);

    if (yText.length === 0 && CODE_EXAMPLES[language]) {
      yText.insert(0, CODE_EXAMPLES[language]);
    }

    return () => {
      yText.unobserve(observer);
    };
  }, [yText, language]);

  const setContent = useCallback((value) => {
    if (!yText) return;
    yText.delete(0, yText.length);
    if (value) {
      yText.insert(0, value);
    }
  }, [yText]);

  useEffect(() => {
    if (!socket) return;

    const handleCodeUpdate = ({ language: newLanguage }) => {
      if (newLanguage) {
        setLanguageState(newLanguage);
      }
    };

    const handleWorkspaceState = (state) => {
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

  const updateLanguage = useCallback((newLanguage) => {
    setLanguageState(newLanguage);
    const workspaceId = getWorkspaceId();
    if (socket && workspaceId) {
      socket.emit(SOCKET_EVENTS.CODE_UPDATE, {
        workspaceId,
        language: newLanguage
      });
    }
  }, [socket]);

  const value = useMemo(() => ({
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
