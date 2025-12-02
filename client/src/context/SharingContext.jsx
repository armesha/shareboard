import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSocket } from './SocketContext';
import { SOCKET_EVENTS, STORAGE_KEYS, SHARING_MODES } from '../constants';
import { getPersistentUserId } from '../utils';

const SharingContext = createContext(null);

export function useSharing() {
  return useContext(SharingContext);
}

export function SharingProvider({ children, workspaceId }) {
  const { socket } = useSocket();
  const [sharingMode, setSharingMode] = useState(SHARING_MODES.READ_WRITE_SELECTED);
  const [allowedUsers, setAllowedUsers] = useState([]);
  const [isOwner, setIsOwner] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [persistentUserId, setPersistentUserId] = useState(null);
  const [hasEditAccess, setHasEditAccess] = useState(false);
  const [workspaceOwner, setWorkspaceOwner] = useState(null);
  const [sharingInfoReceived, setSharingInfoReceived] = useState(false);

  useEffect(() => {
    const userId = getPersistentUserId();
    setPersistentUserId(userId);
    setCurrentUser(userId);

    const urlParams = new URLSearchParams(window.location.search);
    const accessToken = urlParams.get('access');

    if (accessToken) {
      localStorage.setItem(STORAGE_KEYS.accessToken(workspaceId), accessToken);
    }
  }, [workspaceId]);

  // Socket listeners - independent of persistentUserId to avoid race conditions
  useEffect(() => {
    if (!socket) return;

    const handleSharingUpdate = (data) => {
      setSharingMode(data.sharingMode || SHARING_MODES.READ_WRITE_SELECTED);
      setAllowedUsers(data.allowedUsers || []);

      const urlParams = new URLSearchParams(window.location.search);
      const currentAccessToken = urlParams.get('access') ||
        localStorage.getItem(STORAGE_KEYS.accessToken(workspaceId));

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
        localStorage.setItem(STORAGE_KEYS.editToken(workspaceId), data.editToken);
      }

      setSharingInfoReceived(true);
    };

    const handleEditTokenUpdate = (data) => {
      if (data.editToken) {
        localStorage.setItem(STORAGE_KEYS.editToken(workspaceId), data.editToken);
      }
    };

    const handleSharingModeChanged = (data) => {
      if (data.sharingMode) {
        setSharingMode(data.sharingMode);

        if (data.sharingMode === SHARING_MODES.READ_ONLY) {
          setHasEditAccess(false);
        } else if (data.sharingMode === SHARING_MODES.READ_WRITE_ALL) {
          setHasEditAccess(true);
        } else if (data.sharingMode === SHARING_MODES.READ_WRITE_SELECTED) {
          const currentAccessToken = new URLSearchParams(window.location.search).get('access') ||
            localStorage.getItem(STORAGE_KEYS.accessToken(workspaceId));
          if (data.editToken && currentAccessToken === data.editToken) {
            setHasEditAccess(true);
          } else {
            setHasEditAccess(false);
          }
        }
      }
      if (data.editToken) {
        localStorage.setItem(STORAGE_KEYS.editToken(workspaceId), data.editToken);
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

  // Join workspace and request info - depends on persistentUserId
  useEffect(() => {
    if (!socket || !workspaceId || !persistentUserId) return;

    const accessToken = localStorage.getItem(STORAGE_KEYS.accessToken(workspaceId)) ||
      new URLSearchParams(window.location.search).get('access');

    const handleConnect = () => {
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
    };

    socket.on(SOCKET_EVENTS.CONNECT, handleConnect);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off(SOCKET_EVENTS.CONNECT, handleConnect);
    };
  }, [socket, workspaceId, persistentUserId]);

  // Fallback check for ownership
  useEffect(() => {
    if (workspaceOwner && persistentUserId) {
      if (workspaceOwner === persistentUserId) {
        setIsOwner(true);
        setHasEditAccess(true);
      }
    }
  }, [workspaceOwner, persistentUserId]);

  const canWrite = useCallback(() => {
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

  const changeMode = useCallback((newMode) => {
    if (!socket || !workspaceId || !isOwner) return;

    socket.emit(SOCKET_EVENTS.CHANGE_SHARING_MODE, {
      workspaceId,
      sharingMode: newMode
    });
  }, [socket, workspaceId, isOwner]);

  return (
    <SharingContext.Provider value={{
      sharingMode,
      allowedUsers,
      isOwner,
      currentUser,
      hasEditAccess,
      canWrite,
      changeMode,
      workspaceOwner,
      sharingInfoReceived
    }}>
      {children}
    </SharingContext.Provider>
  );
}