import { useState, useEffect } from 'react';
import { useSharing } from '../context/SharingContext';
import { useSocket } from '../context/SocketContext';
import { SOCKET_EVENTS, SHARING_MODES, STORAGE_KEYS } from '../constants';

export default function SharingSettings({ workspaceId, onClose }) {
  const { socket } = useSocket();
  const {
    sharingMode,
    allowedUsers,
    isOwner,
    currentUser
  } = useSharing();
  
  const [activeUsers, setActiveUsers] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [editLink, setEditLink] = useState('');
  const [copySuccess, setCopySuccess] = useState('');

  useEffect(() => {
    console.log("SharingSettings component state:", {
      isOwner,
      currentUser,
      sharingMode,
      allowedUsers,
      persistedUserId: localStorage.getItem(STORAGE_KEYS.USER_ID)
    });
  }, [isOwner, currentUser, sharingMode, allowedUsers]);

  useEffect(() => {
    if (!socket || !workspaceId) return;

    const persistentUserId = localStorage.getItem(STORAGE_KEYS.USER_ID);
    if (persistentUserId) {
      socket.emit(SOCKET_EVENTS.GET_SHARING_INFO, {
        workspaceId,
        userId: persistentUserId
      });
    }

    const handleActiveUsersUpdate = (data) => {
      setActiveUsers(data.activeUsers || []);
    };

    socket.on(SOCKET_EVENTS.ACTIVE_USERS_UPDATE, handleActiveUsersUpdate);
    socket.emit(SOCKET_EVENTS.GET_ACTIVE_USERS, { workspaceId });

    if (isOwner) {
      socket.emit(SOCKET_EVENTS.GET_EDIT_TOKEN, { workspaceId }, (response) => {
        if (response && response.editToken) {
          const baseUrl = window.location.origin;
          const path = `/w/${workspaceId}`;
          setEditLink(`${baseUrl}${path}?access=${response.editToken}`);
          console.log("Retrieved existing edit token from server");
        } else {
          const baseUrl = window.location.origin;
          const path = `/w/${workspaceId}`;
          const editToken = `edit_${Math.random().toString(36).substring(2, 10)}`;
          setEditLink(`${baseUrl}${path}?access=${editToken}`);

          if (sharingMode === SHARING_MODES.READ_WRITE_SELECTED) {
            socket.emit(SOCKET_EVENTS.SET_EDIT_TOKEN, { workspaceId, editToken });
            console.log("Generated and sent new edit token to server");
          }
        }
      });
    }

    return () => {
      socket.off(SOCKET_EVENTS.ACTIVE_USERS_UPDATE, handleActiveUsersUpdate);
    };
  }, [socket, workspaceId, sharingMode, isOwner]);

  const copyToClipboard = (text, isEditLink = false) => {
    navigator.clipboard.writeText(text);
    if (isEditLink) {
      setCopySuccess('edit');
    } else {
      setCopySuccess('view');
    }
    setTimeout(() => setCopySuccess(''), 2000);
  };

  if (!isOwner) {
    const persistentUserId = localStorage.getItem(STORAGE_KEYS.USER_ID);
    
    return (
      <div className="p-6 bg-white rounded-lg shadow-lg max-w-lg w-full">
        <h2 className="text-xl font-semibold mb-4">Sharing Settings</h2>
        <p className="text-gray-600">
          You don't have permission to change sharing settings.
          Only the workspace owner can modify these settings.
        </p>
        <div className="mt-4 text-sm text-gray-500">
          <p>Debug info:</p>
          <p>Is owner (prop): {String(isOwner)}</p>
          <p>Current user: {currentUser}</p>
          <p>Current mode: {sharingMode}</p>
          <p>Workspace ID: {workspaceId}</p>
          <p>Persisted user ID: {persistentUserId}</p>
          <p>localStorage ID matches current user: {String(persistentUserId === currentUser)}</p>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Close
          </button>
          <button
            onClick={() => {
              socket.emit(SOCKET_EVENTS.GET_SHARING_INFO, {
                workspaceId,
                userId: persistentUserId
              });
            }}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Refresh permissions
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg max-w-lg w-full">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Sharing Settings</h2>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="mb-6 space-y-3">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex justify-between items-start mb-2">
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-blue-900 mb-1">View Link</h3>
              <p className="text-xs text-blue-700">Share this link for read-only access</p>
              <p className="text-xs text-gray-600 mt-1 break-all font-mono">{window.location.href.split('?')[0]}</p>
            </div>
            <button
              onClick={() => copyToClipboard(window.location.href.split('?')[0])}
              className="ml-3 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 whitespace-nowrap"
            >
              {copySuccess === 'view' ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex justify-between items-start mb-2">
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-green-900 mb-1">Edit Link</h3>
              <p className="text-xs text-green-700">Share this link to grant edit access</p>
              {editLink && (
                <p className="text-xs text-gray-600 mt-1 break-all font-mono">{editLink}</p>
              )}
            </div>
            <button
              onClick={() => copyToClipboard(editLink, true)}
              className="ml-3 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 whitespace-nowrap"
              disabled={!editLink}
            >
              {copySuccess === 'edit' ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 