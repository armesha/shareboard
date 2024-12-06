import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { WhiteboardProvider } from '../context/WhiteboardContext';
import { CodeEditorProvider } from '../context/CodeEditorContext';
import Whiteboard from '../components/Whiteboard';
import CodeEditor from '../components/CodeEditor';

export default function Workspace() {
  const { workspaceId } = useParams();
  const socket = useSocket();
  const [status, setStatus] = useState('connecting');
  const [viewMode, setViewMode] = useState('split'); // 'whiteboard', 'code', 'split'
  const [splitPosition, setSplitPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef(null);
  const containerRef = useRef(null);
  const MIN_WIDTH_PERCENT = 20; // Minimum width for each panel

  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#000000');
  const [width, setWidth] = useState(5);
  const whiteboardRef = useRef(null);

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

  const getViewModeIcon = () => {
    switch (viewMode) {
      case 'split': return '⚡';
      case 'whiteboard': return '🎨';
      case 'code': return '💻';
    }
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-semibold">Workspace: {workspaceId}</h1>
          <div className="flex items-center space-x-2">
            <button
              className="p-3 rounded bg-blue-500 text-white"
              title="Pencil"
            >
              ✏️
            </button>
            <button
              className="p-3 rounded bg-red-100 hover:bg-red-200 text-red-600"
              onClick={() => {
                if (whiteboardRef.current) {
                  whiteboardRef.current.clearCanvas();
                }
              }}
              title="Clear Drawing"
            >
              🗑️
            </button>
            <div className="flex items-center space-x-2 ml-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer"
                title="Color"
              />
              <input
                type="range"
                min="1"
                max="20"
                value={width}
                onChange={(e) => setWidth(parseInt(e.target.value))}
                className="w-24"
                title="Size"
              />
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={cycleViewMode}
            className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200"
            title={`Current: ${viewMode}. Click to cycle view modes`}
          >
            {getViewModeIcon()}
          </button>
          <div className="px-4 py-2 rounded bg-green-100 text-green-800">
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div ref={containerRef} className="flex-1 flex relative select-none overflow-hidden">
        <WhiteboardProvider>
          <div 
            className={`absolute inset-0 ${
              viewMode === 'code' ? 'hidden' :
              viewMode === 'split' ? 'block' : 'w-full'
            }`}
            style={{ width: viewMode === 'split' ? `${splitPosition}%` : undefined }}
          >
            <Whiteboard ref={whiteboardRef} color={color} width={width} />
          </div>
        </WhiteboardProvider>
        <CodeEditorProvider>
          <div
            className={`absolute inset-0 z-10 ${
              viewMode === 'whiteboard' ? 'hidden' :
              viewMode === 'split' ? 'left-auto' : 'w-full'
            }`}
            style={{ 
              width: viewMode === 'split' ? `${100 - splitPosition}%` : undefined,
              right: 0
            }}
          >
            <CodeEditor />
          </div>
        </CodeEditorProvider>
        {viewMode === 'split' && (
          <div
            ref={dragRef}
            className="absolute top-0 bottom-0 w-2 bg-gray-300 hover:bg-blue-500 cursor-col-resize z-20"
            style={{ left: `${splitPosition}%`, transform: 'translateX(-50%)' }}
            onMouseDown={handleMouseDown}
          />
        )}
        {isDragging && (
          <div 
            className="fixed inset-0 z-50 cursor-col-resize"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          />
        )}
      </div>
    </div>
  );
}
