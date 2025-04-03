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
  
  // Get persistent userId and check for access token in URL
  useEffect(() => {
    let userId = localStorage.getItem('shareboardUserId');
    if (!userId) {
      userId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      localStorage.setItem('shareboardUserId', userId);
    }
    setPersistentUserId(userId);
    setCurrentUser(userId);
    
    // Check URL for access token
    const urlParams = new URLSearchParams(window.location.search);
    const accessToken = urlParams.get('access');
    
    if (accessToken) {
      // Store access token in localStorage so it persists across refreshes
      localStorage.setItem(`accessToken_${workspaceId}`, accessToken);
    }
    
    console.log("SharingContext using persistent user ID:", userId, 
      accessToken ? `with access token: ${accessToken}` : '');
  }, [workspaceId]);

  useEffect(() => {
    if (!socket || !workspaceId || !persistentUserId) return;

    // Get access token from localStorage if available
    const accessToken = localStorage.getItem(`accessToken_${workspaceId}`);

    // Request workspace sharing info on connection
    const handleConnect = () => {
      console.log(`Requesting sharing info with token: ${accessToken}`);
      socket.emit('get-sharing-info', { 
        workspaceId, 
        userId: persistentUserId,
        accessToken 
      });
    };

    // Listen for sharing updates
    const handleSharingUpdate = (data) => {
      setSharingMode(data.sharingMode || 'read-write-all');
      setAllowedUsers(data.allowedUsers || []);
      
      // Update edit access flag
      if (data.hasEditAccess !== undefined) {
        setHasEditAccess(data.hasEditAccess);
      } else if (data.sharingMode === 'read-write-all') {
        // In read-write-all mode, everyone has edit access
        setHasEditAccess(true);
      } else if (data.sharingMode === 'read-only') {
        // In read-only mode, only the owner has edit access
        setHasEditAccess(data.isOwner || (data.owner === persistentUserId));
      }

      // Handle the isOwner flag
      if (data.isOwner !== undefined) {
        setIsOwner(data.isOwner);
      } else if (data.owner && persistentUserId) {
        // If isOwner is not provided, but owner is, compute it ourselves
        setIsOwner(data.owner === persistentUserId);
      }
      
      // If currentUser isn't provided, use our persistent ID
      if (data.currentUser) {
        setCurrentUser(data.currentUser);
      } else if (persistentUserId) {
        setCurrentUser(persistentUserId);
      }
      
      // Save the edit token if provided
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

    // Handle edit token updates
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

    // Join with access token if available
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

  const changePermission = (mode) => {
    if (!socket || !workspaceId) return;
    
    // Update UI immediately for better responsiveness
    setSharingMode(mode);
    
    // Update hasEditAccess based on the new mode
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
    // Always allow the owner to write
    if (isOwner) return true;
    
    // Allow write access based on access mode
    switch (sharingMode) {
      case 'read-write-all':
        return true;
      case 'read-only':
        return false;
      case 'read-write-selected':
        // Allow if user has a valid edit token
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
      canWrite
    }}>
      {children}
    </SharingContext.Provider>
  );
} 