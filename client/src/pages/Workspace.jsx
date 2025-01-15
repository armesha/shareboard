import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { WhiteboardProvider, useWhiteboard } from '../context/WhiteboardContext';
import { CodeEditorProvider } from '../context/CodeEditorContext';
import { DiagramEditorProvider } from '../context/DiagramEditorContext'; // Add this line
import WorkspaceContent from '../components/WorkspaceContent';

function WorkspaceLayout() {
  const { workspaceId } = useParams();
  const socket = useSocket();
  const { isLoading, connectionStatus } = useWhiteboard();
  const [viewMode, setViewMode] = useState('whiteboard');
  const [splitPosition, setSplitPosition] = useState(40);
  const [isDragging, setIsDragging] = useState(false);
  const [initialMouseX, setInitialMouseX] = useState(null);
  const [initialWidth, setInitialWidth] = useState(null);
  const containerRef = useRef(null);
  const MIN_WIDTH_PERCENT = 20;
  const MAX_WIDTH_PERCENT = 80;

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    setInitialMouseX(e.clientX);
    setInitialWidth(splitPosition);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging || !containerRef.current) return;
      
      const container = containerRef.current.getBoundingClientRect();
      const mousePositionRelative = e.clientX - container.left;
      const newPositionPercent = (mousePositionRelative / container.width) * 100;
      
      setSplitPosition(Math.min(Math.max(100 - newPositionPercent, MIN_WIDTH_PERCENT), MAX_WIDTH_PERCENT));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setInitialMouseX(null);
      setInitialWidth(null);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, initialMouseX, initialWidth]);

  const cycleViewMode = () => {
    setViewMode(viewMode === 'whiteboard' ? 'split' : 'whiteboard');
    setSplitPosition(40);
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-gray-100">
      {/* Loading overlay */}
      {(isLoading || connectionStatus !== 'connected') && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white bg-opacity-80">
          <div className="text-center">
            {connectionStatus === 'connecting' && (
              <>
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent mb-4"></div>
                <p className="text-lg text-gray-700">Connecting to workspace...</p>
              </>
            )}
            {connectionStatus === 'connected' && isLoading && (
              <>
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-green-500 border-t-transparent mb-4"></div>
                <p className="text-lg text-gray-700">Loading drawing history...</p>
              </>
            )}
            {connectionStatus === 'disconnected' && (
              <>
                <div className="inline-block h-8 w-8 text-red-500 mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <p className="text-lg text-red-600">Connection lost. Reconnecting...</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 h-full">
        <WorkspaceContent
          workspaceId={workspaceId}
          viewMode={viewMode}
          splitPosition={splitPosition}
          isDragging={isDragging}
          handleMouseDown={handleMouseDown}
          containerRef={containerRef}
          cycleViewMode={cycleViewMode}
        />
      </div>
    </div>
  );
}

export default function Workspace() {
  return (
    <WhiteboardProvider>
      <CodeEditorProvider>
        <DiagramEditorProvider>
          <WorkspaceLayout />
        </DiagramEditorProvider>
      </CodeEditorProvider>
    </WhiteboardProvider>
  );
}
