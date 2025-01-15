import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSocket } from './SocketContext';
import debounce from 'lodash/debounce';

const DiagramEditorContext = createContext(null);

export function useDiagramEditor() {
  return useContext(DiagramEditorContext);
}

const SAMPLE_DIAGRAM = `graph TD
  A[Start] --> B{Is it?}
  B -- Yes --> C[OK]
  B -- No --> D[End]
`;

export function DiagramEditorProvider({ children }) {
  const socket = useSocket();
  const [content, setContent] = useState(SAMPLE_DIAGRAM);
  const [isEditing, setIsEditing] = useState(false);
  const [lastEmittedContent, setLastEmittedContent] = useState('');

  const emitDiagramChange = useCallback((workspaceId, newContent) => {
    if (socket && newContent !== lastEmittedContent) {
      socket.emit('diagram-update', {
        workspaceId,
        content: newContent
      });
      setLastEmittedContent(newContent);
    }
  }, [socket, lastEmittedContent]);

  const debouncedEmit = useCallback(
    debounce((workspaceId, content) => {
      emitDiagramChange(workspaceId, content);
    }, 250),
    [emitDiagramChange]
  );

  useEffect(() => {
    if (!socket) return;

    const handleDiagramUpdate = ({ content: newContent }) => {
      if (!isEditing || newContent !== content) {
        setContent(newContent);
        setLastEmittedContent(newContent);
      }
    };

    socket.on('diagram-update', handleDiagramUpdate);

    socket.on('workspace-state', (state) => {
      if (state.diagramContent) {
        setContent(state.diagramContent);
        setLastEmittedContent(state.diagramContent);
      }
    });

    return () => {
      socket.off('diagram-update');
      socket.off('workspace-state');
    };
  }, [socket, isEditing, content]);

  const updateContent = useCallback((newContent) => {
    setContent(newContent);
    const workspaceId = window.location.pathname.split('/')[2];
    
    if (Math.abs(newContent.length - content.length) <= 1) {
      emitDiagramChange(workspaceId, newContent);
    } else {
      debouncedEmit(workspaceId, newContent);
    }
  }, [content, emitDiagramChange, debouncedEmit]);

  const value = {
    content,
    setContent: updateContent,
    isEditing,
    setIsEditing
  };

  return (
    <DiagramEditorContext.Provider value={value}>
      {children}
    </DiagramEditorContext.Provider>
  );
}
