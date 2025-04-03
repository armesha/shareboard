import { useState, useEffect } from 'react';
import { useSharing } from '../context/SharingContext';
import { useSocket } from '../context/SocketContext';

export default function SharingSettings({ workspaceId, onClose }) {
  const { socket } = useSocket();
  const { 
    sharingMode, 
    allowedUsers, 
    isOwner, 
    currentUser,
    changePermission 
  } = useSharing();
  
  const [activeUsers, setActiveUsers] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [editLink, setEditLink] = useState('');
  const [copySuccess, setCopySuccess] = useState('');

  // Debug logging
  useEffect(() => {
    console.log("SharingSettings component state:", {
      isOwner,
      currentUser,
      sharingMode,
      allowedUsers,
      persistedUserId: localStorage.getItem('shareboardUserId')
    });
  }, [isOwner, currentUser, sharingMode, allowedUsers]);

  useEffect(() => {
    if (!socket || !workspaceId) return;

    // Force a refresh of sharing info when opened
    const persistentUserId = localStorage.getItem('shareboardUserId');
    if (persistentUserId) {
      socket.emit('get-sharing-info', { 
        workspaceId, 
        userId: persistentUserId 
      });
    }

    const handleActiveUsersUpdate = (data) => {
      setActiveUsers(data.activeUsers || []);
    };

    socket.on('active-users-update', handleActiveUsersUpdate);
    socket.emit('get-active-users', { workspaceId });

    // Only owners can access edit tokens directly
    if (isOwner) {
      // Request the existing edit token from the server
      socket.emit('get-edit-token', { workspaceId }, (response) => {
        if (response && response.editToken) {
          // Use the existing token
          const baseUrl = window.location.origin;
          const path = window.location.pathname;
          setEditLink(`${baseUrl}${path}?access=${response.editToken}`);
          console.log("Retrieved existing edit token from server");
        } else {
          // Generate a new edit token only if one doesn't exist yet
          const baseUrl = window.location.origin;
          const path = window.location.pathname;
          const editToken = `edit_${Math.random().toString(36).substring(2, 10)}`;
          setEditLink(`${baseUrl}${path}?access=${editToken}`);
          
          // Send the new token to the server to be stored if in selected users mode
          if (sharingMode === 'read-write-selected') {
            socket.emit('set-edit-token', { workspaceId, editToken });
            console.log("Generated and sent new edit token to server");
          }
        }
      });
    }

    return () => {
      socket.off('active-users-update', handleActiveUsersUpdate);
    };
  }, [socket, workspaceId, sharingMode, isOwner]);

  const handleChangePermission = (mode) => {
    if (!socket || !workspaceId) return;
    
    // If switching to read-write-selected, ensure we have a token
    if (mode === 'read-write-selected' && editLink) {
      try {
        const urlParams = new URLSearchParams(new URL(editLink).search);
        const editToken = urlParams.get('access');
        if (editToken) {
          // Make sure token is stored on the server
          socket.emit('set-edit-token', { workspaceId, editToken });
          console.log("Sent token to server for read-write-selected mode:", editToken);
        }
      } catch (error) {
        console.error("Error parsing edit link:", error);
      }
    }
    
    // Change the permission
    changePermission(mode);
  };

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
    const persistentUserId = localStorage.getItem('shareboardUserId');
    
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
              // Force a refresh of the sharing info
              socket.emit('get-sharing-info', { 
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
      <div className="flex justify-between items-center mb-4">
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
      
      <div className="mb-6">
        <h3 className="text-md font-medium mb-2">Permission Settings</h3>
        <div className="flex flex-col space-y-2">
          <label className="inline-flex items-center">
            <input
              type="radio"
              className="form-radio text-blue-500"
              name="permission"
              checked={sharingMode === 'read-only'}
              onChange={() => handleChangePermission('read-only')}
            />
            <span className="ml-2">Read Only – Anyone with the link can view</span>
          </label>
          <label className="inline-flex items-center">
            <input
              type="radio"
              className="form-radio text-blue-500"
              name="permission"
              checked={sharingMode === 'read-write-all'}
              onChange={() => handleChangePermission('read-write-all')}
            />
            <span className="ml-2">Read/Write (All) – Anyone with the link can edit</span>
          </label>
          <label className="inline-flex items-center">
            <input
              type="radio"
              className="form-radio text-blue-500"
              name="permission"
              checked={sharingMode === 'read-write-selected'}
              onChange={() => handleChangePermission('read-write-selected')}
            />
            <span className="ml-2">Read/Write (Selected Users) – Only users with the special edit link can edit</span>
          </label>
        </div>
      </div>
      
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-md font-medium">Workspace Link</h3>
            <p className="text-sm text-gray-500">Share this link to grant view access</p>
          </div>
          <button
            onClick={() => copyToClipboard(window.location.href)}
            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
          >
            {copySuccess === 'view' ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
        
        {sharingMode === 'read-write-selected' && (
          <div className="flex justify-between items-center mt-4">
            <div>
              <h3 className="text-md font-medium">Edit Access Link</h3>
              <p className="text-sm text-gray-500">Share this special link to grant edit access</p>
            </div>
            <button
              onClick={() => copyToClipboard(editLink, true)}
              className="px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 rounded"
            >
              {copySuccess === 'edit' ? 'Copied!' : 'Copy Edit Link'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 