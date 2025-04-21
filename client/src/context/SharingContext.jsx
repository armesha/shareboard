import { createContext, useContext, useState, useEffect } from 'react';
import { useSocket } from './SocketContext';

const SharingContext = createContext(null);

export function useSharing() {
  return useContext(SharingContext);
}

export function SharingProvider({ children, workspaceId }) {
  const { socket } = useSocket();
  const [sharingMode, setSharingMode] = useState('read-write-all');
  const [allowedUsers, setAllowedUsers] = useState([]);
  const [isOwner, setIsOwner] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [persistentUserId, setPersistentUserId] = useState(null);
  const [hasEditAccess, setHasEditAccess] = useState(false);
  const [workspaceOwner, setWorkspaceOwner] = useState(null);
  
  useEffect(() => {
    let userId = localStorage.getItem('shareboardUserId');
    if (!userId) {
      userId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      localStorage.setItem('shareboardUserId', userId);
    }
    setPersistentUserId(userId);
    setCurrentUser(userId);
    
    const urlParams = new URLSearchParams(window.location.search);
    const accessToken = urlParams.get('access');
    
    if (accessToken) {
      localStorage.setItem(`accessToken_${workspaceId}`, accessToken);
      console.log(`Stored access token for workspace ${workspaceId}: ${accessToken}`);
    }
    
    console.log("SharingContext using persistent user ID:", userId, 
      accessToken ? `with access token: ${accessToken}` : '');
  }, [workspaceId]);

  useEffect(() => {
    if (!socket || !workspaceId || !persistentUserId) return;

    const accessToken = localStorage.getItem(`accessToken_${workspaceId}`) || 
                       new URLSearchParams(window.location.search).get('access');

    const handleConnect = () => {
      console.log(`Requesting sharing info with token: ${accessToken}`);
      socket.emit('get-sharing-info', { 
        workspaceId, 
        userId: persistentUserId,
        accessToken 
      });
    };

    const handleSharingUpdate = (data) => {
      setSharingMode(data.sharingMode || 'read-write-all');
      setAllowedUsers(data.allowedUsers || []);
      
      // Get the current access token from URL or localStorage
      const urlParams = new URLSearchParams(window.location.search);
      const currentAccessToken = urlParams.get('access') || 
                                localStorage.getItem(`accessToken_${workspaceId}`);
      
      if (data.hasEditAccess !== undefined) {
        setHasEditAccess(data.hasEditAccess);
      } else if (data.sharingMode === 'read-write-all') {
        setHasEditAccess(true);
      } else if (data.sharingMode === 'read-only') {
        setHasEditAccess(data.isOwner || (data.owner === persistentUserId));
      } else if (data.sharingMode === 'read-write-selected') {
        // In selected mode, only owners or users with the correct token have edit access
        if (data.isOwner || (data.owner === persistentUserId)) {
          setHasEditAccess(true);
        } else if (currentAccessToken && data.editToken && currentAccessToken === data.editToken) {
          setHasEditAccess(true);
          console.log("User has edit access via token match:", currentAccessToken);
        } else {
          // If no token or token doesn't match, no edit access
          setHasEditAccess(false);
          console.log("User does not have edit access in selected mode");
        }
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
        localStorage.setItem(`editToken_${workspaceId}`, data.editToken);
      }
      
      console.log("Sharing info update:", {
        sharingMode: data.sharingMode,
        allowedUsers: data.allowedUsers,
        isOwner: data.isOwner || (data.owner === persistentUserId),
        owner: data.owner,
        currentUser: data.currentUser || persistentUserId,
        persistentUserId,
        hasEditAccess: data.hasEditAccess !== undefined ? data.hasEditAccess : canWrite(),
        editToken: data.editToken ? "provided" : "not provided",
        accessToken: currentAccessToken ? currentAccessToken.substring(0, 10) + "..." : "none",
        isTokenMatching: data.editToken && currentAccessToken && data.editToken === currentAccessToken
      });
    };

    const handleEditTokenUpdate = (data) => {
      if (data.editToken) {
        localStorage.setItem(`editToken_${workspaceId}`, data.editToken);
        console.log(`Received updated edit token for workspace ${workspaceId}`);
      }
    };

    socket.on('connect', handleConnect);
    socket.on('sharing-info', handleSharingUpdate);
    socket.on('edit-token-updated', handleEditTokenUpdate);

    if (socket.connected) {
      socket.emit('get-sharing-info', { 
        workspaceId, 
        userId: persistentUserId,
        accessToken 
      });
    }

    if (socket.connected) {
      socket.emit('join-workspace', {
        workspaceId,
        userId: persistentUserId,
        accessToken
      });
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('sharing-info', handleSharingUpdate);
      socket.off('edit-token-updated', handleEditTokenUpdate);
    };
  }, [socket, workspaceId, persistentUserId]);

  useEffect(() => {
    if (workspaceOwner && persistentUserId) {
      setIsOwner(workspaceOwner === persistentUserId);
    }
  }, [workspaceOwner, persistentUserId]);

  const changePermission = (mode) => {
    if (!socket || !workspaceId) return;
    
    setSharingMode(mode);
    
    if (mode === 'read-write-all') {
      setHasEditAccess(true);
    } else if (mode === 'read-only') {
      setHasEditAccess(isOwner);
    } else if (mode === 'read-write-selected') {
      // In selected mode, only owners have edit access by default
      // Other users need the edit token
      setHasEditAccess(isOwner);
      
      // If we're not the owner, we need to check if we have the edit token
      if (!isOwner) {
        const urlParams = new URLSearchParams(window.location.search);
        const accessToken = urlParams.get('access') || 
                           localStorage.getItem(`accessToken_${workspaceId}`);
        const savedEditToken = localStorage.getItem(`editToken_${workspaceId}`);
        
        if (accessToken && savedEditToken && accessToken === savedEditToken) {
          setHasEditAccess(true);
        } else {
          setHasEditAccess(false);
        }
      }
    }
    
    socket.emit('change-sharing-mode', {
      workspaceId,
      sharingMode: mode
    });
  };

  const addAllowedUser = (userId) => {
    if (!socket || !workspaceId) return;
    
    const newAllowedUsers = [...allowedUsers, userId];
    setAllowedUsers(newAllowedUsers);
    
    socket.emit('change-sharing-mode', {
      workspaceId,
      sharingMode: 'read-write-selected',
      allowedUsers: newAllowedUsers
    });
  };

  const removeAllowedUser = (userId) => {
    if (!socket || !workspaceId) return;
    
    const newAllowedUsers = allowedUsers.filter(id => id !== userId);
    setAllowedUsers(newAllowedUsers);
    
    socket.emit('change-sharing-mode', {
      workspaceId,
      sharingMode: 'read-write-selected',
      allowedUsers: newAllowedUsers
    });
  };

  const canWrite = () => {
    if (isOwner) return true;
    
    switch (sharingMode) {
      case 'read-write-all':
        return true;
      case 'read-only':
        return false;
      case 'read-write-selected':
        return hasEditAccess;
      default:
        return false;
    }
  };

  useEffect(() => {
    // When edit access changes, request a full state refresh
    if (socket && workspaceId) {
      const canEdit = canWrite();
      console.log(`Edit access changed: ${canEdit ? 'enabled' : 'disabled'}, refreshing workspace state`);
      
      // Request a full state refresh to ensure all elements are in sync
      socket.emit('request-canvas-state', workspaceId);
    }
  }, [socket, workspaceId, hasEditAccess, sharingMode]);

  // Request a workspace state refresh periodically to ensure sync
  useEffect(() => {
    if (!socket || !workspaceId) return;
    
    const refreshInterval = setInterval(() => {
      if (socket.connected) {
        try {
          socket.emit('request-canvas-state', workspaceId);
        } catch (error) {
          console.error('Error requesting canvas state:', error);
        }
      }
    }, 30000); // Refresh every 30 seconds to reduce server load
    
    return () => clearInterval(refreshInterval);
  }, [socket, workspaceId]);

  return (
    <SharingContext.Provider value={{
      sharingMode,
      allowedUsers,
      isOwner,
      currentUser,
      hasEditAccess,
      changePermission,
      canWrite,
      workspaceOwner
    }}>
      {children}
    </SharingContext.Provider>
  );
} 