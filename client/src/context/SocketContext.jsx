import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { SOCKET_EVENTS, CONNECTION_STATUS, TIMING, SOCKET, TOAST } from '../constants';
import { getPersistentUserId } from '../utils';

const SocketContext = createContext(null);

export function useSocket() {
  return useContext(SocketContext);
}

export function SocketProvider({ children }) {
  const { t } = useTranslation('messages');
  const [socket, setSocket] = useState(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [connectionError, setConnectionError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState(CONNECTION_STATUS.CONNECTING);
  const [userId, setUserId] = useState(null);
  const socketInstanceRef = useRef(null);
  const maxReconnectAttempts = SOCKET.MAX_RECONNECT_ATTEMPTS;

  useEffect(() => {
    const persistentUserId = getPersistentUserId();
    setUserId(persistentUserId);
  }, []);

  const initializeSocket = useCallback(() => {
    const serverUrl = import.meta.env.DEV ? 'http://localhost:3000' : undefined;
    const socketInstance = io(serverUrl, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: maxReconnectAttempts,
      reconnectionDelay: TIMING.RECONNECT_DELAY,
      reconnectionDelayMax: TIMING.RECONNECT_MAX_DELAY,
      timeout: TIMING.SOCKET_TIMEOUT,
      transports: ['websocket', 'polling']
    });

    setConnectionStatus(CONNECTION_STATUS.CONNECTING);

    socketInstance.on('connect', () => {
      setConnectionAttempts(0);
      setConnectionError(null);
      setConnectionStatus(CONNECTION_STATUS.CONNECTED);

      toast.success(t('notifications.connected'), {
        position: TOAST.POSITION,
        autoClose: TIMING.NOTIFICATION_DURATION
      });
    });

    socketInstance.on('connect_error', (error) => {
      setConnectionStatus(CONNECTION_STATUS.ERROR);
      setConnectionError(error.message);

      setConnectionAttempts(prev => {
        const newAttempts = prev + 1;
        if (newAttempts >= maxReconnectAttempts) {
          socketInstance.disconnect();

          toast.error(t('errors.connectionFailed', { attempts: maxReconnectAttempts }), {
            position: TOAST.POSITION,
            autoClose: false,
            closeOnClick: false,
            draggable: true
          });
        } else {
          toast.warning(t('notifications.connectionRetrying', { message: error.message, current: newAttempts, max: maxReconnectAttempts }), {
            position: TOAST.POSITION,
            autoClose: 5000
          });
        }
        return newAttempts;
      });
    });

    socketInstance.on(SOCKET_EVENTS.DISCONNECT, () => {
      setConnectionStatus(CONNECTION_STATUS.DISCONNECTED);
      setSocket(null);

      toast.info(t('notifications.disconnected'), {
        position: TOAST.POSITION,
        autoClose: 5000
      });
    });


    socketInstance.on(SOCKET_EVENTS.ERROR, (error) => {
      setConnectionError(error.message || 'Unknown socket error');

      toast.error(t('errors.socketError', { message: error.message || 'Unknown error' }), {
        position: TOAST.POSITION,
        autoClose: 5000
      });
    });

    socketInstanceRef.current = socketInstance;
    setSocket(socketInstance);
  }, [maxReconnectAttempts, t]);

  useEffect(() => {
    initializeSocket();
    return () => {
      if (socketInstanceRef.current) {
        socketInstanceRef.current.off(SOCKET_EVENTS.CONNECT);
        socketInstanceRef.current.off('connect_error');
        socketInstanceRef.current.off(SOCKET_EVENTS.DISCONNECT);
        socketInstanceRef.current.off(SOCKET_EVENTS.ERROR);
        socketInstanceRef.current.disconnect();
        socketInstanceRef.current = null;
      }
    };
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
