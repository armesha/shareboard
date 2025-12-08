import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { useSocket } from './SocketContext';
import { SOCKET_EVENTS, STORAGE_KEYS, SHARING_MODES, TIMING } from '../constants';
import { getPersistentUserId } from '../utils';

const { TOKEN_TTL_MS } = TIMING;

type SharingModeType = typeof SHARING_MODES[keyof typeof SHARING_MODES];

interface SharingContextValue {
  sharingMode: SharingModeType;
  allowedUsers: string[];
  isOwner: boolean;
  currentUser: string | null;
  hasEditAccess: boolean;
  canWrite: () => boolean;
  changeMode: (newMode: SharingModeType) => void;
  workspaceOwner: string | null;
  sharingInfoReceived: boolean;
  workspaceNotFound: boolean;
  isCheckingWorkspace: boolean;
}

interface SharingProviderProps {
  children: ReactNode;
  workspaceId: string;
}

interface SharingInfoData {
  sharingMode?: SharingModeType;
  allowedUsers?: string[];
  hasEditAccess?: boolean;
  isOwner?: boolean;
  owner?: string;
  currentUser?: string;
  editToken?: string;
}

interface SharingModeChangedData {
  sharingMode?: SharingModeType;
  allowedUsers?: string[];
  editToken?: string;
}

interface EditTokenUpdateData {
  editToken?: string;
}

interface WorkspaceExistsData {
  exists: boolean;
}

interface SessionTokenPayload {
  value: string;
  expiresAt: number;
}

const SharingContext = createContext<SharingContextValue | null>(null);

function setSessionToken(key: string, value: string | undefined): void {
  if (!value) return;
  const payload: SessionTokenPayload = { value, expiresAt: Date.now() + TOKEN_TTL_MS };
  sessionStorage.setItem(key, JSON.stringify(payload));
}

