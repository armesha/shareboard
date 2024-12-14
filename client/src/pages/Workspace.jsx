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
  const [resizeDirection, setResizeDirection] = useState(null);
  const [initialMouseX, setInitialMouseX] = useState(null);
  const [initialWidth, setInitialWidth] = useState(null);
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
      if (!isDragging || !containerRef.current || initialMouseX === null) return;
      
      const container = containerRef.current.getBoundingClientRect();
      const deltaX = e.clientX - initialMouseX;
      const deltaPercent = (deltaX / container.width) * 100;
      let newPosition;

      if (resizeDirection === 'left') {
        // Тянем за левую ручку
        newPosition = initialWidth - deltaPercent;
      } else {
        // Тянем за правую ручку
        newPosition = initialWidth + deltaPercent;
      }
      
      // Жестко ограничиваем пределы
      newPosition = Math.min(Math.max(newPosition, MIN_WIDTH_PERCENT), MAX_WIDTH_PERCENT);
      setSplitPosition(newPosition);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setResizeDirection(null);
      setInitialMouseX(null);
      setInitialWidth(null);
      document.body.style.cursor = 'default';
      document.body.classList.remove('select-none');
    };

    if (isDragging) {
      document.body.style.cursor = 'col-resize';
      document.body.classList.add('select-none');
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.body.style.cursor = 'default';
      document.body.classList.remove('select-none');
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, resizeDirection, initialMouseX, initialWidth]);

  const handleMouseDown = (e, direction) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setResizeDirection(direction);
    setInitialMouseX(e.clientX);
    setInitialWidth(splitPosition);
  };

  const cycleViewMode = () => {
    if (viewMode === 'whiteboard') {
      setViewMode('split');
      setSplitPosition(40); // Начальная ширина при открытии
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
          setStatus={setStatus}
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
