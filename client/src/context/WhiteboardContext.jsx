import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from './SocketContext';

const WhiteboardContext = createContext(null);

export function useWhiteboard() {
  return useContext(WhiteboardContext);
}

export function WhiteboardProvider({ children }) {
  const socket = useSocket();
  const [elements, setElements] = useState([]);
  const [activeUsers, setActiveUsers] = useState(0);
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#000000');
  const [width, setWidth] = useState(2);
  const [isConnected, setIsConnected] = useState(false);
  const pendingElements = useRef(new Map());

  // Handle socket connection events
  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      setIsConnected(true);
      const workspaceId = window.location.pathname.split('/')[2];
      if (workspaceId) {
        socket.emit('join-workspace', workspaceId);
      }
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [socket]);

  // Handle whiteboard updates and workspace state
  useEffect(() => {
    if (!socket) return;

    const handleWhiteboardUpdate = (updatedElements) => {
      setElements(prev => {
        // Merge with pending elements
        const newElements = [...updatedElements];
        pendingElements.current.forEach((element) => {
          if (!newElements.find(e => e.id === element.id)) {
            newElements.push(element);
          }
        });
        return newElements;
      });
    };

    const handleWorkspaceState = (state) => {
      if (state.whiteboardElements) {
        setElements(state.whiteboardElements);
      }
      if (state.activeUsers !== undefined) {
        setActiveUsers(state.activeUsers);
      }
    };

    const handleUserJoined = ({ userId, activeUsers: newActiveUsers }) => {
      setActiveUsers(newActiveUsers);
    };

    const handleUserLeft = ({ userId, activeUsers: newActiveUsers }) => {
      setActiveUsers(newActiveUsers);
    };

    const handleWhiteboardClear = () => {
      setElements([]);
    };

    socket.on('whiteboard-update', handleWhiteboardUpdate);
    socket.on('workspace-state', handleWorkspaceState);
    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);
    socket.on('whiteboard-clear', handleWhiteboardClear);

    return () => {
      socket.off('whiteboard-update', handleWhiteboardUpdate);
      socket.off('workspace-state', handleWorkspaceState);
      socket.off('user-joined', handleUserJoined);
      socket.off('user-left', handleUserLeft);
      socket.off('whiteboard-clear', handleWhiteboardClear);
    };
  }, [socket]);

  const addElement = useCallback((element) => {
    // Add to pending elements immediately
    pendingElements.current.set(element.id, element);

    setElements(prev => [...prev, element]);
    
    if (socket && isConnected) {
      const workspaceId = window.location.pathname.split('/')[2];
      socket.emit('whiteboard-update', {
        workspaceId,
        elements: [element]
      });

      // Remove from pending after successful emit
      setTimeout(() => {
        pendingElements.current.delete(element.id);
      }, 1000);
    }
  }, [socket, isConnected]);

  const updateElement = useCallback((elementId, updates) => {
    const updatedElement = { ...updates, id: elementId };
    pendingElements.current.set(elementId, updatedElement);

    setElements(prev => 
      prev.map(el => el.id === elementId ? { ...el, ...updates } : el)
    );
    
    if (socket && isConnected) {
      const workspaceId = window.location.pathname.split('/')[2];
      socket.emit('whiteboard-update', {
        workspaceId,
        elements: [updatedElement]
      });

      // Remove from pending after successful emit
      setTimeout(() => {
        pendingElements.current.delete(elementId);
      }, 1000);
    }
  }, [socket, isConnected]);

  const clearCanvas = useCallback(() => {
    if (socket && isConnected) {
      const workspaceId = window.location.pathname.split('/')[2];
      socket.emit('whiteboard-clear', { workspaceId });
      setElements([]);
    }
  }, [socket, isConnected]);

  const value = {
    elements,
    activeUsers,
    isConnected,
    tool,
    setTool,
    color,
    setColor,
    width,
    setWidth,
    addElement,
    updateElement,
    clearCanvas,
    socket
  };

  return (
    <WhiteboardContext.Provider value={value}>
      {children}
    </WhiteboardContext.Provider>
  );
}
