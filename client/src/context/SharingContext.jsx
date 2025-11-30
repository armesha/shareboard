import { createContext, useContext, useState, useEffect } from 'react';
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
      console.log(`Stored access token for workspace ${workspaceId}: ${accessToken}`);
    }

    console.log("SharingContext using persistent user ID:", userId,
      accessToken ? `with access token: ${accessToken}` : '');
  }, [workspaceId]);

  useEffect(() => {
    if (!socket || !workspaceId || !persistentUserId) return;

    const accessToken = localStorage.getItem(STORAGE_KEYS.accessToken(workspaceId)) ||
                       new URLSearchParams(window.location.search).get('access');

    const handleConnect = () => {
      console.log(`Requesting sharing info with token: ${accessToken}`);
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
        console.log("User has edit access via token match:", currentAccessToken);
      } else {
        setHasEditAccess(false);
        console.log("User does not have edit access");
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

      console.log("Sharing info update:", {
        sharingMode: data.sharingMode,
        allowedUsers: data.allowedUsers,
        isOwner: data.isOwner || (data.owner === persistentUserId),
        owner: data.owner,
        currentUser: data.currentUser || persistentUserId,
        persistentUserId,
        hasEditAccess: data.hasEditAccess !== undefined ? data.hasEditAccess : hasEditAccess,
        editToken: data.editToken ? "provided" : "not provided",
        accessToken: currentAccessToken ? currentAccessToken.substring(0, 10) + "..." : "none",
        isTokenMatching: data.editToken && currentAccessToken && data.editToken === currentAccessToken
      });
    };

    const handleEditTokenUpdate = (data) => {
      if (data.editToken) {
        localStorage.setItem(STORAGE_KEYS.editToken(workspaceId), data.editToken);
        console.log(`Received updated edit token for workspace ${workspaceId}`);
      }
    };

    socket.on(SOCKET_EVENTS.CONNECT, handleConnect);
    socket.on(SOCKET_EVENTS.SHARING_INFO, handleSharingUpdate);
    socket.on(SOCKET_EVENTS.EDIT_TOKEN_UPDATED, handleEditTokenUpdate);

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
    };
  }, [socket, workspaceId, persistentUserId]);

  useEffect(() => {
    if (workspaceOwner && persistentUserId) {
      setIsOwner(workspaceOwner === persistentUserId);
    }
  }, [workspaceOwner, persistentUserId]);

  const canWrite = () => {
    if (isOwner) return true;
    return hasEditAccess;
  };

  useEffect(() => {
    if (socket && workspaceId) {
      const canEdit = canWrite();
      console.log(`Edit access changed: ${canEdit ? 'enabled' : 'disabled'}, refreshing workspace state`);
      socket.emit(SOCKET_EVENTS.REQUEST_CANVAS_STATE, workspaceId);
    }
  }, [socket, workspaceId, hasEditAccess, sharingMode]);

  useEffect(() => {
    if (!socket || !workspaceId) return;

    const refreshInterval = setInterval(() => {
      if (socket.connected) {
        try {
          socket.emit(SOCKET_EVENTS.REQUEST_CANVAS_STATE, workspaceId);
        } catch (error) {
          console.error('Error requesting canvas state:', error);
        }
      }
    }, TIMING.STATE_REFRESH_INTERVAL);

    return () => clearInterval(refreshInterval);
  }, [socket, workspaceId]);

  return (
    <SharingContext.Provider value={{
      sharingMode,
      allowedUsers,
      isOwner,
      currentUser,
      hasEditAccess,
      canWrite,
      workspaceOwner
    }}>
      {children}
    </SharingContext.Provider>
  );
} 