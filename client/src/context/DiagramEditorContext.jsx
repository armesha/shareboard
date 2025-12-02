import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSocket } from './SocketContext';
import { useSharing } from './SharingContext';
import { getWorkspaceId } from '../utils';
import { SOCKET_EVENTS } from '../constants';
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
  const socketContext = useSocket();
  const socket = socketContext?.socket;
  const { canWrite } = useSharing() || { canWrite: () => false };
  const [content, setContent] = useState(SAMPLE_DIAGRAM);
  const [isEditing, setIsEditing] = useState(false);
  const [lastEmittedContent, setLastEmittedContent] = useState('');
  const [isReadOnly, setIsReadOnly] = useState(false);
  const lastLocalChangeRef = useRef(0);

  useEffect(() => {
    const readOnly = !canWrite();
    setIsReadOnly(readOnly);
  }, [canWrite]);

  const emitDiagramChange = useCallback((workspaceId, newContent) => {
    if (socket && newContent !== lastEmittedContent && !isReadOnly) {
      socket.emit(SOCKET_EVENTS.DIAGRAM_UPDATE, {
        workspaceId,
        content: newContent
      });
      setLastEmittedContent(newContent);
    }
  }, [socket, lastEmittedContent, isReadOnly]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedEmit = useCallback(
    debounce((workspaceId, content) => {
      emitDiagramChange(workspaceId, content);
    }, 250),
    [emitDiagramChange]
  );

  useEffect(() => {
    return () => debouncedEmit.cancel();
  }, [debouncedEmit]);

  useEffect(() => {
    if (!socket) return;

    const handleDiagramUpdate = ({ content: newContent }) => {
      const timeSinceLastLocal = Date.now() - lastLocalChangeRef.current;
      if (timeSinceLastLocal < 500) return;

      if (newContent !== content) {
        setContent(newContent);
        setLastEmittedContent(newContent);
      }
    };

    const handleWorkspaceState = (state) => {
      if (state.diagramContent) {
        setContent(state.diagramContent);
        setLastEmittedContent(state.diagramContent);
      }
    };

    socket.on(SOCKET_EVENTS.DIAGRAM_UPDATE, handleDiagramUpdate);
    socket.on(SOCKET_EVENTS.WORKSPACE_STATE, handleWorkspaceState);

    return () => {
      socket.off(SOCKET_EVENTS.DIAGRAM_UPDATE, handleDiagramUpdate);
      socket.off(SOCKET_EVENTS.WORKSPACE_STATE, handleWorkspaceState);
    };
  }, [socket, isEditing, content]);

  const updateContent = useCallback((newContent) => {
    lastLocalChangeRef.current = Date.now();
    setContent(newContent);
    const workspaceId = getWorkspaceId();

    if (Math.abs(newContent.length - content.length) <= 1) {
      emitDiagramChange(workspaceId, newContent);
    } else {
      debouncedEmit(workspaceId, newContent);
    }
  }, [content, emitDiagramChange, debouncedEmit]);

  const value = useMemo(() => ({
    content,
    setContent: updateContent,
    isEditing,
    setIsEditing,
    debouncedEmit,
    isReadOnly
  }), [content, updateContent, isEditing, debouncedEmit, isReadOnly]);

  return (
    <DiagramEditorContext.Provider value={value}>
      {children}
    </DiagramEditorContext.Provider>
  );
}
