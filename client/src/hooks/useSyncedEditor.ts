import { useState, useCallback, useRef, useEffect, type MutableRefObject } from 'react';
import debounce from 'lodash/debounce';
import { getWorkspaceId } from '../utils';

const DEBOUNCE_DELAY = 250;
const REMOTE_UPDATE_BLOCK_TIME = 500;

interface Socket {
  emit: (event: string, payload: unknown) => void;
}

interface UseSyncedEditorProps<T> {
  socket: Socket | null;
  socketEvent: string;
  initialContent?: string;
  emitPayload?: (workspaceId: string, content: string) => T;
  canEmit?: () => boolean;
}

interface UseSyncedEditorReturn {
  content: string;
  setContent: (newContent: string) => void;
  syncContent: (newContent: string) => void;
  handleRemoteUpdate: (newContent: string) => boolean;
  isEditing: boolean;
  setIsEditing: React.Dispatch<React.SetStateAction<boolean>>;
  lastLocalChangeRef: MutableRefObject<number>;
}

export function useSyncedEditor<T = { workspaceId: string; content: string }>({
  socket,
  socketEvent,
  initialContent = '',
  emitPayload = (workspaceId: string, content: string) => ({ workspaceId, content }) as T,
  canEmit = () => true
}: UseSyncedEditorProps<T>): UseSyncedEditorReturn {
  const [content, setContentState] = useState(initialContent);
  const [isEditing, setIsEditing] = useState(false);
  const [lastEmittedContent, setLastEmittedContent] = useState('');
  const lastLocalChangeRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof debounce> | null>(null);
  const contentLengthRef = useRef(initialContent.length);
  const contentRef = useRef(content);

  const emitChange = useCallback((workspaceId: string, newContent: string) => {
    if (socket && newContent !== lastEmittedContent && canEmit()) {
      socket.emit(socketEvent, emitPayload(workspaceId, newContent));
      setLastEmittedContent(newContent);
    }
  }, [socket, lastEmittedContent, socketEvent, emitPayload, canEmit]);

  useEffect(() => {
    debounceRef.current = debounce((workspaceId: string, newContent: string) => {
      emitChange(workspaceId, newContent);
    }, DEBOUNCE_DELAY);

    return () => {
      if (debounceRef.current) {
        debounceRef.current.cancel();
      }
    };
  }, [emitChange]);

  const updateContent = useCallback((newContent: string) => {
    lastLocalChangeRef.current = Date.now();
    setContentState(newContent);
    const workspaceId = getWorkspaceId();

    if (!workspaceId) return;

    const prevLength = contentLengthRef.current;
    contentLengthRef.current = newContent.length;
    contentRef.current = newContent;

    if (Math.abs(newContent.length - prevLength) <= 1) {
      emitChange(workspaceId, newContent);
    } else if (debounceRef.current) {
      debounceRef.current(workspaceId, newContent);
    }
  }, [emitChange]);

  const handleRemoteUpdate = useCallback((newContent: string): boolean => {
    const timeSinceLastLocal = Date.now() - lastLocalChangeRef.current;
    if (timeSinceLastLocal < REMOTE_UPDATE_BLOCK_TIME) return false;

    if (newContent !== contentRef.current) {
      setContentState(newContent);
      setLastEmittedContent(newContent);
      contentLengthRef.current = newContent.length;
      contentRef.current = newContent;
    }
    return true;
  }, []);

  const syncContent = useCallback((newContent: string) => {
    setContentState(newContent);
    setLastEmittedContent(newContent);
    contentLengthRef.current = newContent.length;
    contentRef.current = newContent;
  }, []);

  return {
    content,
    setContent: updateContent,
    syncContent,
    handleRemoteUpdate,
    isEditing,
    setIsEditing,
    lastLocalChangeRef
  };
}
