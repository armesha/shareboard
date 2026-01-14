import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSocket } from './SocketContext';
import { SOCKET_EVENTS, STORAGE_KEYS, SHARING_MODES } from '../constants';
import { getPersistentUserId } from '../utils';
import { setSessionToken } from '../utils/sessionToken';
import { useSharingSocketHandlers, getAccessTokenFromStorage } from '../hooks/useSharingSocketHandlers';
import type { SharingContextValue, SharingProviderProps, WorkspaceExistsData, SharingModeType } from '../types/sharing';

const SharingContext = createContext<SharingContextValue | null>(null);

export function useSharing(): SharingContextValue {
  const context = useContext(SharingContext);
  if (!context) {
    throw new Error('useSharing must be used within a SharingProvider');
  }
  return context;
}

export function SharingProvider({ children, workspaceId }: SharingProviderProps) {
  const socketContext = useSocket();
  const socket = socketContext?.socket ?? null;
  const [sharingMode, setSharingMode] = useState<SharingModeType>(SHARING_MODES.READ_WRITE_SELECTED);
  const [allowedUsers, setAllowedUsers] = useState<string[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [persistentUserId, setPersistentUserId] = useState<string | null>(null);
  const [hasEditAccess, setHasEditAccess] = useState(false);
  const [workspaceOwner, setWorkspaceOwner] = useState<string | null>(null);
  const [sharingInfoReceived, setSharingInfoReceived] = useState(false);
  const [workspaceNotFound, setWorkspaceNotFound] = useState(false);
  const [isCheckingWorkspace, setIsCheckingWorkspace] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const pendingJoinRef = useRef(false);

  useEffect(() => {
    const userId = getPersistentUserId();
    setPersistentUserId(userId);
    setCurrentUser(userId);

    const urlParams = new URLSearchParams(window.location.search);
    const urlAccessToken = urlParams.get('access');

    if (urlAccessToken) {
      setSessionToken(STORAGE_KEYS.accessToken(workspaceId), urlAccessToken);
      setAccessToken(urlAccessToken);
      window.history.replaceState(null, '', window.location.pathname);
    } else {
      setAccessToken(getAccessTokenFromStorage(workspaceId));
    }
  }, [workspaceId]);

  useSharingSocketHandlers({
    socket, workspaceId, setSharingMode, setAllowedUsers, setHasEditAccess,
    setWorkspaceOwner, setIsOwner, setCurrentUser, setSharingInfoReceived
  });

  const joinWorkspace = useCallback((): void => {
    if (!socket || !workspaceId || !persistentUserId) return;
    const currentAccessToken = getAccessTokenFromStorage(workspaceId);

    socket.emit(SOCKET_EVENTS.GET_SHARING_INFO, { workspaceId, userId: persistentUserId, accessToken: currentAccessToken });
    socket.emit(SOCKET_EVENTS.JOIN_WORKSPACE, { workspaceId, userId: persistentUserId, accessToken: currentAccessToken });
  }, [socket, workspaceId, persistentUserId]);

  useEffect(() => {
    if (!socket || !workspaceId || !persistentUserId) return;

    const handleWorkspaceExistsResult = ({ exists }: WorkspaceExistsData): void => {
      setIsCheckingWorkspace(false);
      pendingJoinRef.current = false;
      if (exists) joinWorkspace();
      else setWorkspaceNotFound(true);
    };

    const handleConnect = (): void => {
      if (pendingJoinRef.current) return;
      pendingJoinRef.current = true;
      socket.emit(SOCKET_EVENTS.CHECK_WORKSPACE_EXISTS, { workspaceId });
    };

    const handleDisconnect = (): void => { pendingJoinRef.current = false; };

    socket.on(SOCKET_EVENTS.CONNECT, handleConnect);
    socket.on(SOCKET_EVENTS.DISCONNECT, handleDisconnect);
    socket.on(SOCKET_EVENTS.WORKSPACE_EXISTS_RESULT, handleWorkspaceExistsResult);

    if (socket.connected) handleConnect();

    return () => {
      socket.off(SOCKET_EVENTS.CONNECT, handleConnect);
      socket.off(SOCKET_EVENTS.DISCONNECT, handleDisconnect);
      socket.off(SOCKET_EVENTS.WORKSPACE_EXISTS_RESULT, handleWorkspaceExistsResult);
    };
  }, [socket, workspaceId, persistentUserId, joinWorkspace]);

  useEffect(() => {
    if (workspaceOwner && persistentUserId && workspaceOwner === persistentUserId) {
      setIsOwner(true);
      setHasEditAccess(true);
    }
  }, [workspaceOwner, persistentUserId]);

  const canWrite = useCallback((): boolean => {
    if (isOwner) return true;
    if (sharingMode === SHARING_MODES.READ_ONLY) return false;
    if (sharingMode === SHARING_MODES.READ_WRITE_ALL) return true;
    return hasEditAccess;
  }, [isOwner, sharingMode, hasEditAccess]);

  const changeMode = useCallback((newMode: SharingModeType): void => {
    if (!socket || !workspaceId || !isOwner) return;
    socket.emit(SOCKET_EVENTS.CHANGE_SHARING_MODE, { workspaceId, sharingMode: newMode });
  }, [socket, workspaceId, isOwner]);

  const contextValue = useMemo((): SharingContextValue => ({
    sharingMode, allowedUsers, isOwner, currentUser, hasEditAccess, canWrite, changeMode,
    workspaceOwner, sharingInfoReceived, workspaceNotFound, isCheckingWorkspace, accessToken
  }), [
    sharingMode, allowedUsers, isOwner, currentUser, hasEditAccess, canWrite, changeMode,
    workspaceOwner, sharingInfoReceived, workspaceNotFound, isCheckingWorkspace, accessToken
  ]);

  return (
    <SharingContext.Provider value={contextValue}>
      {children}
    </SharingContext.Provider>
  );
}