function getSessionToken(key: string): string | null {
  const raw = sessionStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SessionTokenPayload;
    if (!parsed.expiresAt || parsed.expiresAt < Date.now()) {
      sessionStorage.removeItem(key);
      return null;
    }
    return parsed.value;
  } catch {
    sessionStorage.removeItem(key);
    return null;
  }
}

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

  useEffect(() => {
    const userId = getPersistentUserId();
    setPersistentUserId(userId);
    setCurrentUser(userId);

    const urlParams = new URLSearchParams(window.location.search);
    const accessToken = urlParams.get('access');

    if (accessToken) {
      setSessionToken(STORAGE_KEYS.accessToken(workspaceId), accessToken);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!socket) return;

    const handleSharingUpdate = (data: SharingInfoData): void => {
      setSharingMode(data.sharingMode || SHARING_MODES.READ_WRITE_SELECTED);
      setAllowedUsers(data.allowedUsers || []);

      const urlParams = new URLSearchParams(window.location.search);
      const currentAccessToken = urlParams.get('access') ||
        getSessionToken(STORAGE_KEYS.accessToken(workspaceId));

      const currentUserId = localStorage.getItem(STORAGE_KEYS.USER_ID);

      if (data.hasEditAccess !== undefined) {
        setHasEditAccess(data.hasEditAccess);
      } else if (data.isOwner || (data.owner && currentUserId && data.owner === currentUserId)) {
        setHasEditAccess(true);
      } else if (currentAccessToken && data.editToken && currentAccessToken === data.editToken) {
        setHasEditAccess(true);
      } else {
        setHasEditAccess(false);
      }

      if (data.owner) {
        setWorkspaceOwner(data.owner);
      }

      if (data.isOwner !== undefined) {
        setIsOwner(data.isOwner);
      } else if (data.owner && currentUserId) {
        setIsOwner(data.owner === currentUserId);
      }

      if (data.currentUser) {
        setCurrentUser(data.currentUser);
      } else if (currentUserId) {
        setCurrentUser(currentUserId);
      }

      if (data.editToken) {
        setSessionToken(STORAGE_KEYS.editToken(workspaceId), data.editToken);
      }

      setSharingInfoReceived(true);
    };

    const handleEditTokenUpdate = (data: EditTokenUpdateData): void => {
      if (data.editToken) {
        setSessionToken(STORAGE_KEYS.editToken(workspaceId), data.editToken);
      }
    };

    const handleSharingModeChanged = (data: SharingModeChangedData): void => {
      if (data.sharingMode) {
        setSharingMode(data.sharingMode);
        if (Array.isArray(data.allowedUsers)) {
          setAllowedUsers(data.allowedUsers);
        }

        if (data.sharingMode === SHARING_MODES.READ_ONLY) {
          setHasEditAccess(false);
        } else if (data.sharingMode === SHARING_MODES.READ_WRITE_ALL) {
          setHasEditAccess(true);
        } else if (data.sharingMode === SHARING_MODES.READ_WRITE_SELECTED) {
          const currentAccessToken = new URLSearchParams(window.location.search).get('access') ||
            getSessionToken(STORAGE_KEYS.accessToken(workspaceId));
          if (data.editToken && currentAccessToken === data.editToken) {
            setHasEditAccess(true);
          } else {
            setHasEditAccess(false);
          }
        }
      }
      if (data.editToken) {
        setSessionToken(STORAGE_KEYS.editToken(workspaceId), data.editToken);
      }
    };

    socket.on(SOCKET_EVENTS.SHARING_INFO, handleSharingUpdate);
    socket.on(SOCKET_EVENTS.EDIT_TOKEN_UPDATED, handleEditTokenUpdate);
    socket.on(SOCKET_EVENTS.SHARING_MODE_CHANGED, handleSharingModeChanged);

    return () => {
      socket.off(SOCKET_EVENTS.SHARING_INFO, handleSharingUpdate);
      socket.off(SOCKET_EVENTS.EDIT_TOKEN_UPDATED, handleEditTokenUpdate);
      socket.off(SOCKET_EVENTS.SHARING_MODE_CHANGED, handleSharingModeChanged);
    };
  }, [socket, workspaceId]);

  const joinWorkspace = useCallback((): void => {
    if (!socket || !workspaceId || !persistentUserId) return;

    const accessToken = getSessionToken(STORAGE_KEYS.accessToken(workspaceId)) ||
      new URLSearchParams(window.location.search).get('access');

    socket.emit(SOCKET_EVENTS.GET_SHARING_INFO, {
      workspaceId,
      userId: persistentUserId,
      accessToken
    });

    socket.emit(SOCKET_EVENTS.JOIN_WORKSPACE, {
      workspaceId,
      userId: persistentUserId,
      accessToken
    });
  }, [socket, workspaceId, persistentUserId]);

  const hasHandledConnectRef = useRef(false);

  useEffect(() => {
    if (!socket || !workspaceId || !persistentUserId) return;

    const handleWorkspaceExistsResult = ({ exists }: WorkspaceExistsData): void => {
      setIsCheckingWorkspace(false);
      if (exists) {
        joinWorkspace();
      } else {
        setWorkspaceNotFound(true);
      }
    };

    const handleConnect = (): void => {
      if (hasHandledConnectRef.current) return;
      hasHandledConnectRef.current = true;

      socket.emit(SOCKET_EVENTS.CHECK_WORKSPACE_EXISTS, { workspaceId });
    };

    const handleDisconnect = (): void => {
      hasHandledConnectRef.current = false;
    };

    socket.on(SOCKET_EVENTS.CONNECT, handleConnect);
    socket.on(SOCKET_EVENTS.WORKSPACE_EXISTS_RESULT, handleWorkspaceExistsResult);
    socket.on('disconnect', handleDisconnect);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off(SOCKET_EVENTS.CONNECT, handleConnect);
      socket.off(SOCKET_EVENTS.WORKSPACE_EXISTS_RESULT, handleWorkspaceExistsResult);
      socket.off('disconnect', handleDisconnect);
    };
  }, [socket, workspaceId, persistentUserId, joinWorkspace]);

  useEffect(() => {
    if (workspaceOwner && persistentUserId) {
      if (workspaceOwner === persistentUserId) {
        setIsOwner(true);
        setHasEditAccess(true);
      }
    }
  }, [workspaceOwner, persistentUserId]);

  const canWrite = useCallback((): boolean => {
    if (isOwner) return true;

    if (sharingMode === SHARING_MODES.READ_ONLY) {
      return false;
    }

    if (sharingMode === SHARING_MODES.READ_WRITE_ALL) {
      return true;
    }

    if (sharingMode === SHARING_MODES.READ_WRITE_SELECTED) {
      return hasEditAccess;
    }

    return hasEditAccess;
  }, [isOwner, sharingMode, hasEditAccess]);

  const changeMode = useCallback((newMode: SharingModeType): void => {
    if (!socket || !workspaceId || !isOwner) return;

    socket.emit(SOCKET_EVENTS.CHANGE_SHARING_MODE, {
      workspaceId,
      sharingMode: newMode
    });
  }, [socket, workspaceId, isOwner]);

  const contextValue = useMemo((): SharingContextValue => ({
    sharingMode,
    allowedUsers,
    isOwner,
    currentUser,
    hasEditAccess,
    canWrite,
    changeMode,
    workspaceOwner,
    sharingInfoReceived,
    workspaceNotFound,
    isCheckingWorkspace
  }), [
    sharingMode,
    allowedUsers,
    isOwner,
    currentUser,
    hasEditAccess,
    canWrite,
    changeMode,
    workspaceOwner,
    sharingInfoReceived,
    workspaceNotFound,
    isCheckingWorkspace
  ]);

  return (
    <SharingContext.Provider value={contextValue}>
      {children}
    </SharingContext.Provider>
  );
}
