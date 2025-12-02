import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSocket } from '../context/SocketContext';
import { SOCKET_EVENTS, TIMING, CURSOR_COLORS, CURSOR_ANIMALS, CONNECTION_STATUS } from '../constants';
import { getWorkspaceId } from '../utils';

export function useCursorSync() {
  const { t } = useTranslation('common');
  const { socket, connectionStatus } = useSocket();
  const isConnected = connectionStatus === CONNECTION_STATUS.CONNECTED;
  const [remoteCursors, setRemoteCursors] = useState({});
  const [userInfo, setUserInfo] = useState(null);
  const lastEmitTime = useRef(0);
  const cursorTimeouts = useRef({});
  const animalKeyRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    const colorIndex = Math.floor(Math.random() * CURSOR_COLORS.length);
    const animalIndex = Math.floor(Math.random() * CURSOR_ANIMALS.length);
    animalKeyRef.current = CURSOR_ANIMALS[animalIndex];

    setUserInfo({
      colorIndex: colorIndex,
      animalKey: CURSOR_ANIMALS[animalIndex],
      name: t(`animals.${CURSOR_ANIMALS[animalIndex]}`),
      color: CURSOR_COLORS[colorIndex].color,
    });
  }, [socket, t]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleCursorUpdate = ({ userId, position, userColor, animalKey }) => {
      if (userId === socket.id) return;

      if (cursorTimeouts.current[userId]) {
        clearTimeout(cursorTimeouts.current[userId]);
      }

      const translatedName = animalKey ? t(`animals.${animalKey}`) : 'User';

      setRemoteCursors(prev => ({
        ...prev,
        [userId]: {
          x: position.x,
          y: position.y,
          color: userColor || CURSOR_COLORS[0].color,
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

    const handleUserLeft = ({ userId }) => {
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

    socket.on(SOCKET_EVENTS.CURSOR_UPDATE, handleCursorUpdate);
    socket.on(SOCKET_EVENTS.USER_LEFT, handleUserLeft);

    return () => {
      socket.off(SOCKET_EVENTS.CURSOR_UPDATE, handleCursorUpdate);
      socket.off(SOCKET_EVENTS.USER_LEFT, handleUserLeft);

      Object.values(cursorTimeouts.current).forEach(clearTimeout);
      cursorTimeouts.current = {};
    };
  }, [socket, isConnected, t]);

  const emitCursorPosition = useCallback((x, y) => {
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
    userInfo,
  };
}
