import { useState, useEffect, useCallback, useRef, type RefObject, type MouseEvent as ReactMouseEvent } from 'react';
import { useCursorSync } from '../hooks';
import { useDiagramToCanvas } from '../hooks/useDiagramToCanvas';
import { useTranslation } from 'react-i18next';
import { useWhiteboard } from '../context/WhiteboardContext';
import { useSocket } from '../context/SocketContext';
import { useSharing } from '../context/SharingContext';
import { useDiagramEditor } from '../context/DiagramEditorContext';
import { Header, Toolbar } from './layout';
import { Notification, ConnectionStatus, LanguageSwitcher, ZoomControls, RemoteCursors } from './ui';
import Whiteboard from './Whiteboard';
import CodeEditorPanel from './CodeEditorPanel';
import { CONNECTION_STATUS } from '../constants';
import type { Socket } from 'socket.io-client';
import type { Canvas } from 'fabric';

type ViewMode = 'whiteboard' | 'split';
type ViewportTransform = [number, number, number, number, number, number];
type ConnectionStatusType = typeof CONNECTION_STATUS[keyof typeof CONNECTION_STATUS];

interface NotificationState {
  visible: boolean;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

interface WorkspaceContentProps {
  workspaceId: string;
  viewMode: ViewMode;
  splitPosition: number;
  isDragging: boolean;
  handleMouseDown: (e: ReactMouseEvent<HTMLDivElement>, direction: 'left' | 'right') => void;
  containerRef: RefObject<HTMLDivElement | null>;
  cycleViewMode: () => void;
  onShareClick: () => void;
}

export default function WorkspaceContent({
  workspaceId,
  viewMode,
  splitPosition,
  isDragging,
  handleMouseDown,
  containerRef,
  cycleViewMode,
  onShareClick
}: WorkspaceContentProps) {
  const { t } = useTranslation(['workspace', 'messages']);
  const { socket, connectionStatus, connectionError } = useSocket() as {
    socket: Socket | null;
    connectionStatus: ConnectionStatusType;
    connectionError: string | null;
  };
  const {
    clearCanvas, tool, setTool, selectedShape, setSelectedShape,
    addElement, width, setWidth, fontSize, setFontSize,
    color, setColor, zoom, setZoom, canvasRef, activeUsers
  } = useWhiteboard();

  const { canWrite, isOwner, sharingInfoReceived } = useSharing();
  const { content: diagramContent } = useDiagramEditor();
  const { remoteCursors, emitCursorPosition } = useCursorSync();

  const [notification, setNotification] = useState<NotificationState>({ visible: false, message: '', type: 'info' });
  const [previousEditAccess, setPreviousEditAccess] = useState(canWrite());
  const [viewportTransform, setViewportTransform] = useState<ViewportTransform>([1, 0, 0, 1, 0, 0]);
  const editAccessInitialized = useRef(false);

  const handleAddDiagram = useDiagramToCanvas({
    diagramContent,
    canvasRef: canvasRef as { current: Canvas | null },
    addElement,
    setTool,
    socket,
    workspaceId,
    onSuccess: () => setNotification({ visible: true, message: t('messages:notifications.diagramAdded'), type: 'success' }),
    onError: () => setNotification({ visible: true, message: t('messages:errors.diagramAddFailed'), type: 'error' })
  });

  useEffect(() => {
    const canvas = canvasRef.current as Canvas | null;
    if (!canvas) return;

    const updateViewport = () => {
      const vpt = canvas.viewportTransform;
      if (vpt) setViewportTransform([...vpt] as ViewportTransform);
    };

    updateViewport();
    canvas.on('after:render', updateViewport);
    return () => { canvas.off('after:render', updateViewport); };
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

  const closeNotification = useCallback(() => {
    setNotification(prev => ({ ...prev, visible: false }));
  }, []);

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden">
      <Header workspaceId={workspaceId} canWrite={canWrite} />

      <main className="flex-1 relative bg-gray-50" ref={containerRef}>
        <div className="absolute left-4 top-1/2 transform -translate-y-1/2 z-40 pointer-events-auto">
          <Toolbar
            tool={tool} setTool={setTool}
            selectedShape={selectedShape} setSelectedShape={setSelectedShape}
            color={color} setColor={setColor}
            width={width} setWidth={setWidth}
            fontSize={fontSize} setFontSize={setFontSize}
            canWrite={canWrite} isOwner={isOwner}
            onShareClick={onShareClick} clearCanvas={clearCanvas}
            socket={socket} workspaceId={workspaceId}
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
          <Whiteboard disabled={sharingInfoReceived && !canWrite()} onCursorMove={emitCursorPosition} />
          <RemoteCursors cursors={remoteCursors} viewportTransform={viewportTransform} />
          <ZoomControls zoom={zoom} onZoomChange={setZoom} />
        </div>

        {viewMode === 'split' && (
          <div
            className="absolute top-0 right-0 h-full bg-white shadow-lg z-10 flex"
            style={{ width: `${splitPosition}%`, transition: isDragging ? 'none' : 'width 0.15s ease-out' }}
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
              <CodeEditorPanel
                canWrite={canWrite}
                onAddToWhiteboard={handleAddDiagram}
                onClose={cycleViewMode}
              />
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
          onClose={closeNotification}
        />

        <div className="absolute bottom-4 left-4 z-40 pointer-events-auto flex items-center gap-2">
          <div className="bg-white rounded-lg shadow-md px-3 py-2 border border-gray-200 whitespace-nowrap">
            <ConnectionStatus status={connectionStatus} error={connectionError} participantCount={activeUsers} />
          </div>
          <LanguageSwitcher />
        </div>
      </main>
    </div>
  );
}
