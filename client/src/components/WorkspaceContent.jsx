import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useCursorSync } from '../hooks';
import { useTranslation } from 'react-i18next';
import { useWhiteboard } from '../context/WhiteboardContext';
import { useSocket } from '../context/SocketContext';
import { useSharing } from '../context/SharingContext';
import { useDiagramEditor } from '../context/DiagramEditorContext';
import { Header, Toolbar } from './layout';
import { Notification, ConnectionStatus, LanguageSwitcher, ZoomControls, RemoteCursors } from './ui';
import Whiteboard from './Whiteboard';
import CodeEditor from './CodeEditor';
import DiagramRenderer from './DiagramRenderer';
import { v4 as uuidv4 } from 'uuid';
import { MERMAID_THEME, SOCKET_EVENTS, TOOLS } from '../constants';

export default function WorkspaceContent({
  workspaceId,
  viewMode,
  splitPosition,
  isDragging,
  handleMouseDown,
  containerRef,
  cycleViewMode,
  onShareClick
}) {
  const { t } = useTranslation(['workspace', 'editor', 'messages', 'common']);
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
    fontSize,
    setFontSize,
    color,
    setColor,
    zoom,
    setZoom,
    canvasRef,
    activeUsers
  } = useWhiteboard();

  const { canWrite, isOwner, sharingInfoReceived } = useSharing();
  const { content: diagramContent } = useDiagramEditor();
  const { remoteCursors, emitCursorPosition } = useCursorSync();

  const [activeTab, setActiveTab] = useState('code');
  const [notification, setNotification] = useState({ visible: false, message: '', type: 'info' });
  const [previousEditAccess, setPreviousEditAccess] = useState(canWrite());
  const [viewportTransform, setViewportTransform] = useState([1, 0, 0, 1, 0, 0]);
  const editAccessInitialized = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateViewport = () => {
      const vpt = canvas.viewportTransform;
      if (vpt) {
        setViewportTransform([...vpt]);
      }
    };

    updateViewport();

    canvas.on('after:render', updateViewport);

    return () => {
      canvas.off('after:render', updateViewport);
    };
  }, [canvasRef]);

  useEffect(() => {
    const currentEditAccess = canWrite();

    if (editAccessInitialized.current && currentEditAccess !== previousEditAccess) {
      setNotification({
        visible: true,
        message: currentEditAccess ? t('messages:notifications.editAccessGranted') : t('messages:notifications.editAccessRevoked'),
        type: currentEditAccess ? 'success' : 'warning'
      });
    }

    if (!editAccessInitialized.current && currentEditAccess) {
      editAccessInitialized.current = true;
    }

    setPreviousEditAccess(currentEditAccess);
  }, [canWrite, previousEditAccess, t]);


  const handleAddImageToWhiteboard = useCallback(async () => {
    try {
      // Dynamic import: only load mermaid library when actually needed
      const { default: mermaid } = await import('mermaid');

      await mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'loose',
        theme: 'default',
        fontFamily: "'Inter', sans-serif",
        fontSize: 16,
        flowchart: { htmlLabels: true, curve: 'basis', diagramPadding: 8, useMaxWidth: false },
        themeVariables: MERMAID_THEME
      });

      let { svg } = await mermaid.render(`diagram-${Date.now()}`, diagramContent);

      svg = svg
        .replace(/\.labelBkg\s*\{[^}]*background-color:[^}]*\}/gi, '.labelBkg{background-color:transparent;}')
        .replace(/fill="white"/g, 'fill="rgba(240, 245, 255, 0.7)"')
        .replace(/fill="#ffffff"/gi, 'fill="rgba(240, 245, 255, 0.7)"')
        .replace(/fill="#fff"/gi, 'fill="rgba(240, 245, 255, 0.7)"')
        .replace(/<rect.*?class="background".*?\/>/g, '')
        .replace(/style="background-color:.*?"/g, 'style="background-color:transparent"')
        .replace(/background-color:\s*rgba?\([^)]+\)/gi, 'background-color:transparent')
        .replace(/background-color:\s*#[0-9a-f]{3,6}/gi, 'background-color:transparent')
        .replace(/background:\s*rgba?\([^)]+\)/gi, 'background:transparent')
        .replace(/background:\s*#[0-9a-f]{3,6}/gi, 'background:transparent')
        .replace(/fill="rgb\([\d\s,]+\)"/gi, 'fill="rgba(240, 245, 255, 0.7)"');

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

        const canvas = canvasRef?.current;
        let centerX, centerY, scaleX;

        if (canvas) {
          const vpt = canvas.viewportTransform;
          const currentZoom = canvas.getZoom();
          const canvasWidth = canvas.getWidth();
          const canvasHeight = canvas.getHeight();

          const visibleCenterX = (-vpt[4] + canvasWidth / 2) / currentZoom;
          const visibleCenterY = (-vpt[5] + canvasHeight / 2) / currentZoom;

          centerX = visibleCenterX - (canvasWidth * 0.15) / currentZoom;
          centerY = visibleCenterY - (canvasHeight * 0.2) / currentZoom;

          const targetWidth = (canvasWidth * 0.18) / currentZoom;
          scaleX = targetWidth / tempCanvas.width;
        } else {
          const container = document.querySelector('.whiteboard-container') || document.body;
          const containerWidth = container.clientWidth || window.innerWidth;
          const containerHeight = container.clientHeight || window.innerHeight;
          centerX = containerWidth * 0.3;
          centerY = containerHeight * 0.2;
          const targetWidth = containerWidth * 0.15;
          scaleX = targetWidth / tempCanvas.width;
        }

        const elementData = {
          id: uuidv4(),
          type: 'diagram',
          data: {
            src: pngUrl,
            left: centerX,
            top: centerY,
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

        setTool(TOOLS.SELECT);
        setNotification({ visible: true, message: t('messages:notifications.diagramAdded'), type: 'success' });
      };

      img.src = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    } catch {
      setNotification({ visible: true, message: t('messages:errors.diagramAddFailed'), type: 'error' });
    }
  }, [addElement, setTool, diagramContent, socket, workspaceId, t, canvasRef]);

  const renderCodeEditor = useMemo(() => (
    <div className="h-full flex flex-col">
      <div className="border-b border-gray-200 p-2 flex justify-between items-center">
        <div className="flex items-center">
          <span className="text-sm font-medium text-gray-700 mr-4">
            {activeTab === 'code' ? t('editor:code.title') : t('editor:diagram.title')}
          </span>
          {!canWrite() && (
            <div className="ml-1 badge-readonly">
              {t('common:permissions.readOnly')}
            </div>
          )}
        </div>
        <div className="flex space-x-2 items-center">
          <button
            onClick={() => setActiveTab('code')}
            className={`px-3 py-1 rounded text-sm transition-colors ${activeTab === 'code' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            aria-pressed={activeTab === 'code'}
          >
            {t('codeboard.code')}
          </button>
          <button
            onClick={() => setActiveTab('diagram')}
            className={`px-3 py-1 rounded text-sm transition-colors ${activeTab === 'diagram' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            aria-pressed={activeTab === 'diagram'}
          >
            {t('codeboard.diagram')}
          </button>
          <button
            onClick={cycleViewMode}
            className="ml-2 p-1 rounded hover:bg-gray-200 transition-colors"
            aria-label={t('codeboard.closePanel')}
            title={t('codeboard.closePanel')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      {activeTab === 'code' ? (
        <CodeEditor />
      ) : (
        <DiagramRenderer
          onAddToWhiteboard={handleAddImageToWhiteboard}
          canAddToWhiteboard={canWrite()}
        />
      )}
    </div>
  ), [activeTab, canWrite, handleAddImageToWhiteboard, cycleViewMode, t]);

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden">
      <Header
        workspaceId={workspaceId}
        canWrite={canWrite}
      />

      <main className="flex-1 relative bg-gray-50" ref={containerRef}>
        <div className="absolute left-4 top-1/2 transform -translate-y-1/2 z-40 pointer-events-auto">
          <Toolbar
              tool={tool}
              setTool={setTool}
              selectedShape={selectedShape}
              setSelectedShape={setSelectedShape}
              color={color}
              setColor={setColor}
              width={width}
              setWidth={setWidth}
              fontSize={fontSize}
              setFontSize={setFontSize}
              canWrite={canWrite}
              isOwner={isOwner}
              onShareClick={onShareClick}
              clearCanvas={clearCanvas}
              socket={socket}
              workspaceId={workspaceId}
          />
        </div>

        {viewMode !== 'split' && (
          <button
            onClick={cycleViewMode}
            className="absolute top-4 right-4 z-40 p-2 bg-white rounded-lg shadow-md border border-gray-200 hover:bg-gray-50 transition-colors"
            aria-label={t('codeboard.openCodeBoard')}
            title={t('codeboard.openCodeBoard')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
          </button>
        )}
        <div className="h-full w-full whiteboard-container">
          <Whiteboard
            disabled={sharingInfoReceived && !canWrite()}
            onCursorMove={emitCursorPosition}
          />
          <RemoteCursors cursors={remoteCursors} viewportTransform={viewportTransform} />
          <ZoomControls zoom={zoom} onZoomChange={setZoom} />
        </div>

        {viewMode === 'split' && (
          <div
            className="absolute top-0 right-0 h-full bg-white shadow-lg z-10 flex"
            style={{
              width: `${splitPosition}%`,
              transition: isDragging ? 'none' : 'width 0.15s ease-out'
            }}
            role="complementary"
            aria-label={t('codeboard.codeEditorPanel')}
          >
            <div
              className="absolute top-0 left-0 h-full cursor-col-resize z-20 hover:bg-blue-100 transition-colors"
              style={{ width: '12px', transform: 'translateX(-50%)' }}
              onMouseDown={(e) => handleMouseDown(e, 'left')}
              role="separator"
              aria-label={t('codeboard.resizePanel')}
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
              aria-label={t('codeboard.resizePanel')}
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

        <div className="absolute bottom-4 left-4 z-40 pointer-events-auto flex items-center gap-2">
          <div className="bg-white rounded-lg shadow-md px-3 py-2 border border-gray-200 whitespace-nowrap">
            <ConnectionStatus
              status={connectionStatus}
              error={connectionError}
              participantCount={activeUsers}
            />
          </div>
          <LanguageSwitcher />
        </div>
      </main>
    </div>
  );
}
