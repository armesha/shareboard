import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { toast } from 'react-toastify';
import { SOCKET_EVENTS, CONNECTION_STATUS, TIMING } from '../constants';
import { getPersistentUserId } from '../utils';

const SocketContext = createContext(null);

export function useSocket() {
  return useContext(SocketContext);
}

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [connectionError, setConnectionError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState(CONNECTION_STATUS.CONNECTING);
  const [userId, setUserId] = useState(null);
  const maxReconnectAttempts = 5;

  useEffect(() => {
    const persistentUserId = getPersistentUserId();
    setUserId(persistentUserId);
  }, []);

  const initializeSocket = useCallback(() => {
    setTimeout(() => {
      const serverUrl = import.meta.env.DEV ? 'http://localhost:3000' : undefined;
      const socketInstance = io(serverUrl, {
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: maxReconnectAttempts,
        reconnectionDelay: TIMING.RECONNECT_DELAY,
        reconnectionDelayMax: TIMING.RECONNECT_MAX_DELAY,
        timeout: 20000,
        transports: ['websocket', 'polling']
      });

      setConnectionStatus(CONNECTION_STATUS.CONNECTING);

      socketInstance.on('connect', () => {
        setConnectionAttempts(0);
        setConnectionError(null);
        setConnectionStatus(CONNECTION_STATUS.CONNECTED);

        toast.success('Connected to server successfully!', {
          position: 'bottom-right',
          autoClose: 3000
        });
      });

      socketInstance.on('connect_error', (error) => {
        setConnectionStatus(CONNECTION_STATUS.ERROR);
        setConnectionError(error.message);

        setConnectionAttempts(prev => {
          const newAttempts = prev + 1;
          if (newAttempts >= maxReconnectAttempts) {
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

      socketInstance.on(SOCKET_EVENTS.DISCONNECT, () => {
        setConnectionStatus(CONNECTION_STATUS.DISCONNECTED);
        setSocket(null);

        toast.info('Disconnected from server. Attempting to reconnect...', {
          position: 'bottom-right',
          autoClose: 5000
        });
      });


      socketInstance.on(SOCKET_EVENTS.ERROR, (error) => {
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
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initializeSocket]);

  useEffect(() => {
    if (connectionAttempts >= maxReconnectAttempts) {
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
