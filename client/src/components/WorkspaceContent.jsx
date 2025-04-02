import React, { useState, useEffect, useCallback } from 'react';
import { useWhiteboard } from '../context/WhiteboardContext';
import { useSocket } from '../context/SocketContext';
import { useSharing } from '../context/SharingContext';
import { useNavigate } from 'react-router-dom';
import Whiteboard from './Whiteboard';
import CodeEditor from './CodeEditor';
import DiagramRenderer from './DiagramRenderer';
import { fabric } from 'fabric';
import CropSquareIcon from '@mui/icons-material/CropSquare';
import ChangeHistoryIcon from '@mui/icons-material/ChangeHistory';
import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined';
import MouseIcon from '@mui/icons-material/Mouse';
import CreateIcon from '@mui/icons-material/Create';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ComputerIcon from '@mui/icons-material/Computer';
import HomeIcon from '@mui/icons-material/Home';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import ShareIcon from '@mui/icons-material/Share';
import LockIcon from '@mui/icons-material/Lock';
import { v4 as uuidv4 } from 'uuid';

export default function WorkspaceContent({ 
  workspaceId, 
  status, 
  setStatus,
  viewMode, 
  setViewMode,
  splitPosition,
  isDragging,
  handleMouseDown,
  containerRef,
  cycleViewMode,
  onShareClick
}) {
  const { socket, connectionStatus, connectionError } = useSocket();
  const { 
    clearCanvas, 
    tool, 
    setTool, 
    selectedShape, 
    setSelectedShape,
    canvasRef,
    addElement,
    width,
    setWidth,
    color,
    setColor 
  } = useWhiteboard();
  
  const { canWrite, sharingMode, isOwner } = useSharing();
  
  const [showShapesMenu, setShowShapesMenu] = useState(false);
  const [activeTab, setActiveTab] = useState('code'); // 'code' or 'diagram'
  const [isConnected, setIsConnected] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [persistentUserId, setPersistentUserId] = useState(null);

  // Get persistent userId from localStorage
  useEffect(() => {
    let userId = localStorage.getItem('shareboardUserId');
    if (!userId) {
      userId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      localStorage.setItem('shareboardUserId', userId);
    }
    setPersistentUserId(userId);
  }, []);

  const handleAddImageToWhiteboard = useCallback((imageUrl) => {
    console.log('Adding diagram to whiteboard:', imageUrl);
    addElement({
      id: uuidv4(),
      type: 'diagram',
      data: {
        src: imageUrl,
        left: 100,
        top: 100,
        scaleX: 0.5,
        scaleY: 0.5,
        angle: 0
      }
    });
    setTool('select'); 
  }, [addElement, setTool]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showShapesMenu) {
        const isClickInsideShapesMenu = event.target.closest('.shapes-menu-container');
        const isClickOnShapesButton = event.target.closest('.shapes-button');
        if (!isClickInsideShapesMenu && !isClickOnShapesButton) {
          setShowShapesMenu(false);
          if (!selectedShape) {
            setSelectedShape(null);
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
    if (!socket || !persistentUserId) return;

    const handleConnect = () => {
      setIsConnected(true);
      socket.emit('join-workspace', { workspaceId, userId: persistentUserId });
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    setIsConnected(socket.connected);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    if (socket.connected) {
      socket.emit('join-workspace', { workspaceId, userId: persistentUserId });
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [socket, workspaceId, persistentUserId]);

  useEffect(() => {
    if (!socket || !workspaceId || !persistentUserId) return;
    
    socket.on('connect', () => {
      setStatus('connected');
      console.log('Joining workspace:', workspaceId, 'as user:', persistentUserId);
      socket.emit('join-workspace', { workspaceId, userId: persistentUserId });
      socket.emit('request-canvas-state', workspaceId);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from workspace');
      setStatus('disconnected');
    });
    
    socket.on('error', (error) => {
      console.error('Workspace error:', error);
      setStatus('error');
    });

    socket.on('canvas-state', (canvasState) => {
      if (canvasState && canvasRef.current) {
        canvasRef.current.loadFromJSON(canvasState, () => {
          canvasRef.current.renderAll();
        });
      }
    });

    if (socket.connected) {
      socket.emit('join-workspace', { workspaceId, userId: persistentUserId });
      socket.emit('request-canvas-state', workspaceId);
    }

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('error');
      socket.off('canvas-state');
    };
  }, [socket, workspaceId, persistentUserId, setStatus]);

  const ConnectionStatus = () => {
    if (!socket) return null;
    
    const getStatusColor = () => {
      switch(connectionStatus) {
        case 'connected': return 'text-green-600';
        case 'connecting': return 'text-yellow-600';
        case 'disconnected': return 'text-yellow-600';
        case 'error': return 'text-red-600';
        default: return 'text-gray-600';
      }
    };
    
    const getStatusText = () => {
      switch(connectionStatus) {
        case 'connected': return 'Online';
        case 'connecting': return 'Connecting...';
        case 'disconnected': return 'Offline - Reconnecting...';
        case 'error': return 'Connection Error';
        default: return 'Unknown Status';
      }
    };
    
    const getStatusDotColor = () => {
      switch(connectionStatus) {
        case 'connected': return 'bg-green-600';
        case 'connecting': return 'bg-yellow-600';
        case 'disconnected': return 'bg-yellow-600';
        case 'error': return 'bg-red-600';
        default: return 'bg-gray-600';
      }
    };
    
    return (
      <div className={`flex items-center gap-2 ${getStatusColor()}`} title={connectionError || ''}>
        <div className={`w-2 h-2 rounded-full ${getStatusDotColor()}`} />
        <span className="text-sm font-medium">
          {getStatusText()}
        </span>
      </div>
    );
  };

  const renderHeader = () => {
    const navigate = useNavigate();
    
    return (
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-full hover:bg-gray-100 transition-all duration-200"
            title="Return to Home"
          >
            <HomeIcon className="text-gray-700" />
          </button>
          <h1 className="text-xl font-semibold">Workspace: {workspaceId}</h1>
          
          {!canWrite() && (
            <div className="flex items-center ml-4 text-sm text-yellow-600 bg-yellow-50 px-2 py-1 rounded">
              <LockIcon className="h-4 w-4 mr-1" />
              Read-Only Mode
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-full">
            <div className="flex items-center space-x-3 bg-white rounded-full shadow-lg border border-gray-200 py-2 z-50">
              {/* Width control - only show if user can write */}
              {canWrite() && (
                <div className="flex items-center space-x-2 border-r pr-3">
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={width}
                    onChange={(e) => {
                      const newWidth = parseInt(e.target.value);
                      setWidth(newWidth);
                    }}
                    className="w-24"
                    title={`Width: ${width}px`}
                  />
                  <span className="text-sm text-gray-600 w-8">{width}px</span>
                </div>
              )}

              {/* Color Picker - only show if user can write */}
              {canWrite() && (
                <div className="flex items-center space-x-2 border-r pr-3">
                  <div className="flex flex-wrap gap-1 max-w-40">
                    {[
                      "#000000", // Black
                      "#FFFFFF", // White
                      "#FF0000", // Red
                      "#00FF00", // Green
                      "#0000FF", // Blue
                      "#FFFF00", // Yellow
                      "#FF00FF", // Magenta
                      "#00FFFF"  // Cyan
                    ].map((predefinedColor) => (
                      <button
                        key={predefinedColor}
                        className={`w-7 h-7 rounded-md border ${
                          color === predefinedColor ? 'ring-2 ring-blue-500 ring-offset-1' : 
                          predefinedColor === "#FFFFFF" ? 'border-gray-300' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: predefinedColor }}
                        onClick={() => setColor(predefinedColor)}
                        title={predefinedColor}
                      />
                    ))}
                  </div>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-8 h-8 cursor-pointer rounded"
                    title="Custom color"
                  />
                </div>
              )}

              {/* Select/Cursor tool - always shown */}
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

              {/* Drawing tools - only if user can write */}
              {canWrite() && (
                <>
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
                        } else {
                          setShowShapesMenu(true);
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
                </>
              )}

              <div className="h-6 w-px bg-gray-200 mx-1" />
              
              {/* Button for CodeBoard */}
              <button
                className="p-2 rounded-full hover:bg-gray-100 transition-all duration-200"
                onClick={cycleViewMode}
                title={viewMode === 'split' ? 'Close CodeBoard' : 'Open CodeBoard'}
              >
                <ComputerIcon className={`${viewMode === 'split' ? 'text-blue-500' : 'text-gray-700'}`} />
              </button>
              
              {/* Share Button */}
              <button
                className="p-2 rounded-full hover:bg-gray-100 transition-all duration-200"
                onClick={onShareClick}
                title="Share Settings"
              >
                <ShareIcon className={`text-${isOwner ? 'blue' : 'gray'}-500`} />
              </button>
              
              {/* More Options Dropdown - only if user can write */}
              {canWrite() && (
                <div className="relative">
                  <button
                    className="p-2 rounded-full hover:bg-gray-100 transition-all duration-200"
                    onClick={() => setShowOptionsMenu(!showOptionsMenu)}
                    title="More Options"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                  </button>
                  
                  {showOptionsMenu && (
                    <div className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50 w-48">
                      {/* Add other options here if needed */}
                      <button
                        className="w-full px-4 py-2 hover:bg-gray-100 flex items-center"
                        onClick={() => {
                          const confirmClear = window.confirm("Are you sure you want to clear the whiteboard?");
                          if (confirmClear) {
                            if (socket) {
                              socket.emit('whiteboard-clear', { workspaceId });
                            }
                            clearCanvas();
                          }
                          setShowOptionsMenu(false);
                        }}
                      >
                        <CleaningServicesIcon className="h-5 w-5 mr-2 text-red-500" />
                        <span>Clear Whiteboard</span>
                      </button>
                      {/* Add more options as needed */}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <ConnectionStatus />
        </div>
      </div>
    );
  };

  const renderCodeSection = () => (
    <div className="h-full flex flex-col">
      <div className="flex border-b border-gray-200">
        <button
          className={`px-4 py-2 ${activeTab === 'code' ? 'bg-white border-b-2 border-blue-500' : 'bg-gray-100'}`}
          onClick={() => setActiveTab('code')}
        >
          <ComputerIcon className="mr-2" />
          Code Editor
        </button>
        <button
          className={`px-4 py-2 ${activeTab === 'diagram' ? 'bg-white border-b-2 border-blue-500' : 'bg-gray-100'}`}
          onClick={() => setActiveTab('diagram')}
        >
          <AccountTreeIcon className="mr-2" />
          Diagram Editor
        </button>
      </div>
      <div className="flex-1">
        {activeTab === 'code' ? (
          <CodeEditor socket={socket} workspaceId={workspaceId} />
        ) : (
          <DiagramRenderer onAddImageToWhiteboard={handleAddImageToWhiteboard} />
        )}
      </div>
    </div>
  );

  const renderWhiteboardSection = () => (
    <div className="flex-1 relative">
      <Whiteboard disabled={!canWrite()} />
    </div>
  );

  const renderContent = () => {
    const whiteboardContent = (
      <div className="h-full w-full">
        <Whiteboard socket={socket} />
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
          {renderCodeSection()}
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
