import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSocket } from './SocketContext';
import { getWorkspaceId } from '../utils';
import { SOCKET_EVENTS } from '../constants';
import debounce from 'lodash/debounce';

const CodeEditorContext = createContext(null);

export function useCodeEditor() {
  return useContext(CodeEditorContext);
}

export function CodeEditorProvider({ children }) {
  const socketContext = useSocket();
  const socket = socketContext?.socket;
  const [content, setContent] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [isEditing, setIsEditing] = useState(false);
  const [lastEmittedContent, setLastEmittedContent] = useState('');
  const lastLocalChangeRef = useRef(0);

  const emitCodeChange = useCallback((workspaceId, language, newContent) => {
    if (socket && newContent !== lastEmittedContent) {
      socket.emit(SOCKET_EVENTS.CODE_UPDATE, {
        workspaceId,
        language,
        content: newContent
      });
      setLastEmittedContent(newContent);
    }
  }, [socket, lastEmittedContent]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedEmit = useCallback(
    debounce((workspaceId, language, content) => {
      emitCodeChange(workspaceId, language, content);
    }, 250),
    [emitCodeChange]
  );

  useEffect(() => {
    return () => debouncedEmit.cancel();
  }, [debouncedEmit]);

  useEffect(() => {
    if (!socket) return;

    const handleCodeUpdate = ({ language: newLanguage, content: newContent }) => {
      const timeSinceLastLocal = Date.now() - lastLocalChangeRef.current;
      if (timeSinceLastLocal < 500) return;

      if (newContent !== content) {
        setLanguage(newLanguage);
        setContent(newContent);
        setLastEmittedContent(newContent);
      }
    };

    const handleWorkspaceState = (state) => {
      if (state.codeSnippets) {
        setLanguage(state.codeSnippets.language);
        setContent(state.codeSnippets.content);
        setLastEmittedContent(state.codeSnippets.content);
      }
    };

    socket.on(SOCKET_EVENTS.CODE_UPDATE, handleCodeUpdate);
    socket.on(SOCKET_EVENTS.WORKSPACE_STATE, handleWorkspaceState);

    return () => {
      socket.off(SOCKET_EVENTS.CODE_UPDATE, handleCodeUpdate);
      socket.off(SOCKET_EVENTS.WORKSPACE_STATE, handleWorkspaceState);
    };
  }, [socket, isEditing, content]);

  const updateCode = useCallback((newContent) => {
    lastLocalChangeRef.current = Date.now();
    setContent(newContent);
    const workspaceId = getWorkspaceId();

    if (Math.abs(newContent.length - content.length) <= 1) {
      emitCodeChange(workspaceId, language, newContent);
    } else {
      debouncedEmit(workspaceId, language, newContent);
    }
  }, [language, content, emitCodeChange, debouncedEmit]);

  const updateLanguage = useCallback((newLanguage) => {
    setLanguage(newLanguage);
    const workspaceId = getWorkspaceId();
    emitCodeChange(workspaceId, newLanguage, content);
  }, [content, emitCodeChange]);

  const value = useMemo(() => ({
    content,
    language,
    setContent: updateCode,
    setLanguage: updateLanguage,
    isEditing,
    setIsEditing
  }), [content, language, updateCode, updateLanguage, isEditing]);

  return (
    <CodeEditorContext.Provider value={value}>
      {children}
    </CodeEditorContext.Provider>
  );
}
