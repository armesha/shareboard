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
    setTimeout(() => {
      const socketInstance = io(import.meta.env.VITE_SERVER_URL || 'http://localhost:3000', {
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: maxReconnectAttempts,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 10000,
        timeout: 20000,
        transports: ['websocket', 'polling']
      });

      console.log('Initializing socket connection...');

      socketInstance.on('connect', () => {
        console.log('Connected to Socket.IO server with ID:', socketInstance.id);
        console.log('Connection details:', {
          connected: socketInstance.connected,
          disconnected: socketInstance.disconnected,
          id: socketInstance.id
        });
        setConnectionAttempts(0);
        setSocket(socketInstance);
      });

      socketInstance.on('connect_error', (error) => {
        console.error('Connection error:', error.message);
        console.error('Connection error details:', {
          connected: socketInstance.connected,
          disconnected: socketInstance.disconnected,
          id: socketInstance.id,
          error: error
        });
        setConnectionAttempts(prev => {
          const newAttempts = prev + 1;
          if (newAttempts >= maxReconnectAttempts) {
            console.error('Max reconnection attempts reached. Please check server status.');
            socketInstance.disconnect();
          }
          return newAttempts;
        });
      });

      socketInstance.on('disconnect', () => {
        console.log('Disconnected from server');
        setSocket(null);
      });

      setSocket(socketInstance);
    }, 2000);
  }, [maxReconnectAttempts]);

  useEffect(() => {
    initializeSocket();
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [initializeSocket]);

  useEffect(() => {
    if (connectionAttempts >= maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
    }
  }, [connectionAttempts]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}
