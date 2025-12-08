import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import type * as Y from 'yjs';
import { useSocket } from './SocketContext';
import { useSharing } from './SharingContext';
import { SOCKET_EVENTS, SAMPLE_DIAGRAM } from '../constants';
import { useYjs } from './YjsContext';

interface DiagramEditorContextValue {
  content: string;
  setContent: (value: string) => void;
  isReadOnly: boolean;
}

interface DiagramEditorProviderProps {
  children: ReactNode;
}

interface WorkspaceStateData {
  diagramContent?: string;
}

const DiagramEditorContext = createContext<DiagramEditorContextValue | null>(null);

export function useDiagramEditor(): DiagramEditorContextValue {
  const context = useContext(DiagramEditorContext);
  if (!context) {
    throw new Error('useDiagramEditor must be used within a DiagramEditorProvider');
  }
  return context;
}

export function DiagramEditorProvider({ children }: DiagramEditorProviderProps) {
  const socketContext = useSocket();
  const socket = socketContext?.socket ?? null;
  const sharingContext = useSharing();
  const canWrite = sharingContext?.canWrite ?? (() => false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const yjsContext = useYjs();
  const doc = yjsContext?.doc ?? null;
  const synced = yjsContext?.synced ?? false;
  const [content, setContentState] = useState(SAMPLE_DIAGRAM);
  const yText = useMemo((): Y.Text | null => doc?.getText('diagram') ?? null, [doc]);

  useEffect(() => {
    const readOnly = !canWrite();
    setIsReadOnly(readOnly);
  }, [canWrite]);

  useEffect(() => {
    if (!yText || !doc) return;

    const syncContent = (): void => {
      const text = yText.toString();
      setContentState(text || SAMPLE_DIAGRAM);
    };
    syncContent();

    const observer = (): void => syncContent();
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

  // Apply minimal diff to yText instead of delete-all + insert-all
  const setContent = useCallback((value: string): void => {
    if (!yText || isReadOnly) return;

    const currentValue = yText.toString();
    if (currentValue === value) return;

    // Find common prefix length
    let prefixLen = 0;
    const minLen = Math.min(currentValue.length, value.length);
    while (prefixLen < minLen && currentValue[prefixLen] === value[prefixLen]) {
      prefixLen++;
    }

    // Find common suffix length (but don't overlap with prefix)
    let suffixLen = 0;
    while (
      suffixLen < minLen - prefixLen &&
      currentValue[currentValue.length - 1 - suffixLen] === value[value.length - 1 - suffixLen]
    ) {
      suffixLen++;
    }

    // Calculate what to delete and insert
    const deleteStart = prefixLen;
    const deleteCount = currentValue.length - prefixLen - suffixLen;
    const insertText = value.slice(prefixLen, value.length - suffixLen || undefined);

    // Apply changes in a single transaction
    if (deleteCount > 0 || insertText) {
      yText.doc?.transact(() => {
        if (deleteCount > 0) {
          yText.delete(deleteStart, deleteCount);
        }
        if (insertText) {
          yText.insert(deleteStart, insertText);
        }
      });
    }
  }, [yText, isReadOnly]);

  useEffect(() => {
    if (!socket) return;

    const handleWorkspaceState = (state: WorkspaceStateData): void => {
      if (state.diagramContent && yText && yText.length === 0) {
        setContent(state.diagramContent);
      }
    };

    socket.on(SOCKET_EVENTS.WORKSPACE_STATE, handleWorkspaceState);

    return () => {
      socket.off(SOCKET_EVENTS.WORKSPACE_STATE, handleWorkspaceState);
    };
  }, [socket, setContent, yText]);

  const value = useMemo((): DiagramEditorContextValue => ({
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
