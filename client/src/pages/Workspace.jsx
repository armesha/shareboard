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
  const [splitPosition, setSplitPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);
  const MIN_WIDTH_PERCENT = 20; // Minimum width for each panel

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

  const handleMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();  // Предотвращаем всплытие события
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging || !containerRef.current) return;
      
      const container = containerRef.current.getBoundingClientRect();
      let newPosition = ((e.clientX - container.left) / container.width) * 100;
      
      // Limit split position between 20% and 80%
      newPosition = Math.max(20, Math.min(80, newPosition));
      setSplitPosition(newPosition);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const cycleViewMode = () => {
    if (viewMode === 'whiteboard') {
      setViewMode('split');
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
