import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { useTranslation } from 'react-i18next';
import { CURSOR_ANIMALS, CURSOR_COLORS } from '../constants';
import { useSharing } from './SharingContext';

type YjsStatus = 'disconnected' | 'connecting' | 'connected';

interface YjsContextValue {
  doc: Y.Doc;
  provider: WebsocketProvider | null;
  status: YjsStatus;
  synced: boolean;
}

interface YjsProviderProps {
  workspaceId: string;
  children: ReactNode;
}

interface StatusEvent {
  status: YjsStatus;
}

const YjsContext = createContext<YjsContextValue | null>(null);

function pickColor(seed: string): string {
  const hashed = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return CURSOR_COLORS[hashed % CURSOR_COLORS.length]?.color || CURSOR_COLORS[0].color;
}

export function YjsProvider({ workspaceId, children }: YjsProviderProps) {
  const { t } = useTranslation('common');
  const sharingContext = useSharing();
  const currentUser = sharingContext?.currentUser;
  const [doc] = useState(() => new Y.Doc());
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [status, setStatus] = useState<YjsStatus>('disconnected');
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

    const handleStatus = ({ status: nextStatus }: StatusEvent): void => setStatus(nextStatus);
    const handleSync = (isSynced: boolean): void => setSynced(isSynced);

    wsProvider.on('status', handleStatus);
    wsProvider.on('sync', handleSync);

    if (wsProvider.synced) {
      setSynced(true);
    }

    setProvider(wsProvider);

    return () => {
      wsProvider.off('status', handleStatus);
      wsProvider.off('sync', handleSync);
      wsProvider.destroy();
      setProvider(null);
      setStatus('disconnected');
      setSynced(false);
    };
  }, [workspaceId, currentUser, doc, t]);

  const value = useMemo((): YjsContextValue => ({
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

export function useYjs(): YjsContextValue {
  const context = useContext(YjsContext);
  if (!context) {
    throw new Error('useYjs must be used within a YjsProvider');
  }
  return context;
}
