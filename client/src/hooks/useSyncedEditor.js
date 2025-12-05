import { useState, useCallback, useRef, useEffect } from 'react';
import debounce from 'lodash/debounce';
import { getWorkspaceId } from '../utils';

const DEBOUNCE_DELAY = 250;
const REMOTE_UPDATE_BLOCK_TIME = 500;

export function useSyncedEditor({
  socket,
  socketEvent,
  initialContent = '',
  emitPayload = (workspaceId, content) => ({ workspaceId, content }),
  canEmit = () => true
}) {
  const [content, setContentState] = useState(initialContent);
  const [isEditing, setIsEditing] = useState(false);
  const [lastEmittedContent, setLastEmittedContent] = useState('');
  const lastLocalChangeRef = useRef(0);
  const debounceRef = useRef(null);
  const contentLengthRef = useRef(initialContent.length);
  const contentRef = useRef(content);

  const emitChange = useCallback((workspaceId, newContent) => {
    if (socket && newContent !== lastEmittedContent && canEmit()) {
      socket.emit(socketEvent, emitPayload(workspaceId, newContent));
      setLastEmittedContent(newContent);
    }
  }, [socket, lastEmittedContent, socketEvent, emitPayload, canEmit]);

  useEffect(() => {
    debounceRef.current = debounce((workspaceId, newContent) => {
      emitChange(workspaceId, newContent);
    }, DEBOUNCE_DELAY);

    return () => {
      if (debounceRef.current) {
        debounceRef.current.cancel();
      }
    };
  }, [emitChange]);

  const updateContent = useCallback((newContent) => {
    lastLocalChangeRef.current = Date.now();
    setContentState(newContent);
    const workspaceId = getWorkspaceId();

    const prevLength = contentLengthRef.current;
    contentLengthRef.current = newContent.length;
    contentRef.current = newContent;

    if (Math.abs(newContent.length - prevLength) <= 1) {
      emitChange(workspaceId, newContent);
    } else if (debounceRef.current) {
      debounceRef.current(workspaceId, newContent);
    }
  }, [emitChange]);

  const handleRemoteUpdate = useCallback((newContent) => {
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

  const syncContent = useCallback((newContent) => {
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
