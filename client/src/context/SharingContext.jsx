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
    }
    
    console.log("SharingContext using persistent user ID:", userId, 
      accessToken ? `with access token: ${accessToken}` : '');
  }, [workspaceId]);

  useEffect(() => {
    if (!socket || !workspaceId || !persistentUserId) return;

    const accessToken = localStorage.getItem(`accessToken_${workspaceId}`);

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
      
      if (data.hasEditAccess !== undefined) {
        setHasEditAccess(data.hasEditAccess);
      } else if (data.sharingMode === 'read-write-all') {
        setHasEditAccess(true);
      } else if (data.sharingMode === 'read-only') {
        setHasEditAccess(data.isOwner || (data.owner === persistentUserId));
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
        hasEditAccess: data.hasEditAccess,
        editToken: data.editToken ? "provided" : "not provided"
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