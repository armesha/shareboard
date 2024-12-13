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
  const [viewMode, setViewMode] = useState('split'); // 'whiteboard', 'code', 'split'
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
    setIsDragging(true);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !containerRef.current) return;
    
    const container = containerRef.current.getBoundingClientRect();
    const position = ((e.clientX - container.left) / container.width) * 100;
    
    // Enforce minimum width
    if (position >= MIN_WIDTH_PERCENT && position <= (100 - MIN_WIDTH_PERCENT)) {
      setSplitPosition(position);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  const cycleViewMode = () => {
    const modes = ['split', 'whiteboard', 'code'];
    const currentIndex = modes.indexOf(viewMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setViewMode(modes[nextIndex]);
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
        />
      </CodeEditorProvider>
    </WhiteboardProvider>
  );
}
