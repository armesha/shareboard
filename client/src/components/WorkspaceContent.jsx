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

  const handleAddImageToWhiteboard = (imageUrl) => {
    console.log('Adding image to whiteboard:', imageUrl); // Отладочный лог
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Добавляем поддержку CORS
    
    img.onload = () => {
      const canvas = whiteboardRef.current;
      if (!canvas) {
        console.error('Canvas not found');
        return;
      }
      
      console.log('Canvas found, drawing image...'); // Отладочный лог
      const ctx = canvas.getContext('2d');
      
      // Вычисляем размеры с сохранением пропорций
      const maxWidth = canvas.width * 0.5;
      const maxHeight = canvas.height * 0.5;
      let newWidth = img.width;
      let newHeight = img.height;
      
      const ratio = Math.min(maxWidth / img.width, maxHeight / img.height);
      newWidth = img.width * ratio;
      newHeight = img.height * ratio;
      
      // Центрируем изображение
      const x = (canvas.width - newWidth) / 2;
      const y = (canvas.height - newHeight) / 2;
      
      // Рисуем изображение
      ctx.drawImage(img, x, y, newWidth, newHeight);
      console.log('Image drawn successfully'); // Отладочный лог
      
      // Отправляем событие через сокет
      if (socket) {
        const drawData = {
          type: 'image',
          imageUrl,
          x,
          y,
          width: newWidth,
          height: newHeight,
          workspaceId
        };
        console.log('Emitting draw event:', drawData); // Отладочный лог
        socket.emit('draw', drawData);
      }
    };

    img.onerror = (error) => {
      console.error('Error loading image:', error);
    };

    img.src = imageUrl;
  };

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
      <div className="h-full w-full">
        <Whiteboard 
          ref={whiteboardRef} 
          socket={socket} 
        />
      </div>
    );

    const codeEditorOverlay = viewMode === 'split' && (
      <div 
        className="absolute top-0 right-0 h-full bg-white shadow-lg z-10 flex"
        style={{ 
          width: `${splitPosition}%`,
          transition: isDragging ? 'none' : 'width 0.1s ease-out'
        }}
      >
        {/* Left resize handle */}
        <div 
          className="absolute top-0 left-0 h-full cursor-col-resize z-20 hover:bg-blue-100"
          style={{ width: '12px', transform: 'translateX(-50%)' }}
          onMouseDown={(e) => handleMouseDown(e, 'left')}
        >
          <div className={`absolute left-1/2 h-full w-1 ${isDragging ? 'bg-blue-500' : 'bg-gray-300'}`} />
        </div>

        {/* Content */}
        <div className="flex-1 h-full overflow-hidden">
          {diagramMode ? (
            <div ref={containerRef} className="flex flex-1 h-full overflow-hidden">
              <DiagramRenderer 
                splitPosition={diagramSplitPosition}
                onSplitChange={setDiagramSplitPosition}
                onAddImageToWhiteboard={handleAddImageToWhiteboard}
              />
            </div>
          ) : (
            <div className="h-full">
              <CodeEditor socket={socket} workspaceId={workspaceId} />
            </div>
          )}
        </div>

        {/* Right resize handle */}
        <div 
          className="absolute top-0 right-0 h-full cursor-col-resize z-20 hover:bg-blue-100"
          style={{ width: '12px', transform: 'translateX(50%)' }}
          onMouseDown={(e) => handleMouseDown(e, 'right')}
        >
          <div className={`absolute left-1/2 h-full w-1 ${isDragging ? 'bg-blue-500' : 'bg-gray-300'}`} />
        </div>
      </div>
    );

    return (
      <div className="flex-1 relative" ref={containerRef}>
        {whiteboardContent}
        {codeEditorOverlay}
      </div>
    );
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
