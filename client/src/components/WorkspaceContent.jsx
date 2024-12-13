import { useState, useEffect, useRef } from 'react';
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
  const [diagramSplitPosition, setDiagramSplitPosition] = useState(50);
  const [showDiagram, setShowDiagram] = useState(false);

  const getViewModeIcon = () => {
    switch (viewMode) {
      case 'split': return '⚡';
      case 'whiteboard': return '🎨';
      case 'code': return showDiagram ? '📊' : '💻';
      default: return '⚡';
    }
  };

  const renderContent = () => {
    if (viewMode === 'whiteboard') {
      return <Whiteboard ref={whiteboardRef} socket={socket} tool={tool} color={color} width={width} />;
    }

    if (viewMode === 'code') {
      if (showDiagram) {
        return (
          <DiagramRenderer 
            splitPosition={diagramSplitPosition} 
            onSplitChange={setDiagramSplitPosition} 
          />
        );
      }
      return <CodeEditor socket={socket} workspaceId={workspaceId} />;
    }

    // Split mode
    return (
      <div className="flex-1 flex" ref={containerRef}>
        <div style={{ width: `${splitPosition}%` }}>
          {showDiagram ? (
            <DiagramRenderer 
              splitPosition={diagramSplitPosition} 
              onSplitChange={setDiagramSplitPosition} 
            />
          ) : (
            <CodeEditor socket={socket} workspaceId={workspaceId} />
          )}
        </div>
        <div
          className="w-1 cursor-col-resize bg-gray-300 hover:bg-blue-500"
          onMouseDown={handleMouseDown}
        />
        <div style={{ width: `${100 - splitPosition}%` }}>
          <Whiteboard ref={whiteboardRef} socket={socket} tool={tool} color={color} width={width} />
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-semibold">Workspace: {workspaceId}</h1>
          <div className="flex items-center space-x-2">
            {viewMode !== 'code' && (
              <>
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
              </>
            )}
            <div className="h-6 w-px bg-gray-300 mx-2" />
            <button
              className="p-3 rounded bg-gray-100 hover:bg-gray-200"
              onClick={cycleViewMode}
              title="Toggle View Mode"
            >
              {getViewModeIcon()}
            </button>
            {viewMode === 'code' && (
              <button
                className={`p-3 rounded transition-colors ${
                  showDiagram 
                    ? 'bg-purple-500 text-white hover:bg-purple-600' 
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
                onClick={() => setShowDiagram(!showDiagram)}
                title="Toggle Diagram Mode"
              >
                {showDiagram ? '💻' : '📊'}
              </button>
            )}
          </div>
        </div>
      </div>
      {renderContent()}
    </div>
  );
}
