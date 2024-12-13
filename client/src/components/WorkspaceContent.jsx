import { useState, useEffect, useRef } from 'react';
import { useWhiteboard } from '../context/WhiteboardContext';
import Whiteboard from './Whiteboard';
import CodeEditor from './CodeEditor';

export default function WorkspaceContent({ 
  socket, 
  workspaceId, 
  status, 
  viewMode, 
  splitPosition,
  isDragging,
  handleMouseDown,
  containerRef 
}) {
  const { clearCanvas } = useWhiteboard();
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#000000');
  const [width, setWidth] = useState(5);
  const whiteboardRef = useRef(null);

  const getViewModeIcon = () => {
    switch (viewMode) {
      case 'split': return '⚡';
      case 'whiteboard': return '🎨';
      case 'code': return '💻';
      default: return '⚡';
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
              onClick={clearCanvas}
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
          <div className="px-4 py-2 rounded bg-green-100 text-green-800">
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div ref={containerRef} className="flex-1 flex relative select-none overflow-hidden">
        <div 
          className={`absolute inset-0 ${
            viewMode === 'code' ? 'hidden' :
            viewMode === 'split' ? 'block' : 'w-full'
          }`}
          style={{ width: viewMode === 'split' ? `${splitPosition}%` : undefined }}
        >
          <Whiteboard ref={whiteboardRef} color={color} width={width} />
        </div>
        <CodeEditor 
          style={{
            width: viewMode === 'whiteboard' ? '0' :
                   viewMode === 'split' ? `${100 - splitPosition}%` : '100%',
            marginLeft: viewMode === 'split' ? `${splitPosition}%` : '0'
          }}
        />
        {viewMode === 'split' && (
          <div
            className="absolute h-full w-1 bg-gray-300 cursor-col-resize hover:bg-gray-400"
            style={{ left: `${splitPosition}%` }}
            onMouseDown={handleMouseDown}
          />
        )}
      </div>
    </div>
  );
}
