import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { useTranslation } from 'react-i18next';
import { CURSOR_ANIMALS, CURSOR_COLORS } from '../constants';
import { useSharing } from './SharingContext';

const YjsContext = createContext(null);

function pickColor(seed) {
  const hashed = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return CURSOR_COLORS[hashed % CURSOR_COLORS.length]?.color || CURSOR_COLORS[0].color;
}

export function YjsProvider({ workspaceId, children }) {
  const { t } = useTranslation('common');
  const { currentUser } = useSharing() || {};
  const [doc] = useState(() => new Y.Doc());
  const [provider, setProvider] = useState(null);
  const [status, setStatus] = useState('disconnected');
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    if (!workspaceId) return;

    const seed = currentUser || workspaceId;
    const color = pickColor(seed);
    const animalIndex = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % CURSOR_ANIMALS.length;
    const animalKey = CURSOR_ANIMALS[animalIndex];
    const animalName = t(`animals.${animalKey}`);
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const port = window.location.port ? `:${window.location.port}` : '';
    const url = `${protocol}://${window.location.hostname}${port}/yjs`;
    const wsProvider = new WebsocketProvider(
      url,
      workspaceId,
      doc
    );

    wsProvider.awareness.setLocalStateField('user', {
      id: currentUser || workspaceId,
      name: animalName,
      color,
      animal: animalKey
    });

    const handleStatus = ({ status: nextStatus }) => setStatus(nextStatus);
    const handleSync = (isSynced) => setSynced(isSynced);

    wsProvider.on('status', handleStatus);
    wsProvider.on('synced', handleSync);

    if (wsProvider.synced) {
      setSynced(true);
    }

    setProvider(wsProvider);

    return () => {
      wsProvider.off('status', handleStatus);
      wsProvider.off('synced', handleSync);
      wsProvider.destroy();
      setProvider(null);
      setStatus('disconnected');
      setSynced(false);
    };
  }, [workspaceId, currentUser, doc, t]);

  const value = useMemo(() => ({
    doc,
    provider,
    status,
    synced
  }), [doc, provider, status, synced]);

  return (
    <YjsContext.Provider value={value}>
      {children}
    </YjsContext.Provider>
  );
}

export function useYjs() {
  return useContext(YjsContext);
}
