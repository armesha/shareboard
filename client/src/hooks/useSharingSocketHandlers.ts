import { useEffect } from 'react';
import type { Socket } from 'socket.io-client';
import { SOCKET_EVENTS, STORAGE_KEYS, SHARING_MODES } from '../constants';
import { setSessionToken, getSessionToken } from '../utils/sessionToken';
import type {
  SharingInfoData,
  SharingModeChangedData,
  EditTokenUpdateData,
  SharingModeType
} from '../types/sharing';

interface UseSharingSocketHandlersProps {
  socket: Socket | null;
  workspaceId: string;
  setSharingMode: (mode: SharingModeType) => void;
  setAllowedUsers: (users: string[]) => void;
  setHasEditAccess: (access: boolean) => void;
  setWorkspaceOwner: (owner: string | null) => void;
  setIsOwner: (isOwner: boolean) => void;
  setCurrentUser: (user: string | null) => void;
  setSharingInfoReceived: (received: boolean) => void;
}

export function useSharingSocketHandlers({
  socket,
  workspaceId,
  setSharingMode,
  setAllowedUsers,
  setHasEditAccess,
  setWorkspaceOwner,
  setIsOwner,
  setCurrentUser,
  setSharingInfoReceived
}: UseSharingSocketHandlersProps): void {
  useEffect(() => {
    if (!socket) return;

    const handleSharingUpdate = (data: SharingInfoData): void => {
      setSharingMode(data.sharingMode || SHARING_MODES.READ_WRITE_SELECTED);
      setAllowedUsers(data.allowedUsers || []);

      const currentUserId = localStorage.getItem(STORAGE_KEYS.USER_ID);

      if (data.hasEditAccess !== undefined) {
        setHasEditAccess(data.hasEditAccess);
      } else if (data.isOwner || (data.owner && currentUserId && data.owner === currentUserId)) {
        setHasEditAccess(true);
      } else {
        setHasEditAccess(false);
      }

      if (data.owner) setWorkspaceOwner(data.owner);

      if (data.isOwner !== undefined) {
        setIsOwner(data.isOwner);
      } else if (data.owner && currentUserId) {
        setIsOwner(data.owner === currentUserId);
      }

      if (data.currentUser) {
        setCurrentUser(data.currentUser);
      } else if (currentUserId) {
        setCurrentUser(currentUserId);
      }

      if (data.editToken) setSessionToken(STORAGE_KEYS.editToken(workspaceId), data.editToken);
      setSharingInfoReceived(true);
    };

    const handleEditTokenUpdate = (data: EditTokenUpdateData): void => {
      if (data.editToken) setSessionToken(STORAGE_KEYS.editToken(workspaceId), data.editToken);
    };

    const handleSharingModeChanged = (data: SharingModeChangedData): void => {
      if (data.sharingMode) {
        setSharingMode(data.sharingMode);
        if (Array.isArray(data.allowedUsers)) setAllowedUsers(data.allowedUsers);

        if (data.hasEditAccess !== undefined) {
          setHasEditAccess(data.hasEditAccess);
        } else if (data.sharingMode === SHARING_MODES.READ_ONLY) {
          setHasEditAccess(false);
        } else if (data.sharingMode === SHARING_MODES.READ_WRITE_ALL) {
          setHasEditAccess(true);
        }
      }
      if (data.editToken) setSessionToken(STORAGE_KEYS.editToken(workspaceId), data.editToken);
    };

    socket.on(SOCKET_EVENTS.SHARING_INFO, handleSharingUpdate);
    socket.on(SOCKET_EVENTS.EDIT_TOKEN_UPDATED, handleEditTokenUpdate);
    socket.on(SOCKET_EVENTS.SHARING_MODE_CHANGED, handleSharingModeChanged);

    return () => {
      socket.off(SOCKET_EVENTS.SHARING_INFO, handleSharingUpdate);
      socket.off(SOCKET_EVENTS.EDIT_TOKEN_UPDATED, handleEditTokenUpdate);
      socket.off(SOCKET_EVENTS.SHARING_MODE_CHANGED, handleSharingModeChanged);
    };
  }, [
    socket, workspaceId, setSharingMode, setAllowedUsers, setHasEditAccess,
    setWorkspaceOwner, setIsOwner, setCurrentUser, setSharingInfoReceived
  ]);
}

export function getAccessTokenFromStorage(workspaceId: string): string | null {
  return getSessionToken(STORAGE_KEYS.accessToken(workspaceId)) ||
    new URLSearchParams(window.location.search).get('access');
}
