import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { toast } from 'react-toastify';

const SocketContext = createContext(null);

export function useSocket() {
  return useContext(SocketContext);
}

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [connectionError, setConnectionError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
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
      setConnectionStatus('connecting');

      socketInstance.on('connect', () => {
        console.log('Connected to Socket.IO server with ID:', socketInstance.id);
        console.log('Connection details:', {
          connected: socketInstance.connected,
          disconnected: socketInstance.disconnected,
          id: socketInstance.id
        });
        
        setConnectionAttempts(0);
        setConnectionError(null);
        setConnectionStatus('connected');
        setSocket(socketInstance);
        
        // Show connection success message to user
        toast.success('Connected to server successfully!', {
          position: 'bottom-right',
          autoClose: 3000
        });
      });

      socketInstance.on('connect_error', (error) => {
        console.error('Connection error:', error.message);
        console.error('Connection error details:', {
          connected: socketInstance.connected,
          disconnected: socketInstance.disconnected,
          id: socketInstance.id,
          error: error
        });
        
        setConnectionStatus('error');
        setConnectionError(error.message);
        
        setConnectionAttempts(prev => {
          const newAttempts = prev + 1;
          if (newAttempts >= maxReconnectAttempts) {
            console.error('Max reconnection attempts reached. Please check server status.');
            socketInstance.disconnect();
            
            // Show critical error to user
            toast.error(`Failed to connect to server after ${maxReconnectAttempts} attempts. Please check your internet connection or try again later.`, {
              position: 'bottom-right',
              autoClose: false,
              closeOnClick: false,
              draggable: true
            });
          } else {
            // Show warning for each attempt
            toast.warning(`Connection error: ${error.message}. Retrying... (${newAttempts}/${maxReconnectAttempts})`, {
              position: 'bottom-right',
              autoClose: 5000
            });
          }
          return newAttempts;
        });
      });

      socketInstance.on('disconnect', (reason) => {
        console.log('Disconnected from server:', reason);
        setConnectionStatus('disconnected');
        setSocket(null);
        
        // Notify user of disconnection
        toast.info('Disconnected from server. Attempting to reconnect...', {
          position: 'bottom-right',
          autoClose: 5000
        });
      });

      // Handle other socket errors
      socketInstance.on('error', (error) => {
        console.error('Socket error:', error);
        setConnectionError(error.message || 'Unknown socket error');
        
        toast.error(`Socket error: ${error.message || 'Unknown error'}`, {
          position: 'bottom-right',
          autoClose: 5000
        });
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
      setConnectionError('Max reconnection attempts reached. Please refresh the page or check server status.');
    }
  }, [connectionAttempts, maxReconnectAttempts]);

  return (
    <SocketContext.Provider value={{ 
      socket, 
      connectionStatus, 
      connectionError,
      connectionAttempts,
      maxReconnectAttempts
    }}>
      {children}
    </SocketContext.Provider>
  );
}
