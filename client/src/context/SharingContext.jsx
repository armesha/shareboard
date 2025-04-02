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
  
  // Get persistent userId
  useEffect(() => {
    let userId = localStorage.getItem('shareboardUserId');
    if (!userId) {
      userId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      localStorage.setItem('shareboardUserId', userId);
    }
    setPersistentUserId(userId);
    setCurrentUser(userId);
    console.log("SharingContext using persistent user ID:", userId);
  }, []);

  useEffect(() => {
    if (!socket || !workspaceId || !persistentUserId) return;

    // Request workspace sharing info on connection
    const handleConnect = () => {
      socket.emit('get-sharing-info', { workspaceId, userId: persistentUserId });
    };

    // Listen for sharing updates
    const handleSharingUpdate = (data) => {
      setSharingMode(data.sharingMode);
      setAllowedUsers(data.allowedUsers || []);

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
      
      console.log("Sharing info update:", {
        sharingMode: data.sharingMode,
        allowedUsers: data.allowedUsers,
        isOwner: data.isOwner || (data.owner === persistentUserId),
        owner: data.owner,
        currentUser: data.currentUser || persistentUserId,
        persistentUserId
      });
    };

    socket.on('connect', handleConnect);
    socket.on('sharing-info', handleSharingUpdate);

    if (socket.connected) {
      socket.emit('get-sharing-info', { workspaceId, userId: persistentUserId });
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('sharing-info', handleSharingUpdate);
    };
  }, [socket, workspaceId, persistentUserId]);

  const changePermission = (mode, users = []) => {
    if (!socket || !workspaceId) return;
    
    socket.emit('change-sharing-mode', {
      workspaceId,
      sharingMode: mode,
      allowedUsers: mode === 'read-write-selected' ? users : []
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
        return currentUser && allowedUsers.includes(currentUser);
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
      changePermission,
      addAllowedUser,
      removeAllowedUser,
      canWrite
    }}>
      {children}
    </SharingContext.Provider>
  );
} 