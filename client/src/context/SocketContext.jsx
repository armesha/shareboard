import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export function useSocket() {
  return useContext(SocketContext);
}

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const maxReconnectAttempts = 5;

  const initializeSocket = useCallback(() => {
    const socketInstance = io(import.meta.env.VITE_SERVER_URL || 'http://localhost:3000', {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      transports: ['websocket', 'polling']
    });

    socketInstance.on('connect', () => {
      console.log('Connected to Socket.IO server');
      setConnectionAttempts(0);
    });

    socketInstance.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setConnectionAttempts(prev => prev + 1);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('Disconnected from Socket.IO server:', reason);
      if (reason === 'io server disconnect') {
        // Reconnect if server initiated disconnect
        socketInstance.connect();
      }
    });

    socketInstance.on('error', ({ message }) => {
      console.error('Socket error:', message);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  useEffect(() => {
    const cleanup = initializeSocket();
    return cleanup;
  }, [initializeSocket]);

  // Handle reconnection attempts
  useEffect(() => {
    if (connectionAttempts >= maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      // You might want to show a user-friendly error message here
    }
  }, [connectionAttempts]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}
