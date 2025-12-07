import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useSocket } from './SocketContext';
import { useSharing } from './SharingContext';
import { SOCKET_EVENTS } from '../constants';
import { useYjs } from './YjsContext';

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
  const { doc } = useYjs();
  const [content, setContentState] = useState(SAMPLE_DIAGRAM);
  const yText = useMemo(() => doc?.getText('diagram') ?? null, [doc]);

  useEffect(() => {
    const readOnly = !canWrite();
    setIsReadOnly(readOnly);
  }, [canWrite]);

  useEffect(() => {
    if (!yText) return;

    const syncContent = () => setContentState(yText.toString());
    syncContent();

    const observer = () => syncContent();
    yText.observe(observer);

    if (yText.length === 0) {
      yText.insert(0, SAMPLE_DIAGRAM);
    }

    return () => {
      yText.unobserve(observer);
    };
  }, [yText]);

  const setContent = useCallback((value) => {
    if (!yText || isReadOnly) return;
    yText.delete(0, yText.length);
    if (value) {
      yText.insert(0, value);
    }
  }, [yText, isReadOnly]);

  useEffect(() => {
    if (!socket) return;

    const handleWorkspaceState = (state) => {
      if (state.diagramContent && yText && yText.length === 0) {
        setContent(state.diagramContent);
      }
    };

    socket.on(SOCKET_EVENTS.WORKSPACE_STATE, handleWorkspaceState);

    return () => {
      socket.off(SOCKET_EVENTS.WORKSPACE_STATE, handleWorkspaceState);
    };
  }, [socket, setContent, yText]);

  const value = useMemo(() => ({
    content,
    setContent,
    isReadOnly
  }), [content, setContent, isReadOnly]);

  return (
    <DiagramEditorContext.Provider value={value}>
      {children}
    </DiagramEditorContext.Provider>
  );
}
