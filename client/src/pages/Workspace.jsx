import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { WhiteboardProvider } from '../context/WhiteboardContext';
import { CodeEditorProvider } from '../context/CodeEditorContext';
import WorkspaceContent from '../components/WorkspaceContent';

export default function Workspace() {
  const { workspaceId } = useParams();
  const socket = useSocket();
  const [status, setStatus] = useState('connecting');
  const [viewMode, setViewMode] = useState('whiteboard'); // 'whiteboard', 'code', 'split', 'diagram'
  const [splitPosition, setSplitPosition] = useState(40);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);
  const MIN_WIDTH_PERCENT = 20; // Minimum width for each panel
  const MAX_WIDTH_PERCENT = 80;

  useEffect(() => {
    if (!socket) return;
    
    socket.on('connect', () => {
      setStatus('connected');
      socket.emit('join-workspace', workspaceId);
    });

    socket.on('disconnect', () => setStatus('disconnected'));
    socket.on('error', () => setStatus('error'));

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('error');
    };
  }, [socket, workspaceId]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging || !containerRef.current) return;
      
      const container = containerRef.current.getBoundingClientRect();
      let newPosition = ((e.clientX - container.left) / container.width) * 100;
      
      // Limit split position between MIN_WIDTH_PERCENT and MAX_WIDTH_PERCENT
      newPosition = Math.max(MIN_WIDTH_PERCENT, Math.min(MAX_WIDTH_PERCENT, newPosition));
      
      // Используем RAF для оптимизации производительности
      requestAnimationFrame(() => {
        setSplitPosition(newPosition);
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = 'default';
    };

    if (isDragging) {
      document.body.style.cursor = 'col-resize';
      document.addEventListener('mousemove', handleMouseMove, { passive: true });
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.body.style.cursor = 'default';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const cycleViewMode = () => {
    if (viewMode === 'whiteboard') {
      setViewMode('split');
      setSplitPosition(40);
    } else if (viewMode === 'split') {
      setViewMode('whiteboard');
    }
  };

  return (
    <WhiteboardProvider>
      <CodeEditorProvider>
        <WorkspaceContent
          socket={socket}
          workspaceId={workspaceId}
          status={status}
          viewMode={viewMode}
          splitPosition={splitPosition}
          isDragging={isDragging}
          handleMouseDown={handleMouseDown}
          containerRef={containerRef}
          cycleViewMode={cycleViewMode}
        />
      </CodeEditorProvider>
    </WhiteboardProvider>
  );
}
