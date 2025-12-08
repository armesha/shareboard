import { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { toast } from '../utils/toast';
import i18n from '../i18n';
import { SOCKET_EVENTS, CONNECTION_STATUS, TIMING, SOCKET, TOAST } from '../constants';
import { getPersistentUserId } from '../utils';

type ConnectionStatusType = typeof CONNECTION_STATUS[keyof typeof CONNECTION_STATUS];

interface SocketContextValue {
  socket: Socket | null;
  connectionStatus: ConnectionStatusType;
  connectionError: string | null;
  connectionAttempts: number;
  maxReconnectAttempts: number;
  userId: string | null;
}

interface SocketProviderProps {
  children: ReactNode;
}

const SocketContext = createContext<SocketContextValue | null>(null);

export function useSocket(): SocketContextValue {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatusType>(CONNECTION_STATUS.CONNECTING);
  const [userId, setUserId] = useState<string | null>(null);
  const socketInstanceRef = useRef<Socket | null>(null);
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

      toast.success(i18n.t('messages:notifications.connected'), {
        position: TOAST.POSITION,
        autoClose: TIMING.NOTIFICATION_DURATION
      });
    });

    socketInstance.on('connect_error', (error: Error) => {
      setConnectionStatus(CONNECTION_STATUS.ERROR);
      setConnectionError(error.message);

      setConnectionAttempts(prev => {
        const newAttempts = prev + 1;
        if (newAttempts >= maxReconnectAttempts) {
          socketInstance.disconnect();

          toast.error(i18n.t('messages:errors.connectionFailed', { attempts: maxReconnectAttempts }), {
            position: TOAST.POSITION,
            autoClose: 10000,
            closeOnClick: true,
            draggable: true
          });
        } else {
          toast.warning(i18n.t('messages:notifications.connectionRetrying', { message: error.message, current: newAttempts, max: maxReconnectAttempts }), {
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

      toast.info(i18n.t('messages:notifications.disconnected'), {
        position: TOAST.POSITION,
        autoClose: 5000
      });
    });


    socketInstance.on(SOCKET_EVENTS.ERROR, (error: { message?: string }) => {
      setConnectionError(error.message || 'Unknown socket error');

      toast.error(i18n.t('messages:errors.socketError', { message: error.message || 'Unknown error' }), {
        position: TOAST.POSITION,
        autoClose: 5000
      });
    });

    socketInstanceRef.current = socketInstance;
    setSocket(socketInstance);
  }, [maxReconnectAttempts]);

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

  const contextValue = useMemo((): SocketContextValue => ({
    socket,
    connectionStatus,
    connectionError,
    connectionAttempts,
    maxReconnectAttempts,
    userId
  }), [socket, connectionStatus, connectionError, connectionAttempts, maxReconnectAttempts, userId]);

  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
}
