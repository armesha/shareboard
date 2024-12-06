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

  // Debounced function to emit code changes
  const debouncedEmit = useCallback(
    debounce((workspaceId, language, content) => {
      if (socket) {
        socket.emit('code-update', {
          workspaceId,
          language,
          content
        });
      }
    }, 1000),
    [socket]
  );

  useEffect(() => {
    if (!socket) return;

    socket.on('code-update', ({ language: newLanguage, content: newContent }) => {
      if (!isEditing) {
        setLanguage(newLanguage);
        setContent(newContent);
      }
    });

    socket.on('workspace-state', (state) => {
      if (state.codeSnippets) {
        setLanguage(state.codeSnippets.language);
        setContent(state.codeSnippets.content);
      }
    });

    return () => {
      socket.off('code-update');
      socket.off('workspace-state');
    };
  }, [socket, isEditing]);

  const updateCode = useCallback((newContent) => {
    setContent(newContent);
    const workspaceId = window.location.pathname.split('/')[2];
    debouncedEmit(workspaceId, language, newContent);
  }, [language, debouncedEmit]);

  const updateLanguage = useCallback((newLanguage) => {
    setLanguage(newLanguage);
    const workspaceId = window.location.pathname.split('/')[2];
    socket?.emit('code-update', {
      workspaceId,
      language: newLanguage,
      content
    });
  }, [content, socket]);

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
