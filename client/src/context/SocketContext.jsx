import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { toast } from 'react-toastify';
import { SOCKET_EVENTS, STORAGE_KEYS, CONNECTION_STATUS, TIMING } from '../constants';

const SocketContext = createContext(null);

export function useSocket() {
  return useContext(SocketContext);
}

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [connectionError, setConnectionError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState(CONNECTION_STATUS.DISCONNECTED);
  const [userId, setUserId] = useState(null);
  const maxReconnectAttempts = 5;

  useEffect(() => {
    let persistentUserId = localStorage.getItem(STORAGE_KEYS.USER_ID);
    if (!persistentUserId) {
      persistentUserId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      localStorage.setItem(STORAGE_KEYS.USER_ID, persistentUserId);
    }
    setUserId(persistentUserId);
  }, []);

  const initializeSocket = useCallback(() => {
    setTimeout(() => {
      const socketInstance = io(import.meta.env.VITE_SERVER_URL || 'http://localhost:3000', {
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: maxReconnectAttempts,
        reconnectionDelay: TIMING.RECONNECT_DELAY,
        reconnectionDelayMax: TIMING.RECONNECT_MAX_DELAY,
        timeout: 20000,
        transports: ['websocket', 'polling']
      });

      console.log('Initializing socket connection...');
      setConnectionStatus(CONNECTION_STATUS.CONNECTING);

      socketInstance.on('connect', () => {
        console.log('Connected to Socket.IO server with ID:', socketInstance.id);
        console.log('Connection details:', {
          connected: socketInstance.connected,
          disconnected: socketInstance.disconnected,
          id: socketInstance.id
        });
        
        setConnectionAttempts(0);
        setConnectionError(null);
        setConnectionStatus(CONNECTION_STATUS.CONNECTED);
        setSocket(socketInstance);
        
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
        
        setConnectionStatus(CONNECTION_STATUS.ERROR);
        setConnectionError(error.message);
        
        setConnectionAttempts(prev => {
          const newAttempts = prev + 1;
          if (newAttempts >= maxReconnectAttempts) {
            console.error('Max reconnection attempts reached. Please check server status.');
            socketInstance.disconnect();
            
            toast.error(`Failed to connect to server after ${maxReconnectAttempts} attempts. Please check your internet connection or try again later.`, {
              position: 'bottom-right',
              autoClose: false,
              closeOnClick: false,
              draggable: true
            });
          } else {
            toast.warning(`Connection error: ${error.message}. Retrying... (${newAttempts}/${maxReconnectAttempts})`, {
              position: 'bottom-right',
              autoClose: 5000
            });
          }
          return newAttempts;
        });
      });

      socketInstance.on(SOCKET_EVENTS.DISCONNECT, (reason) => {
        console.log('Disconnected from server:', reason);
        setConnectionStatus(CONNECTION_STATUS.DISCONNECTED);
        setSocket(null);
        
        toast.info('Disconnected from server. Attempting to reconnect...', {
          position: 'bottom-right',
          autoClose: 5000
        });
      });

      socketInstance.on(SOCKET_EVENTS.SESSION_ENDED, (data) => {
        console.log('Session ended by owner:', data);
        
        toast.warning(data.message || 'The session has been ended by the owner', {
          position: 'bottom-right',
          autoClose: false,
          closeOnClick: false,
          draggable: true
        });
        
        setTimeout(() => {
          window.location.href = 'http://localhost:5173/';
        }, 3000);
      });

      socketInstance.on(SOCKET_EVENTS.ERROR, (error) => {
        console.error('Socket error:', error);
        setConnectionError(error.message || 'Unknown socket error');

        toast.error(`Socket error: ${error.message || 'Unknown error'}`, {
          position: 'bottom-right',
          autoClose: 5000
        });
      });

      setSocket(socketInstance);
    }, TIMING.RECONNECT_DELAY);
  }, [maxReconnectAttempts]);

  useEffect(() => {
    initializeSocket();
    return () => {
      if (socket) {
        socket.disconnect();
        socket.off(SOCKET_EVENTS.CONNECT);
        socket.off('connect_error');
        socket.off(SOCKET_EVENTS.DISCONNECT);
        socket.off(SOCKET_EVENTS.ERROR);
        socket.off(SOCKET_EVENTS.SESSION_ENDED);
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
      maxReconnectAttempts,
      userId
    }}>
      {children}
    </SocketContext.Provider>
  );
}
