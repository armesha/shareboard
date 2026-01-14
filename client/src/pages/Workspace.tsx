import { useState, useEffect, useRef, type MouseEvent, type RefObject } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSocket } from '../context/SocketContext';
import { WhiteboardProvider, useWhiteboard } from '../context/WhiteboardContext';
import { CodeEditorProvider } from '../context/CodeEditorContext';
import { DiagramEditorProvider } from '../context/DiagramEditorContext';
import { YjsProvider, useYjs } from '../context/YjsContext';
import { SharingProvider, useSharing } from '../context/SharingContext';
import WorkspaceContent from '../components/WorkspaceContent';
import SharingSettings from '../components/SharingSettings';
import { SOCKET_EVENTS, STORAGE_KEYS, LAYOUT, CONNECTION_STATUS } from '../constants';
import { toast } from '../utils/toast';
import { getPersistentUserId } from '../utils';

type ViewMode = 'whiteboard' | 'split';

interface WorkspaceStateData {
  isNewWorkspace?: boolean;
}

interface SessionEndedData {
  message: string;
}

function WorkspaceLayout() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const socketContext = useSocket();
  const socket = socketContext?.socket ?? null;
  const socketConnectionStatus = socketContext?.connectionStatus ?? CONNECTION_STATUS.CONNECTING;
  const whiteboardContext = useWhiteboard();
  const { isLoading, connectionStatus: whiteboardConnectionStatus } = whiteboardContext ?? {};
  const yjsContext = useYjs();
  const yjsStatus = yjsContext?.status ?? 'disconnected';
  const sharingContext = useSharing();
  const isOwner = sharingContext?.isOwner ?? false;
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>('whiteboard');
  const [splitPosition, setSplitPosition] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SPLIT_POSITION);
    return saved ? parseFloat(saved) : 40;
  });
  const [isDragging, setIsDragging] = useState(false);
  const [initialMouseX, setInitialMouseX] = useState<number | null>(null);
  const [initialWidth, setInitialWidth] = useState<number | null>(null);
  const [showSharingSettings, setShowSharingSettings] = useState(false);
  const [persistentUserId, setPersistentUserId] = useState<string | null>(null);
  const [isNewWorkspace, setIsNewWorkspace] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const userId = getPersistentUserId();
    setPersistentUserId(userId);
  }, []);

  const connectionStatus = whiteboardConnectionStatus === CONNECTION_STATUS.CONNECTED && socketConnectionStatus === CONNECTION_STATUS.CONNECTED && yjsStatus === 'connected'
    ? CONNECTION_STATUS.CONNECTED
    : socketConnectionStatus === CONNECTION_STATUS.ERROR || whiteboardConnectionStatus === CONNECTION_STATUS.ERROR
      ? CONNECTION_STATUS.ERROR
      : socketConnectionStatus === CONNECTION_STATUS.DISCONNECTED || whiteboardConnectionStatus === CONNECTION_STATUS.DISCONNECTED || yjsStatus === 'disconnected'
        ? CONNECTION_STATUS.DISCONNECTED
        : CONNECTION_STATUS.CONNECTING;

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setIsDragging(true);
    setInitialMouseX(e.clientX);
    setInitialWidth(splitPosition);
  };

  useEffect(() => {
    const handleMouseMove = (e: globalThis.MouseEvent): void => {
      if (!isDragging || !containerRef.current) return;

      const container = containerRef.current.getBoundingClientRect();
      const mousePositionRelative = e.clientX - container.left;
      const newPositionPercent = (mousePositionRelative / container.width) * 100;

      setSplitPosition(Math.min(Math.max(100 - newPositionPercent, LAYOUT.MIN_WIDTH_PERCENT), LAYOUT.MAX_WIDTH_PERCENT));
    };

    const handleMouseUp = (): void => {
      setIsDragging(false);
      setInitialMouseX(null);
      setInitialWidth(null);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, initialMouseX, initialWidth]);

  useEffect(() => {
    if (!isDragging && splitPosition !== 40) {
      localStorage.setItem(STORAGE_KEYS.SPLIT_POSITION, splitPosition.toString());
    }
  }, [isDragging, splitPosition]);

  const cycleViewMode = (): void => {
    if (viewMode === 'whiteboard') {
      const saved = localStorage.getItem(STORAGE_KEYS.SPLIT_POSITION);
      setSplitPosition(saved ? parseFloat(saved) : 40);
    }
    setViewMode(viewMode === 'whiteboard' ? 'split' : 'whiteboard');
  };

  const toggleSharingSettings = (): void => {
    setShowSharingSettings(!showSharingSettings);
  };


  useEffect(() => {
    if (!socket || !workspaceId || !persistentUserId) return;

    const handleWorkspaceState = (data: WorkspaceStateData): void => {
      if (data.isNewWorkspace) {
        setIsNewWorkspace(true);
      }
    };


    const handleSessionEnded = (data: SessionEndedData): void => {
      toast.info(data.message, {
        position: 'bottom-left',
        autoClose: 5000,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true
      });

      setTimeout(() => {
        navigate('/', { replace: true });
      }, 2000);
    };

    socket.on(SOCKET_EVENTS.WORKSPACE_STATE, handleWorkspaceState);
    socket.on(SOCKET_EVENTS.SESSION_ENDED, handleSessionEnded);

    return () => {
      socket.off(SOCKET_EVENTS.WORKSPACE_STATE, handleWorkspaceState);
      socket.off(SOCKET_EVENTS.SESSION_ENDED, handleSessionEnded);
    };
  }, [socket, workspaceId, persistentUserId, navigate]);

  useEffect(() => {
    if (isOwner && isNewWorkspace && !showSharingSettings) {
      setShowSharingSettings(true);
    }
  }, [isOwner, isNewWorkspace, showSharingSettings]);

  return (
    <div className="fixed inset-0 flex flex-col bg-gray-100">
      {(isLoading || connectionStatus !== CONNECTION_STATUS.CONNECTED) && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white bg-opacity-80">
          <div className="text-center">
            {connectionStatus === CONNECTION_STATUS.CONNECTING && (
              <>
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent mb-4"></div>
                <p className="text-lg text-gray-700">Connecting to workspace...</p>
              </>
            )}
            {connectionStatus === CONNECTION_STATUS.CONNECTED && isLoading && (
              <>
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-green-500 border-t-transparent mb-4"></div>
                <p className="text-lg text-gray-700">Loading drawing history...</p>
              </>
            )}
            {connectionStatus === CONNECTION_STATUS.DISCONNECTED && (
              <>
                <div className="inline-block h-8 w-8 text-red-500 mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <p className="text-lg text-red-600">Connection lost. Reconnecting...</p>
              </>
            )}
            {connectionStatus === CONNECTION_STATUS.ERROR && (
              <>
                <div className="inline-block h-8 w-8 text-red-500 mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <p className="text-lg text-red-600">Connection error. Please try refreshing the page.</p>
              </>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 h-full">
        <WorkspaceContent
          workspaceId={workspaceId || ''}
          viewMode={viewMode}
          splitPosition={splitPosition}
          isDragging={isDragging}
          handleMouseDown={handleMouseDown}
          containerRef={containerRef as RefObject<HTMLDivElement>}
          cycleViewMode={cycleViewMode}
          onShareClick={toggleSharingSettings}
        />
      </div>

      {showSharingSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <SharingSettings
            workspaceId={workspaceId || ''}
            onClose={toggleSharingSettings}
          />
        </div>
      )}
    </div>
  );
}

interface WorkspaceGateProps {
  workspaceId: string;
}

function WorkspaceGate({ workspaceId }: WorkspaceGateProps) {
  const { t } = useTranslation('messages');
  const navigate = useNavigate();
  const sharingContext = useSharing();
  const isCheckingWorkspace = sharingContext?.isCheckingWorkspace ?? true;
  const workspaceNotFound = sharingContext?.workspaceNotFound ?? false;
  const hasNavigatedRef = useRef(false);

  useEffect(() => {
    if (workspaceNotFound && !hasNavigatedRef.current) {
      hasNavigatedRef.current = true;
      toast.error(t('errors.workspaceNotFound'), {
        position: 'bottom-left',
        autoClose: 3000
      });
      navigate('/', { replace: true });
    }
  }, [workspaceNotFound, navigate, t]);

  if (isCheckingWorkspace || workspaceNotFound) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <YjsProvider workspaceId={workspaceId}>
      <WhiteboardProvider>
        <CodeEditorProvider>
          <DiagramEditorProvider>
            <WorkspaceLayout />
          </DiagramEditorProvider>
        </CodeEditorProvider>
      </WhiteboardProvider>
    </YjsProvider>
  );
}

export default function Workspace() {
  const { workspaceId } = useParams<{ workspaceId: string }>();

  return (
    <SharingProvider workspaceId={workspaceId ?? ''}>
      <WorkspaceGate workspaceId={workspaceId ?? ''} />
    </SharingProvider>
  );
}
