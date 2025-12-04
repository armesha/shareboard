import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useSocket } from './SocketContext';
import { getWorkspaceId } from '../utils';
import { SOCKET_EVENTS } from '../constants';
import { useSyncedEditor } from '../hooks/useSyncedEditor';

const CodeEditorContext = createContext(null);

export function useCodeEditor() {
  return useContext(CodeEditorContext);
}

export function CodeEditorProvider({ children }) {
  const socketContext = useSocket();
  const socket = socketContext?.socket;
  const [language, setLanguageState] = useState('javascript');
  const [_lastEmittedLanguage, setLastEmittedLanguage] = useState('javascript');

  const emitPayload = useCallback((workspaceId, content) => ({
    workspaceId,
    language,
    content
  }), [language]);

  const {
    content,
    setContent: updateContent,
    syncContent,
    handleRemoteUpdate,
    isEditing,
    setIsEditing
  } = useSyncedEditor({
    socket,
    socketEvent: SOCKET_EVENTS.CODE_UPDATE,
    initialContent: '',
    emitPayload
  });

  const emitLanguageChange = useCallback((workspaceId, newLanguage, newContent) => {
    if (socket) {
      socket.emit(SOCKET_EVENTS.CODE_UPDATE, {
        workspaceId,
        language: newLanguage,
        content: newContent
      });
      setLastEmittedLanguage(newLanguage);
    }
  }, [socket]);

  useEffect(() => {
    if (!socket) return;

    const handleCodeUpdate = ({ language: newLanguage, content: newContent }) => {
      const updated = handleRemoteUpdate(newContent);
      if (updated) {
        setLanguageState(newLanguage);
        setLastEmittedLanguage(newLanguage);
      }
    };

    const handleWorkspaceState = (state) => {
      if (state.codeSnippets) {
        setLanguageState(state.codeSnippets.language);
        setLastEmittedLanguage(state.codeSnippets.language);
        syncContent(state.codeSnippets.content);
      }
    };

    socket.on(SOCKET_EVENTS.CODE_UPDATE, handleCodeUpdate);
    socket.on(SOCKET_EVENTS.WORKSPACE_STATE, handleWorkspaceState);

    return () => {
      socket.off(SOCKET_EVENTS.CODE_UPDATE, handleCodeUpdate);
      socket.off(SOCKET_EVENTS.WORKSPACE_STATE, handleWorkspaceState);
    };
  }, [socket, handleRemoteUpdate, syncContent]);

  const updateLanguage = useCallback((newLanguage) => {
    setLanguageState(newLanguage);
    const workspaceId = getWorkspaceId();
    emitLanguageChange(workspaceId, newLanguage, content);
  }, [content, emitLanguageChange]);

  const value = useMemo(() => ({
    content,
    language,
    setContent: updateContent,
    setLanguage: updateLanguage,
    isEditing,
    setIsEditing
  }), [content, language, updateContent, updateLanguage, isEditing, setIsEditing]);

  return (
    <CodeEditorContext.Provider value={value}>
      {children}
    </CodeEditorContext.Provider>
  );
}
