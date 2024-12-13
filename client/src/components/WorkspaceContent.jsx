import { useState, useRef } from 'react';
import { useWhiteboard } from '../context/WhiteboardContext';
import Whiteboard from './Whiteboard';
import CodeEditor from './CodeEditor';
import DiagramRenderer from './DiagramRenderer';

export default function WorkspaceContent({ 
  socket, 
  workspaceId, 
  status, 
  viewMode, 
  splitPosition,
  isDragging,
  handleMouseDown,
  containerRef,
  cycleViewMode 
}) {
  const { clearCanvas } = useWhiteboard();
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#000000');
  const [width, setWidth] = useState(5);
  const whiteboardRef = useRef(null);
  const [diagramMode, setDiagramMode] = useState(false);
  const [diagramSplitPosition, setDiagramSplitPosition] = useState(50);

  // Toolbar buttons
  const renderToolButtons = () => (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 flex items-center space-x-3 bg-white rounded-full shadow-lg px-4 py-2 z-20">
      <button
        className="p-2.5 rounded-full hover:bg-gray-100 transition-all duration-200"
        onClick={() => setTool('pen')}
        title="Pencil"
      >
        ✏️
      </button>
      <button
        className="p-2.5 rounded-full hover:bg-gray-100 transition-all duration-200"
        onClick={clearCanvas}
        title="Clear Drawing"
      >
        🗑️
      </button>
      <div className="h-6 w-px bg-gray-200 mx-1" />
      {viewMode === 'split' ? (
        <>
          <button
            className={`p-2.5 rounded-full transition-all duration-200 ${
              !diagramMode ? 'bg-blue-500 text-white' : 'hover:bg-gray-100'
            }`}
            onClick={() => setDiagramMode(false)}
            title="Code Editor"
          >
            💻
          </button>
          <button
            className={`p-2.5 rounded-full transition-all duration-200 ${
              diagramMode ? 'bg-purple-500 text-white' : 'hover:bg-gray-100'
            }`}
            onClick={() => setDiagramMode(true)}
            title="Diagram Editor"
          >
            📊
          </button>
        </>
      ) : (
        <button
          className="p-2.5 rounded-full hover:bg-gray-100 transition-all duration-200"
          onClick={cycleViewMode}
          title="Open Code Editor"
        >
          💻
        </button>
      )}
      {viewMode === 'split' && (
        <>
          <div className="h-6 w-px bg-gray-200 mx-1" />
          <button
            className="p-2.5 rounded-full hover:bg-gray-100 transition-all duration-200"
            onClick={cycleViewMode}
            title="Full Screen"
          >
            ⛶
          </button>
        </>
      )}
    </div>
  );

  // Header
  const renderHeader = () => (
    <div className="flex items-center justify-between px-6 py-3 bg-white border-b">
      <h1 className="text-xl font-semibold">Workspace: {workspaceId}</h1>
      <div className="text-sm text-gray-600">
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </div>
    </div>
  );

  const renderContent = () => {
    const whiteboardContent = (
      <div className={`h-full ${viewMode === 'split' ? `w-[${100 - splitPosition}%]` : 'w-full'}`}>
        <Whiteboard 
          ref={whiteboardRef} 
          socket={socket} 
          tool={tool} 
          color={color} 
          width={width} 
        />
      </div>
    );

    if (viewMode === 'whiteboard') {
      return (
        <div className="flex-1 relative">
          {whiteboardContent}
        </div>
      );
    }

    if (viewMode === 'split') {
      return (
        <div className="flex-1 flex relative h-full" ref={containerRef}>
          <div 
            className="h-full flex flex-col bg-white relative"
            style={{ width: `${splitPosition}%` }}
          >
            {diagramMode ? (
              <DiagramRenderer 
                splitPosition={diagramSplitPosition}
                onSplitChange={setDiagramSplitPosition}
              />
            ) : (
              <div className="absolute inset-0">
                <CodeEditor socket={socket} workspaceId={workspaceId} />
              </div>
            )}
          </div>
          <div
            className={`w-1.5 h-full cursor-col-resize bg-gray-300 hover:bg-blue-500 ${isDragging ? 'bg-blue-500' : ''}`}
            onMouseDown={handleMouseDown}
          />
          <div className="h-full flex-1">
            {whiteboardContent}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden">
      {renderHeader()}
      <div className="flex-1 relative bg-gray-50">
        {renderContent()}
        {renderToolButtons()}
      </div>
    </div>
  );
}
