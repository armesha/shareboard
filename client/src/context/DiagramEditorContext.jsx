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
  const { doc, synced } = useYjs();
  const [content, setContentState] = useState(SAMPLE_DIAGRAM);
  const yText = useMemo(() => doc?.getText('diagram') ?? null, [doc]);

  useEffect(() => {
    const readOnly = !canWrite();
    setIsReadOnly(readOnly);
  }, [canWrite]);

  useEffect(() => {
    if (!yText || !doc) return;

    const syncContent = () => {
      const text = yText.toString();
      setContentState(text || SAMPLE_DIAGRAM);
    };
    syncContent();

    const observer = () => syncContent();
    yText.observe(observer);

    return () => {
      yText.unobserve(observer);
    };
  }, [yText, doc]);

  useEffect(() => {
    if (!yText || !doc || !synced) return;

    const meta = doc.getMap('meta');
    if (yText.length === 0 && !meta.get('diagramInitialized')) {
      doc.transact(() => {
        if (yText.length === 0 && !meta.get('diagramInitialized')) {
          meta.set('diagramInitialized', true);
          yText.insert(0, SAMPLE_DIAGRAM);
        }
      });
    }
  }, [yText, doc, synced]);

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
