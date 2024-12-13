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
  const [showShapesMenu, setShowShapesMenu] = useState(false);
  const [selectedShape, setSelectedShape] = useState(null);

  // Header
  const renderHeader = () => (
    <div className="flex items-center justify-between px-6 py-3 bg-white border-b">
      <h1 className="text-xl font-semibold">Workspace: {workspaceId}</h1>
      <div className="flex items-center gap-4">
        <div className="flex items-center justify-center w-full">
          <div className="flex items-center space-x-3 bg-white rounded-full shadow px-4 py-1">
            {/* Select/Cursor tool */}
            <button
              className={`p-2 rounded-full hover:bg-gray-100 transition-all duration-200 ${
                tool === 'select' ? 'bg-blue-500 text-white' : ''
              }`}
              onClick={() => {
                setTool('select');
                setSelectedShape(null);
              }}
              title="Select"
            >
              ⬆️
            </button>

            <button
              className={`p-2 rounded-full hover:bg-gray-100 transition-all duration-200 ${
                tool === 'pen' ? 'bg-blue-500 text-white' : ''
              }`}
              onClick={() => {
                setTool('pen');
                setSelectedShape(null);
                setShowShapesMenu(false);
              }}
              title="Pen"
            >
              ✏️
            </button>

            {/* Shapes dropdown */}
            <div className="relative">
              <button
                className={`p-2 rounded-full hover:bg-gray-100 transition-all duration-200 ${
                  tool === 'shapes' ? 'bg-blue-500 text-white' : ''
                }`}
                onClick={() => {
                  setShowShapesMenu(!showShapesMenu);
                }}
                title="Shapes"
              >
                {selectedShape === 'rectangle' ? '▭' : 
                 selectedShape === 'triangle' ? '△' :
                 selectedShape === 'arrow' ? '→' :
                 selectedShape === 'circle' ? '○' : '▭'}
              </button>
              
              {showShapesMenu && (
                <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                  <button
                    className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center justify-center"
                    onClick={() => {
                      setSelectedShape('rectangle');
                      setTool('shapes');
                      setShowShapesMenu(false);
                    }}
                  >
                    ▭
                  </button>
                  <button
                    className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center justify-center"
                    onClick={() => {
                      setSelectedShape('triangle');
                      setTool('shapes');
                      setShowShapesMenu(false);
                    }}
                  >
                    △
                  </button>
                  <button
                    className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center justify-center"
                    onClick={() => {
                      setSelectedShape('arrow');
                      setTool('shapes');
                      setShowShapesMenu(false);
                    }}
                  >
                    →
                  </button>
                  <button
                    className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center justify-center"
                    onClick={() => {
                      setSelectedShape('circle');
                      setTool('shapes');
                      setShowShapesMenu(false);
                    }}
                  >
                    ○
                  </button>
                </div>
              )}
            </div>

            <button
              className={`p-2 rounded-full hover:bg-gray-100 transition-all duration-200 ${
                tool === 'text' ? 'bg-blue-500 text-white' : ''
              }`}
              onClick={() => {
                setTool(tool === 'text' ? 'select' : 'text');
                setSelectedShape(null);
              }}
              title="Text"
            >
              T
            </button>

            <div className="h-6 w-px bg-gray-200 mx-1" />
            <button
              className="p-2 rounded-full hover:bg-gray-100 transition-all duration-200"
              onClick={clearCanvas}
              title="Clear Drawing"
            >
              🗑️
            </button>
            {viewMode === 'split' ? (
              <>
                <button
                  className={`p-2 rounded-full transition-all duration-200 ${
                    !diagramMode ? 'bg-blue-500 text-white' : 'hover:bg-gray-100'
                  }`}
                  onClick={() => setDiagramMode(false)}
                  title="Code Editor"
                >
                  💻
                </button>
                <button
                  className={`p-2 rounded-full transition-all duration-200 ${
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
                className="p-2 rounded-full hover:bg-gray-100 transition-all duration-200"
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
                  className="p-2 rounded-full hover:bg-gray-100 transition-all duration-200"
                  onClick={cycleViewMode}
                  title="Full Screen"
                >
                  ⛶
                </button>
              </>
            )}
          </div>
        </div>
        <div className="text-sm text-gray-600">
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </div>
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
          selectedShape={selectedShape}
          setTool={setTool}
          setSelectedShape={setSelectedShape}
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
          {/* Увеличиваем область захвата */}
          <div className="relative" style={{ width: '12px', margin: '0 -6px' }}>
            <div
              className={`absolute inset-0 w-1 h-full cursor-col-resize bg-gray-300 hover:bg-blue-500 ${isDragging ? 'bg-blue-500' : ''}`}
              style={{ left: '50%', transform: 'translateX(-50%)' }}
            />
            <div
              className="absolute inset-0 cursor-col-resize"
              onMouseDown={handleMouseDown}
            />
          </div>
          <div 
            className="h-full"
            style={{ width: `${100 - splitPosition}%` }}
          >
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
      </div>
    </div>
  );
}
