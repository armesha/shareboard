import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSocket } from './SocketContext';
import { SOCKET_EVENTS, STORAGE_KEYS, SHARING_MODES, TIMING } from '../constants';

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

  useEffect(() => {
    let userId = localStorage.getItem(STORAGE_KEYS.USER_ID);
    if (!userId) {
      userId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      localStorage.setItem(STORAGE_KEYS.USER_ID, userId);
    }
    setPersistentUserId(userId);
    setCurrentUser(userId);

    const urlParams = new URLSearchParams(window.location.search);
    const accessToken = urlParams.get('access');

    if (accessToken) {
      localStorage.setItem(STORAGE_KEYS.accessToken(workspaceId), accessToken);
    }
  }, [workspaceId]);

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
    };

    const handleSharingUpdate = (data) => {
      setSharingMode(data.sharingMode || SHARING_MODES.READ_WRITE_SELECTED);
      setAllowedUsers(data.allowedUsers || []);

      const urlParams = new URLSearchParams(window.location.search);
      const currentAccessToken = urlParams.get('access') ||
        localStorage.getItem(STORAGE_KEYS.accessToken(workspaceId));

      if (data.hasEditAccess !== undefined) {
        setHasEditAccess(data.hasEditAccess);
      } else if (data.isOwner || (data.owner === persistentUserId)) {
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
      } else if (data.owner && persistentUserId) {
        setIsOwner(data.owner === persistentUserId);
      }

      if (data.currentUser) {
        setCurrentUser(data.currentUser);
      } else if (persistentUserId) {
        setCurrentUser(persistentUserId);
      }

      if (data.editToken) {
        localStorage.setItem(STORAGE_KEYS.editToken(workspaceId), data.editToken);
      }
    };

    const handleEditTokenUpdate = (data) => {
      if (data.editToken) {
        localStorage.setItem(STORAGE_KEYS.editToken(workspaceId), data.editToken);
      }
    };

    const handleSharingModeChanged = (data) => {
      if (data.sharingMode) {
        setSharingMode(data.sharingMode);
      }
      if (data.editToken) {
        localStorage.setItem(STORAGE_KEYS.editToken(workspaceId), data.editToken);
      }
    };

    socket.on(SOCKET_EVENTS.CONNECT, handleConnect);
    socket.on(SOCKET_EVENTS.SHARING_INFO, handleSharingUpdate);
    socket.on(SOCKET_EVENTS.EDIT_TOKEN_UPDATED, handleEditTokenUpdate);
    socket.on(SOCKET_EVENTS.SHARING_MODE_CHANGED, handleSharingModeChanged);

    if (socket.connected) {
      socket.emit(SOCKET_EVENTS.GET_SHARING_INFO, {
        workspaceId,
        userId: persistentUserId,
        accessToken
      });
    }

    if (socket.connected) {
      socket.emit(SOCKET_EVENTS.JOIN_WORKSPACE, {
        workspaceId,
        userId: persistentUserId,
        accessToken
      });
    }

    return () => {
      socket.off(SOCKET_EVENTS.CONNECT, handleConnect);
      socket.off(SOCKET_EVENTS.SHARING_INFO, handleSharingUpdate);
      socket.off(SOCKET_EVENTS.EDIT_TOKEN_UPDATED, handleEditTokenUpdate);
      socket.off(SOCKET_EVENTS.SHARING_MODE_CHANGED, handleSharingModeChanged);
    };
  }, [socket, workspaceId, persistentUserId]);

  useEffect(() => {
    if (workspaceOwner && persistentUserId) {
      setIsOwner(workspaceOwner === persistentUserId);
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
      workspaceOwner
    }}>
      {children}
    </SharingContext.Provider>
  );
}