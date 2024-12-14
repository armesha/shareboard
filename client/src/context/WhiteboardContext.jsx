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
  const [selectedShape, setSelectedShape] = useState(null);
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
        // Создаем Map из текущих элементов для быстрого поиска
        const currentElementsMap = new Map(prev.map(el => [el.id, el]));
        
        // Обновляем или добавляем новые элементы
        updatedElements.forEach(element => {
          currentElementsMap.set(element.id, element);
        });

        // Добавляем pending элементы
        pendingElements.current.forEach((element, id) => {
          if (!currentElementsMap.has(id)) {
            currentElementsMap.set(id, element);
          }
        });

        return Array.from(currentElementsMap.values());
      });
    };

    const handleWorkspaceState = (state) => {
      if (state.whiteboardElements) {
        setElements(state.whiteboardElements);
        // Очищаем pending элементы при получении полного состояния
        pendingElements.current.clear();
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
      pendingElements.current.clear();
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
    pendingElements.current.set(element.id, element);
    setElements(prev => [...prev, element]);
    
    const workspaceId = window.location.pathname.split('/')[2];
    if (workspaceId && socket) {
      socket.emit('whiteboard-update', {
        workspaceId,
        elements: [element]
      });
    }
  }, [socket]);

  const updateElement = useCallback((id, element) => {
    setElements(prev => {
      const index = prev.findIndex(el => el.id === id);
      if (index === -1) return prev;

      const newElements = [...prev];
      newElements[index] = element;
      
      const workspaceId = window.location.pathname.split('/')[2];
      if (workspaceId && socket) {
        socket.emit('whiteboard-update', {
          workspaceId,
          elements: [element]
        });
      }

      return newElements;
    });
  }, [socket]);

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
    tool,
    setTool,
    selectedShape,
    setSelectedShape,
    color,
    setColor,
    width,
    setWidth,
    isConnected,
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
