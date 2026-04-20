import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSocket } from '../context/SocketContext';
import { SOCKET_EVENTS, TIMING, CURSOR_COLORS, CURSOR_ANIMALS, CONNECTION_STATUS } from '../constants';
import { getWorkspaceId } from '../utils';

interface CursorColor {
  color: string;
  name: string;
}

interface UserInfo {
  colorIndex: number;
  animalKey: string;
  name: string;
  color: string;
}

interface RemoteCursor {
  x: number;
  y: number;
  color: string;
  name: string;
  lastUpdate: number;
}

interface RemoteCursors {
  [userId: string]: RemoteCursor;
}

interface CursorUpdateEvent {
  userId: string;
  position: { x: number; y: number };
  userColor: string;
  animalKey: string;
}

interface UserLeftEvent {
  userId: string;
}

interface SocketContextValue {
  socket: {
    id: string;
    on: (event: string, handler: (...args: unknown[]) => void) => void;
    off: (event: string, handler: (...args: unknown[]) => void) => void;
    emit: (event: string, data: unknown) => void;
  } | null;
  connectionStatus: string;
}

interface UseCursorSyncReturn {
  remoteCursors: RemoteCursors;
  emitCursorPosition: (x: number, y: number) => void;
}

export function useCursorSync(): UseCursorSyncReturn {
  const { t } = useTranslation('common');
  const { socket, connectionStatus } = useSocket() as SocketContextValue;
  const isConnected = connectionStatus === CONNECTION_STATUS.CONNECTED;
  const [remoteCursors, setRemoteCursors] = useState<RemoteCursors>({});
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const lastEmitTime = useRef(0);
  const cursorTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    if (!socket) return;

    const colorIndex = Math.floor(Math.random() * CURSOR_COLORS.length);
    const animalIndex = Math.floor(Math.random() * CURSOR_ANIMALS.length);

    setUserInfo({
      colorIndex: colorIndex,
      animalKey: CURSOR_ANIMALS[animalIndex]!,
      name: t(`animals.${CURSOR_ANIMALS[animalIndex]}`),
      color: (CURSOR_COLORS[colorIndex] as CursorColor).color,
    });
  }, [socket, t]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleCursorUpdate = ({ userId, position, userColor, animalKey }: CursorUpdateEvent) => {
      if (userId === socket.id) return;

      if (cursorTimeouts.current[userId]) {
        clearTimeout(cursorTimeouts.current[userId]);
      }

      const translatedName = animalKey ? t(`animals.${animalKey}`) : 'User';
      const color = userColor || (CURSOR_COLORS[0] as CursorColor).color;

      setRemoteCursors(prev => ({
        ...prev,
        [userId]: {
          x: position.x,
          y: position.y,
          color,
          name: translatedName,
          lastUpdate: Date.now(),
        }
      }));

      cursorTimeouts.current[userId] = setTimeout(() => {
        setRemoteCursors(prev => {
          const newCursors = { ...prev };
          delete newCursors[userId];
          return newCursors;
        });
      }, TIMING.CURSOR_TIMEOUT);
    };

    const handleUserLeft = ({ userId }: UserLeftEvent) => {
      if (cursorTimeouts.current[userId]) {
        clearTimeout(cursorTimeouts.current[userId]);
        delete cursorTimeouts.current[userId];
      }

      setRemoteCursors(prev => {
        const newCursors = { ...prev };
        delete newCursors[userId];
        return newCursors;
      });
    };

    socket.on(SOCKET_EVENTS.CURSOR_UPDATE, handleCursorUpdate as unknown as (...args: unknown[]) => void);
    socket.on(SOCKET_EVENTS.USER_LEFT, handleUserLeft as unknown as (...args: unknown[]) => void);

    const timeouts = cursorTimeouts.current;

    return () => {
      socket.off(SOCKET_EVENTS.CURSOR_UPDATE, handleCursorUpdate as unknown as (...args: unknown[]) => void);
      socket.off(SOCKET_EVENTS.USER_LEFT, handleUserLeft as unknown as (...args: unknown[]) => void);

      Object.keys(timeouts).forEach(key => {
        clearTimeout(timeouts[key]);
        delete timeouts[key];
      });
    };
  }, [socket, isConnected, t]);

  const emitCursorPosition = useCallback((x: number, y: number) => {
    if (!socket || !isConnected || !userInfo) return;

    const now = Date.now();
    if (now - lastEmitTime.current < TIMING.CURSOR_THROTTLE) return;
    lastEmitTime.current = now;

    const workspaceId = getWorkspaceId();
    if (!workspaceId) return;

    socket.emit(SOCKET_EVENTS.CURSOR_POSITION, {
      workspaceId,
      position: { x, y },
      userColor: userInfo.color,
      animalKey: userInfo.animalKey,
    });
  }, [socket, isConnected, userInfo]);

  return {
    remoteCursors,
    emitCursorPosition,
  };
}
