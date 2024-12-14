import React, { useState, useRef, useEffect } from 'react';
import { useWhiteboard } from '../context/WhiteboardContext';
import Whiteboard from './Whiteboard';
import CodeEditor from './CodeEditor';
import DiagramRenderer from './DiagramRenderer';
import CropSquareIcon from '@mui/icons-material/CropSquare';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import ChangeHistoryIcon from '@mui/icons-material/ChangeHistory';
import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined';
import MouseIcon from '@mui/icons-material/Mouse';
import CreateIcon from '@mui/icons-material/Create';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ComputerIcon from '@mui/icons-material/Computer';
import AccountTreeIcon from '@mui/icons-material/AccountTree';

export default function WorkspaceContent({ 
  socket, 
  workspaceId, 
  status, 
  setStatus,
  viewMode, 
  splitPosition,
  isDragging,
  handleMouseDown,
  containerRef,
  cycleViewMode 
}) {
  const { clearCanvas, tool, setTool, selectedShape, setSelectedShape, color, setColor, width, setWidth } = useWhiteboard();
  const whiteboardRef = useRef(null);
  const [diagramMode, setDiagramMode] = useState(false);
  const [diagramSplitPosition, setDiagramSplitPosition] = useState(50);
  const [showShapesMenu, setShowShapesMenu] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showShapesMenu) {
        const isClickInsideShapesMenu = event.target.closest('.shapes-menu-container');
        const isClickOnShapesButton = event.target.closest('.shapes-button');
        if (!isClickInsideShapesMenu && !isClickOnShapesButton) {
          setShowShapesMenu(false);
          if (!selectedShape) {
            setTool('pen');
          }
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showShapesMenu, selectedShape]);

  useEffect(() => {
    if (!socket || !workspaceId) return;
    
    socket.on('connect', () => {
      setStatus('connected');
      console.log('Joining workspace:', workspaceId);
      socket.emit('join-workspace', workspaceId);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from workspace');
      setStatus('disconnected');
    });
    
    socket.on('error', (error) => {
      console.error('Workspace error:', error);
      setStatus('error');
    });

    // Request initial workspace state
    if (socket.connected) {
      socket.emit('join-workspace', workspaceId);
    }

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('error');
    };
  }, [socket, workspaceId]);

  // Header
  const renderHeader = () => (
    <div className="flex items-center justify-between px-6 py-3 bg-white border-b">
      <h1 className="text-xl font-semibold">Workspace: {workspaceId}</h1>
      <div className="flex items-center gap-4">
        <div className="flex items-center justify-center w-full">
          <div className="flex items-center space-x-3 bg-white rounded-full shadow px-4 py-1">
            {/* Select/Cursor tool */}
            <button
              className={`p-2 rounded-full transition-all duration-200 ${
                tool === 'select' ? 'bg-blue-500 hover:bg-blue-600' : 'hover:bg-gray-100'
              }`}
              onClick={() => {
                setTool('select');
                setSelectedShape(null);
              }}
              title="Select"
            >
              <MouseIcon className={tool === 'select' ? 'text-white' : 'text-gray-700'} />
            </button>

            <button
              className={`p-2 rounded-full transition-all duration-200 ${
                tool === 'pen' ? 'bg-blue-500 hover:bg-blue-600' : 'hover:bg-gray-100'
              }`}
              onClick={() => {
                setTool('pen');
                setSelectedShape(null);
                setShowShapesMenu(false);
              }}
              title="Pen"
            >
              <CreateIcon className={tool === 'pen' ? 'text-white' : 'text-gray-700'} />
            </button>

            {/* Shapes dropdown */}
            <div className="relative shapes-menu-container">
              <button
                className={`p-2 rounded-full transition-all duration-200 shapes-button ${
                  selectedShape ? 'bg-blue-500 hover:bg-blue-600' : 'hover:bg-gray-100'
                }`}
                onClick={() => {
                  if (showShapesMenu) {
                    setShowShapesMenu(false);
                    setSelectedShape(null);
                    setTool('pen');
                  } else {
                    setShowShapesMenu(true);
                    setTool('select');
                  }
                }}
                title="Shapes"
              >
                {selectedShape === 'rectangle' ? <CropSquareIcon className={selectedShape ? 'text-white' : 'text-gray-700'} /> : 
                 selectedShape === 'triangle' ? <ChangeHistoryIcon className={selectedShape ? 'text-white' : 'text-gray-700'} /> :
                 selectedShape === 'circle' ? <CircleOutlinedIcon className={selectedShape ? 'text-white' : 'text-gray-700'} /> : 
                 <CropSquareIcon className={selectedShape ? 'text-white' : 'text-gray-700'} />}
              </button>
              
              {showShapesMenu && (
                <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                  <button
                    className="w-full px-4 py-2 hover:bg-gray-100 flex items-center justify-center"
                    onClick={() => {
                      setSelectedShape('rectangle');
                      setTool('shapes');
                      setShowShapesMenu(false);
                    }}
                  >
                    <CropSquareIcon className="text-gray-700" />
                  </button>
                  <button
                    className="w-full px-4 py-2 hover:bg-gray-100 flex items-center justify-center"
                    onClick={() => {
                      setSelectedShape('triangle');
                      setTool('shapes');
                      setShowShapesMenu(false);
                    }}
                  >
                    <ChangeHistoryIcon className="text-gray-700" />
                  </button>
                  <button
                    className="w-full px-4 py-2 hover:bg-gray-100 flex items-center justify-center"
                    onClick={() => {
                      setSelectedShape('circle');
                      setTool('shapes');
                      setShowShapesMenu(false);
                    }}
                  >
                    <CircleOutlinedIcon className="text-gray-700" />
                  </button>
                </div>
              )}
            </div>

            <button
              className={`p-2 rounded-full transition-all duration-200 ${
                tool === 'text' ? 'bg-blue-500 hover:bg-blue-600' : 'hover:bg-gray-100'
              }`}
              onClick={() => {
                setTool(tool === 'text' ? 'select' : 'text');
                setSelectedShape(null);
              }}
              title="Text"
            >
              <TextFieldsIcon className={tool === 'text' ? 'text-white' : 'text-gray-700'} />
            </button>

            <div className="h-6 w-px bg-gray-200 mx-1" />
            <button
              className="p-2 rounded-full hover:bg-gray-100 transition-all duration-200"
              onClick={clearCanvas}
              title="Clear Drawing"
            >
              <DeleteOutlineIcon className="text-gray-700" />
            </button>
            {viewMode === 'split' ? (
              <>
                <button
                  className={`p-2 rounded-full transition-all duration-200 ${
                    !diagramMode ? 'bg-blue-500 hover:bg-blue-600' : 'hover:bg-gray-100'
                  }`}
                  onClick={() => setDiagramMode(false)}
                  title="Code Editor"
                >
                  <div className={!diagramMode ? 'text-white' : 'text-gray-700'}>
                    <ComputerIcon />
                  </div>
                </button>
                <button
                  className={`p-2 rounded-full transition-all duration-200 ${
                    diagramMode ? 'bg-purple-500 hover:bg-purple-600' : 'hover:bg-gray-100'
                  }`}
                  onClick={() => setDiagramMode(true)}
                  title="Diagram Editor"
                >
                  <div className={diagramMode ? 'text-white' : 'text-gray-700'}>
                    <AccountTreeIcon />
                  </div>
                </button>
              </>
            ) : (
              <button
                className="p-2 rounded-full hover:bg-gray-100 transition-all duration-200"
                onClick={cycleViewMode}
                title="Open Code Editor"
              >
                <ComputerIcon />
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
