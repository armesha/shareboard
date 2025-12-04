import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useSocket } from './SocketContext';
import { useSharing } from './SharingContext';
import { SOCKET_EVENTS } from '../constants';
import { useSyncedEditor } from '../hooks/useSyncedEditor';

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
  const [isReadOnly, setIsReadOnly] = useState(false);

  useEffect(() => {
    const readOnly = !canWrite();
    setIsReadOnly(readOnly);
  }, [canWrite]);

  const canEmit = useCallback(() => !isReadOnly, [isReadOnly]);

  const {
    content,
    setContent: updateContent,
    syncContent,
    handleRemoteUpdate,
    isEditing,
    setIsEditing
  } = useSyncedEditor({
    socket,
    socketEvent: SOCKET_EVENTS.DIAGRAM_UPDATE,
    initialContent: SAMPLE_DIAGRAM,
    canEmit
  });

  useEffect(() => {
    if (!socket) return;

    const handleDiagramUpdate = ({ content: newContent }) => {
      handleRemoteUpdate(newContent);
    };

    const handleWorkspaceState = (state) => {
      if (state.diagramContent) {
        syncContent(state.diagramContent);
      }
    };

    socket.on(SOCKET_EVENTS.DIAGRAM_UPDATE, handleDiagramUpdate);
    socket.on(SOCKET_EVENTS.WORKSPACE_STATE, handleWorkspaceState);

    return () => {
      socket.off(SOCKET_EVENTS.DIAGRAM_UPDATE, handleDiagramUpdate);
      socket.off(SOCKET_EVENTS.WORKSPACE_STATE, handleWorkspaceState);
    };
  }, [socket, handleRemoteUpdate, syncContent]);

  const value = useMemo(() => ({
    content,
    setContent: updateContent,
    isEditing,
    setIsEditing,
    isReadOnly
  }), [content, updateContent, isEditing, setIsEditing, isReadOnly]);

  return (
    <DiagramEditorContext.Provider value={value}>
      {children}
    </DiagramEditorContext.Provider>
  );
}
