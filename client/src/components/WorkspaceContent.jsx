import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { useDiagramEditor } from '../context/DiagramEditorContext';
import mermaid from 'mermaid';

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
  const { content: diagramContent } = useDiagramEditor();
  
  const [showShapesMenu, setShowShapesMenu] = useState(false);
  const [activeTab, setActiveTab] = useState('code'); // 'code' or 'diagram'
  const [isConnected, setIsConnected] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [persistentUserId, setPersistentUserId] = useState(null);
  const [showDiagramAddedNotification, setShowDiagramAddedNotification] = useState(false);
  const diagramRef = useRef(null);
  const [editAccessInitialized, setEditAccessInitialized] = useState(false);
  const [previousEditAccess, setPreviousEditAccess] = useState(canWrite());
  const [showAccessNotification, setShowAccessNotification] = useState(false);
  const [accessNotificationMessage, setAccessNotificationMessage] = useState('');

  useEffect(() => {
    let userId = localStorage.getItem('shareboardUserId');
    if (!userId) {
      userId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      localStorage.setItem('shareboardUserId', userId);
    }
    setPersistentUserId(userId);
  }, []);

  // Set tool to select only when edit permission is initially granted
  useEffect(() => {
    if (canWrite() && !editAccessInitialized) {
      console.log("Edit access granted - tools now available");
      // When edit access is initially granted, set the flag so we don't reset the tool anymore
      setEditAccessInitialized(true);
    }
  }, [canWrite, editAccessInitialized]);

  // Add debugging for isOwner status
  useEffect(() => {
    console.log(`WorkspaceContent status update:`, {
      isOwner,
      persistentUserId,
      sharingMode,
      canEdit: canWrite(),
      workspace: workspaceId
    });
  }, [isOwner, persistentUserId, sharingMode, canWrite, workspaceId]);

  // Track edit access changes
  useEffect(() => {
    const currentEditAccess = canWrite();
    
    // Only show notification if access changed after initialization
    if (editAccessInitialized && currentEditAccess !== previousEditAccess) {
      if (currentEditAccess) {
        setAccessNotificationMessage('You’ve been granted edit access');
      } else {
        setAccessNotificationMessage('Edit access revoked');
      }
      setShowAccessNotification(true);
      setTimeout(() => setShowAccessNotification(false), 3000);
    }
    
    setPreviousEditAccess(currentEditAccess);
  }, [canWrite, editAccessInitialized, previousEditAccess]);

  const handleAddImageToWhiteboard = useCallback(async () => {
    try {
      console.log('Starting high quality diagram generation for whiteboard');
      
      await mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'loose',
        theme: 'default',
        fontFamily: 'Arial, sans-serif',
        fontSize: 16,
        flowchart: {
          htmlLabels: true,
          curve: 'basis',
          diagramPadding: 8,
          useMaxWidth: false,
          nodeSpacing: 40,
          rankSpacing: 50,
          rankMargin: 30,
        },
        themeVariables: {
          primaryColor: '#0078D7',
          primaryTextColor: '#333',
          primaryBorderColor: '#0078D7',
          lineColor: '#0078D7',
          textColor: '#333',
          fontSize: '16px',
          background: 'transparent',
          backgroundColor: 'transparent',
          nodeBorder: '#0078D7',
          mainBkg: 'rgba(220, 225, 255, 0.7)',
          titleColor: '#333',
          edgeLabelBackground: 'transparent',
          clusterBkg: 'transparent',
          clusterBorder: '#0078D7',
        }
      });
      
      let { svg } = await mermaid.render(`diagram-${Date.now()}`, diagramContent);
      console.log('High-quality SVG rendered successfully');
      
      svg = svg
        .replace(/fill="white"/g, 'fill="rgba(240, 245, 255, 0.7)"')
        .replace(/fill="#ffffff"/g, 'fill="rgba(240, 245, 255, 0.7)"')
        .replace(/fill="#fff"/g, 'fill="rgba(240, 245, 255, 0.7)"')
        .replace(/<rect.*?class="background".*?\/>/g, '')
        .replace(/style="background-color:.*?"/g, 'style="background-color:transparent"')
        .replace(/font-family=".*?"/g, 'font-family="Arial, sans-serif"')
        .replace(/font-size=".*?"/g, 'font-size="16px"') 
        .replace(/stroke-width="1"/g, 'stroke-width="1.5"')
        .replace(/stroke-width="1.2"/g, 'stroke-width="1.5"')
        .replace(/stroke="/g, 'stroke-width="1.5" stroke="')
        .replace(/<g class="node/g, '<g filter="url(#shadow)" class="node')
        .replace(/<svg /g, '<svg xmlns:xlink="http://www.w3.org/1999/xlink" ');
      
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = svg;
      const svgElement = tempDiv.querySelector('svg');
      
      if (svgElement) {
        if (!svgElement.querySelector('defs')) {
          const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
          const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
          filter.setAttribute('id', 'shadow');
          filter.setAttribute('x', '-8%');
          filter.setAttribute('y', '-8%');
          filter.setAttribute('width', '116%');
          filter.setAttribute('height', '116%');
          
          const feDropShadow = document.createElementNS('http://www.w3.org/2000/svg', 'feDropShadow');
          feDropShadow.setAttribute('dx', '1');
          feDropShadow.setAttribute('dy', '1');
          feDropShadow.setAttribute('stdDeviation', '2');
          feDropShadow.setAttribute('flood-opacity', '0.3');
          feDropShadow.setAttribute('flood-color', 'rgb(0, 0, 0)');
          
          filter.appendChild(feDropShadow);
          defs.appendChild(filter);
          svgElement.insertBefore(defs, svgElement.firstChild);
        }
        
        svgElement.style.backgroundColor = 'transparent';
        svgElement.setAttribute('background', 'transparent');
        
        if (!svgElement.hasAttribute('width') || !svgElement.hasAttribute('height')) {
          const viewBox = svgElement.getAttribute('viewBox')?.split(' ');
          if (viewBox && viewBox.length === 4) {
            const width = parseInt(viewBox[2], 10);
            const height = parseInt(viewBox[3], 10);
            svgElement.setAttribute('width', width);
            svgElement.setAttribute('height', height);
          }
        }
        
        svg = tempDiv.innerHTML;
      }
      
      const img = new Image();
      img.onload = () => {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.width * 2.0;
        tempCanvas.height = img.height * 2.0;
        const ctx = tempCanvas.getContext('2d');
        
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        ctx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
        
        ctx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);
        
        const pngUrl = tempCanvas.toDataURL('image/png', 1.0);
        console.log('Super-quality PNG created, dimensions:', tempCanvas.width, 'x', tempCanvas.height);
        
        const preloadImg = new Image();
        preloadImg.onload = () => {
          console.log("Diagram image verified and ready to add:", preloadImg.width, "x", preloadImg.height);
          
          const container = document.querySelector('.whiteboard-container') || document.body;
          const containerWidth = container.clientWidth || window.innerWidth;
          const containerHeight = container.clientHeight || window.innerHeight;
          
          const targetWidth = containerWidth * 0.15;
          const scaleX = targetWidth / tempCanvas.width;
          
          const newElementId = uuidv4();
          const elementData = {
            id: newElementId,
            type: 'diagram',
            data: {
              src: pngUrl,
              left: containerWidth / 2, 
              top: containerHeight / 4,
              scaleX: scaleX,
              scaleY: scaleX, 
              angle: 0,
              isDiagram: true,
              originalWidth: tempCanvas.width,
              originalHeight: tempCanvas.height
            }
          };
          
          console.log("Adding diagram with small scale but high quality:", scaleX);
          addElement(elementData);
          
          if (socket && workspaceId) {
            console.log('Sending compact high-quality diagram to server');
            socket.emit('whiteboard-update', {
              workspaceId,
              elements: [elementData]
            });
          }
          
          setTool('select');
          setShowDiagramAddedNotification(true);
          setTimeout(() => setShowDiagramAddedNotification(false), 3000);
        };
        
        preloadImg.onerror = (error) => {
          console.error('Error verifying diagram image:', error);
        };
        
        preloadImg.src = pngUrl;
      };
      
      img.onerror = (error) => {
        console.error('Error loading SVG image:', error);
      };
      
      img.src = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    } catch (error) {
      console.error('Error adding diagram to whiteboard:', error);
    }
  }, [addElement, setTool, diagramContent, socket, workspaceId]);

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

              {}
              {canWrite() && (
                <div className="flex items-center space-x-2 border-r pr-3">
                  <div className="flex flex-wrap gap-1 max-w-40">
                    {[
                      "#000000", "#FFFFFF", "#FF0000", "#00FF00", "#0000FF",
                      "#FFFF00", "#FF00FF", "#00FFFF", "#FFA500", "#808080"
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
                } ${!canWrite() ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={() => {
                  setTool('select');
                  setSelectedShape(null);
                }}
                title={canWrite() ? "Select" : "Select (Read-Only View)"}
              >
                <MouseIcon className={tool === 'select' ? 'text-white' : 'text-gray-700'} />
              </button>

              {!canWrite() && (
                <div className="ml-2 text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded flex items-center">
                  <LockIcon className="h-3 w-3 mr-1" />
                  View Only
                </div>
              )}

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
              
              {}
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
                      
                      {isOwner && (
                        <button
                          className="w-full px-4 py-2 hover:bg-gray-100 flex items-center"
                          onClick={() => {
                            const confirmEnd = window.confirm("Are you sure you want to end the session for all participants?");
                            if (confirmEnd) {
                              if (socket) {
                                socket.emit('end-session', { workspaceId });
                              }
                            }
                            setShowOptionsMenu(false);
                          }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                          </svg>
                          <span>End Session</span>
                        </button>
                      )}
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

  const renderCodeEditor = () => {
    return (
      <div className="h-full flex flex-col">
        <div className="border-b border-gray-200 p-2 flex justify-between items-center">
          <div className="flex items-center">
            <span className="text-sm font-medium text-gray-700 mr-4">
              {activeTab === 'code' ? 'Code Editor' : 'Diagram Editor'}
            </span>
            {!canWrite() && (
              <div className="ml-1 px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-md">
                Read-Only
              </div>
            )}
          </div>
          <div className="flex space-x-2 items-center">
            {activeTab === 'diagram' && canWrite() && (
              <button
                onClick={handleAddImageToWhiteboard}
                className="px-3 py-1 bg-green-600 text-white hover:bg-green-700 rounded-md text-sm mr-3 flex items-center shadow-md transition-all duration-200 font-medium"
                title="Instantly add the current diagram to whiteboard (no confirmation)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add to Whiteboard
              </button>
            )}
            <button
              onClick={() => setActiveTab('code')}
              className={`px-3 py-1 rounded text-sm ${
                activeTab === 'code' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Code
            </button>
            <button
              onClick={() => setActiveTab('diagram')}
              className={`px-3 py-1 rounded text-sm ${
                activeTab === 'diagram' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Diagram
            </button>
          </div>
        </div>
        {activeTab === 'code' ? <CodeEditor /> : <DiagramRenderer workspaceId={workspaceId} />}
      </div>
    );
  };

  const renderDiagramEditor = () => {
    return (
      <div className="h-full flex flex-col">
        <div className="border-b border-gray-200 p-2 flex justify-between items-center">
          <div className="flex items-center">
            <span className="text-sm font-medium text-gray-700 mr-4">Diagram Editor</span>
            {!canWrite() && (
              <div className="ml-1 px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-md">
                Read-Only
              </div>
            )}
          </div>
          <button
            onClick={handleAddImageToWhiteboard}
            className={`px-3 py-1 ${
              canWrite() 
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            } rounded text-sm`}
            disabled={!canWrite()}
            title={!canWrite() ? "Read-only mode - Cannot add to whiteboard" : "Add to Whiteboard"}
          >
            Add to Whiteboard
          </button>
        </div>
        <DiagramRenderer workspaceId={workspaceId} />
      </div>
    );
  };

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
          {renderCodeEditor()}
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
        
        {/* Diagram added notification */}
        {showDiagramAddedNotification && (
          <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-md shadow-lg z-50 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Diagram added to whiteboard
          </div>
        )}
        
        {/* Access change notification */}
        {showAccessNotification && (
          <div className={`fixed bottom-4 left-1/2 transform -translate-x-1/2 ${canWrite() ? 'bg-green-500' : 'bg-yellow-500'} text-white px-4 py-2 rounded-md shadow-lg z-50 flex items-center`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {canWrite() ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              )}
            </svg>
            {accessNotificationMessage}
          </div>
        )}
      </div>
    </div>
  );
}
