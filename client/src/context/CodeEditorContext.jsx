import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSocket } from './SocketContext';
import debounce from 'lodash/debounce';

const CodeEditorContext = createContext(null);

export function useCodeEditor() {
  return useContext(CodeEditorContext);
}

export function CodeEditorProvider({ children }) {
  const socket = useSocket();
  const [content, setContent] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [isEditing, setIsEditing] = useState(false);
  const [lastEmittedContent, setLastEmittedContent] = useState('');

  const emitCodeChange = useCallback((workspaceId, language, newContent) => {
    if (socket && newContent !== lastEmittedContent) {
      socket.emit('code-update', {
        workspaceId,
        language,
        content: newContent
      });
      setLastEmittedContent(newContent);
    }
  }, [socket, lastEmittedContent]);

  const debouncedEmit = useCallback(
    debounce((workspaceId, language, content) => {
      emitCodeChange(workspaceId, language, content);
    }, 250),
    [emitCodeChange]
  );

  useEffect(() => {
    if (!socket) return;

    const handleCodeUpdate = ({ language: newLanguage, content: newContent }) => {
      if (!isEditing || newContent !== content) {
        setLanguage(newLanguage);
        setContent(newContent);
        setLastEmittedContent(newContent);
      }
    };

    socket.on('code-update', handleCodeUpdate);

    socket.on('workspace-state', (state) => {
      if (state.codeSnippets) {
        setLanguage(state.codeSnippets.language);
        setContent(state.codeSnippets.content);
        setLastEmittedContent(state.codeSnippets.content);
      }
    });

    return () => {
      socket.off('code-update');
      socket.off('workspace-state');
    };
  }, [socket, isEditing, content]);

  const updateCode = useCallback((newContent) => {
    setContent(newContent);
    const workspaceId = window.location.pathname.split('/')[2];
    
    if (Math.abs(newContent.length - content.length) <= 1) {
      emitCodeChange(workspaceId, language, newContent);
    } else {
      debouncedEmit(workspaceId, language, newContent);
    }
  }, [language, content, emitCodeChange, debouncedEmit]);

  const updateLanguage = useCallback((newLanguage) => {
    setLanguage(newLanguage);
    const workspaceId = window.location.pathname.split('/')[2];
    emitCodeChange(workspaceId, newLanguage, content);
  }, [content, emitCodeChange]);

  const value = {
    content,
    language,
    setContent: updateCode,
    setLanguage: updateLanguage,
    isEditing,
    setIsEditing
  };

  return (
    <CodeEditorContext.Provider value={value}>
      {children}
    </CodeEditorContext.Provider>
  );
}
