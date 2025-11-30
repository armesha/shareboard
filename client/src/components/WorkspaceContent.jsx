import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useWhiteboard } from '../context/WhiteboardContext';
import { useSocket } from '../context/SocketContext';
import { useSharing } from '../context/SharingContext';
import { useDiagramEditor } from '../context/DiagramEditorContext';
import { Header, Toolbar } from './layout';
import { Notification } from './ui';
import Whiteboard from './Whiteboard';
import CodeEditor from './CodeEditor';
import DiagramRenderer from './DiagramRenderer';
import { v4 as uuidv4 } from 'uuid';
import mermaid from 'mermaid';
import { MERMAID_THEME, SOCKET_EVENTS, TIMING } from '../constants';
import { getPersistentUserId } from '../utils';

export default function WorkspaceContent({
  workspaceId,
  status,
  setStatus,
  viewMode,
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
    addElement,
    width,
    setWidth,
    color,
    setColor,
    activeUsers
  } = useWhiteboard();

  const { canWrite, sharingMode, isOwner } = useSharing();
  const { content: diagramContent } = useDiagramEditor();

  const [activeTab, setActiveTab] = useState('code');
  const [persistentUserId, setPersistentUserId] = useState(null);
  const [notification, setNotification] = useState({ visible: false, message: '', type: 'info' });
  const [previousEditAccess, setPreviousEditAccess] = useState(canWrite());
  const editAccessInitialized = useRef(false);

  useEffect(() => {
    setPersistentUserId(getPersistentUserId());
  }, []);

  useEffect(() => {
    const currentEditAccess = canWrite();

    if (editAccessInitialized.current && currentEditAccess !== previousEditAccess) {
      setNotification({
        visible: true,
        message: currentEditAccess ? "You've been granted edit access" : 'Edit access revoked',
        type: currentEditAccess ? 'success' : 'warning'
      });
    }

    if (!editAccessInitialized.current && currentEditAccess) {
      editAccessInitialized.current = true;
    }

    setPreviousEditAccess(currentEditAccess);
  }, [canWrite, previousEditAccess]);

  useEffect(() => {
    if (!socket || !workspaceId || !persistentUserId) return;

    const handleConnect = () => {
      setStatus('connected');
      socket.emit(SOCKET_EVENTS.JOIN_WORKSPACE, { workspaceId, userId: persistentUserId });
      socket.emit(SOCKET_EVENTS.REQUEST_CANVAS_STATE, workspaceId);
    };

    const handleDisconnect = () => setStatus('disconnected');
    const handleError = () => setStatus('error');

    socket.on(SOCKET_EVENTS.CONNECT, handleConnect);
    socket.on(SOCKET_EVENTS.DISCONNECT, handleDisconnect);
    socket.on(SOCKET_EVENTS.ERROR, handleError);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off(SOCKET_EVENTS.CONNECT, handleConnect);
      socket.off(SOCKET_EVENTS.DISCONNECT, handleDisconnect);
      socket.off(SOCKET_EVENTS.ERROR, handleError);
    };
  }, [socket, workspaceId, persistentUserId, setStatus]);

  const handleAddImageToWhiteboard = useCallback(async () => {
    try {
      await mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'loose',
        theme: 'default',
        fontFamily: 'Arial, sans-serif',
        fontSize: 16,
        flowchart: { htmlLabels: true, curve: 'basis', diagramPadding: 8, useMaxWidth: false },
        themeVariables: MERMAID_THEME
      });

      let { svg } = await mermaid.render(`diagram-${Date.now()}`, diagramContent);

      svg = svg
        .replace(/fill="white"/g, 'fill="rgba(240, 245, 255, 0.7)"')
        .replace(/fill="#ffffff"/g, 'fill="rgba(240, 245, 255, 0.7)"')
        .replace(/fill="#fff"/g, 'fill="rgba(240, 245, 255, 0.7)"')
        .replace(/<rect.*?class="background".*?\/>/g, '')
        .replace(/style="background-color:.*?"/g, 'style="background-color:transparent"');

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

        const container = document.querySelector('.whiteboard-container') || document.body;
        const containerWidth = container.clientWidth || window.innerWidth;
        const containerHeight = container.clientHeight || window.innerHeight;
        const targetWidth = containerWidth * 0.15;
        const scaleX = targetWidth / tempCanvas.width;

        const elementData = {
          id: uuidv4(),
          type: 'diagram',
          data: {
            src: pngUrl,
            left: containerWidth / 2,
            top: containerHeight / 4,
            scaleX,
            scaleY: scaleX,
            angle: 0,
            isDiagram: true,
            originalWidth: tempCanvas.width,
            originalHeight: tempCanvas.height
          }
        };

        addElement(elementData);

        if (socket && workspaceId) {
          socket.emit(SOCKET_EVENTS.WHITEBOARD_UPDATE, { workspaceId, elements: [elementData] });
        }

        setTool('select');
        setNotification({ visible: true, message: 'Diagram added to whiteboard', type: 'success' });
      };

      img.src = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    } catch {
      setNotification({ visible: true, message: 'Failed to add diagram', type: 'error' });
    }
  }, [addElement, setTool, diagramContent, socket, workspaceId]);

  const renderCodeEditor = useMemo(() => (
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
              aria-label="Add diagram to whiteboard"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add to Whiteboard
            </button>
          )}
          <button
            onClick={() => setActiveTab('code')}
            className={`px-3 py-1 rounded text-sm transition-colors ${activeTab === 'code' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            aria-pressed={activeTab === 'code'}
          >
            Code
          </button>
          <button
            onClick={() => setActiveTab('diagram')}
            className={`px-3 py-1 rounded text-sm transition-colors ${activeTab === 'diagram' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            aria-pressed={activeTab === 'diagram'}
          >
            Diagram
          </button>
        </div>
      </div>
      {activeTab === 'code' ? <CodeEditor /> : <DiagramRenderer workspaceId={workspaceId} />}
    </div>
  ), [activeTab, canWrite, handleAddImageToWhiteboard, workspaceId]);

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden">
      <Header
        workspaceId={workspaceId}
        canWrite={canWrite}
        connectionStatus={connectionStatus}
        connectionError={connectionError}
        activeUsers={activeUsers}
      />

      <main className="flex-1 relative bg-gray-50" ref={containerRef}>
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-30 pointer-events-none">
          <div className="pointer-events-auto">
            <Toolbar
              tool={tool}
              setTool={setTool}
              selectedShape={selectedShape}
              setSelectedShape={setSelectedShape}
              color={color}
              setColor={setColor}
              width={width}
              setWidth={setWidth}
              canWrite={canWrite}
              isOwner={isOwner}
              viewMode={viewMode}
              cycleViewMode={cycleViewMode}
              onShareClick={onShareClick}
              connectionStatus={connectionStatus}
              connectionError={connectionError}
              clearCanvas={clearCanvas}
              socket={socket}
              workspaceId={workspaceId}
            />
          </div>
        </div>
        <div className="h-full w-full whiteboard-container">
          <Whiteboard disabled={!canWrite()} />
        </div>

        {viewMode === 'split' && (
          <div
            className="absolute top-0 right-0 h-full bg-white shadow-lg z-10 flex"
            style={{
              width: `${splitPosition}%`,
              transition: isDragging ? 'none' : 'width 0.15s ease-out'
            }}
            role="complementary"
            aria-label="Code editor panel"
          >
            <div
              className="absolute top-0 left-0 h-full cursor-col-resize z-20 hover:bg-blue-100 transition-colors"
              style={{ width: '12px', transform: 'translateX(-50%)' }}
              onMouseDown={(e) => handleMouseDown(e, 'left')}
              role="separator"
              aria-label="Resize panel"
              tabIndex={0}
            >
              <div className={`absolute left-1/2 h-full w-1 transition-colors ${isDragging ? 'bg-blue-500' : 'bg-gray-300'}`} />
            </div>

            <div className="flex-1 h-full overflow-hidden">
              {renderCodeEditor}
            </div>

            <div
              className="absolute top-0 right-0 h-full cursor-col-resize z-20 hover:bg-blue-100 transition-colors"
              style={{ width: '12px', transform: 'translateX(50%)' }}
              onMouseDown={(e) => handleMouseDown(e, 'right')}
              role="separator"
              aria-label="Resize panel"
              tabIndex={0}
            >
              <div className={`absolute left-1/2 h-full w-1 transition-colors ${isDragging ? 'bg-blue-500' : 'bg-gray-300'}`} />
            </div>
          </div>
        )}

        <Notification
          message={notification.message}
          type={notification.type}
          visible={notification.visible}
          onClose={() => setNotification(prev => ({ ...prev, visible: false }))}
        />
      </main>
    </div>
  );
}
