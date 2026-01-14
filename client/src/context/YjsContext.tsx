import { createContext, useContext, useEffect, useMemo, useState, useRef, type ReactNode } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { useTranslation } from 'react-i18next';
import { CURSOR_ANIMALS, CURSOR_COLORS, TOAST } from '../constants';
import { useSharing } from './SharingContext';
import { toast } from '../utils/toast';

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
  const accessToken = sharingContext?.accessToken;
  const sharingInfoReceived = sharingContext?.sharingInfoReceived;
  const [doc] = useState(() => new Y.Doc());
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [status, setStatus] = useState<YjsStatus>('disconnected');
  const [synced, setSynced] = useState(false);
  const wasConnectedRef = useRef(false);

  useEffect(() => {
    if (!workspaceId || !sharingInfoReceived) return;

    const seed = currentUser || workspaceId;
    const color = pickColor(seed);
    const animalIndex = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % CURSOR_ANIMALS.length;
    const animalKey = CURSOR_ANIMALS[animalIndex];
    const animalName = t(`animals.${animalKey}`);
    const apiBaseUrl = import.meta.env.VITE_API_URL as string | undefined;
    const wsProtocol = (apiBaseUrl ? new URL(apiBaseUrl).protocol : window.location.protocol) === 'https:' ? 'wss' : 'ws';
    const wsHost = apiBaseUrl ? new URL(apiBaseUrl).host : window.location.host;
    const params = new URLSearchParams();

    if (currentUser) {
      params.set('userId', currentUser);
    }
    if (accessToken) {
      params.set('accessToken', accessToken);
    }

    const query = params.toString();
    const baseUrl = `${wsProtocol}://${wsHost}/yjs`;
    const url = query ? `${baseUrl}?${query}` : baseUrl;

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

    const handleStatus = ({ status: nextStatus }: StatusEvent): void => {
      if (nextStatus === 'disconnected' && wasConnectedRef.current) {
        toast.warning(t('messages:errors.yjsDisconnected', 'Code editor disconnected. Reconnecting...'), {
          position: TOAST.POSITION,
          autoClose: 3000
        });
      }
      if (nextStatus === 'connected') {
        wasConnectedRef.current = true;
      }
      setStatus(nextStatus);
    };
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
  }, [workspaceId, currentUser, accessToken, sharingInfoReceived, doc, t]);

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
