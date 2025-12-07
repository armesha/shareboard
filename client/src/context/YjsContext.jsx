import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { CURSOR_ANIMALS, CURSOR_COLORS } from '../constants';
import { useSharing } from './SharingContext';

const YjsContext = createContext(null);

function pickColor(seed) {
  const hashed = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return CURSOR_COLORS[hashed % CURSOR_COLORS.length]?.color || CURSOR_COLORS[0].color;
}

export function YjsProvider({ workspaceId, children }) {
  const { currentUser } = useSharing() || {};
  const [doc] = useState(() => new Y.Doc());
  const [provider, setProvider] = useState(null);
  const [status, setStatus] = useState('disconnected');

  useEffect(() => {
    if (!workspaceId) return;

    const color = pickColor(currentUser || workspaceId);
    const animal = CURSOR_ANIMALS[(currentUser?.length || workspaceId.length) % CURSOR_ANIMALS.length];
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${protocol}://${window.location.hostname}:1234`;
    const wsProvider = new WebsocketProvider(
      url,
      workspaceId,
      doc
    );

    wsProvider.awareness.setLocalStateField('user', {
      id: currentUser || workspaceId,
      name: currentUser || 'User',
      color,
      animal
    });

    const handleStatus = ({ status: nextStatus }) => setStatus(nextStatus);
    wsProvider.on('status', handleStatus);
    setProvider(wsProvider);

    return () => {
      wsProvider.off('status', handleStatus);
      wsProvider.destroy();
      setProvider(null);
      setStatus('disconnected');
    };
  }, [workspaceId, currentUser, doc]);

  const value = useMemo(() => ({
    doc,
    provider,
    status
  }), [doc, provider, status]);

  return (
    <YjsContext.Provider value={value}>
      {children}
    </YjsContext.Provider>
  );
}

export function useYjs() {
  return useContext(YjsContext);
}
