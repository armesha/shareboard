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
    changePermission, 
    addAllowedUser, 
    removeAllowedUser 
  } = useSharing();
  
  const [activeUsers, setActiveUsers] = useState([]);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

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

    return () => {
      socket.off('active-users-update', handleActiveUsersUpdate);
    };
  }, [socket, workspaceId]);

  const handleChangePermission = (mode) => {
    changePermission(mode, mode === 'read-write-selected' ? allowedUsers : []);
  };

  const handleAddUser = (e) => {
    e.preventDefault();
    if (!newUserEmail) return;
    
    setIsSubmitting(true);
    setErrorMessage('');
    
    socket.emit('invite-user', { workspaceId, email: newUserEmail }, (response) => {
      setIsSubmitting(false);
      
      if (response.error) {
        setErrorMessage(response.error);
      } else {
        addAllowedUser(response.userId);
        setNewUserEmail('');
      }
    });
  };

  const handleRemoveUser = (userId) => {
    removeAllowedUser(userId);
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
            <span className="ml-2">Read Only - Anyone with the link can view</span>
          </label>
          <label className="inline-flex items-center">
            <input
              type="radio"
              className="form-radio text-blue-500"
              name="permission"
              checked={sharingMode === 'read-write-all'}
              onChange={() => handleChangePermission('read-write-all')}
            />
            <span className="ml-2">Read/Write (All) - Anyone with the link can edit</span>
          </label>
          <label className="inline-flex items-center">
            <input
              type="radio"
              className="form-radio text-blue-500"
              name="permission"
              checked={sharingMode === 'read-write-selected'}
              onChange={() => handleChangePermission('read-write-selected')}
            />
            <span className="ml-2">Read/Write (Selected Users) - Only specific users can edit</span>
          </label>
        </div>
      </div>
      
      {sharingMode === 'read-write-selected' && (
        <div className="mb-6">
          <h3 className="text-md font-medium mb-2">Users with Edit Access</h3>
          <div className="mb-4">
            <form onSubmit={handleAddUser} className="flex space-x-2">
              <input
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="Enter email address"
                className="flex-1 px-3 py-2 border border-gray-300 rounded"
                disabled={isSubmitting}
              />
              <button
                type="submit"
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-blue-300"
                disabled={isSubmitting || !newUserEmail}
              >
                Add
              </button>
            </form>
            {errorMessage && (
              <p className="mt-2 text-sm text-red-600">{errorMessage}</p>
            )}
          </div>
          
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {allowedUsers.length > 0 ? (
              allowedUsers.map((user) => {
                const activeUser = activeUsers.find(u => u.id === user);
                return (
                  <div key={user} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <div className="flex items-center">
                      <span className="font-medium">{activeUser?.email || user}</span>
                      {activeUser?.online && (
                        <span className="ml-2 inline-flex h-2 w-2 rounded-full bg-green-500"></span>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveUser(user)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                );
              })
            ) : (
              <p className="text-gray-500">No users with edit access</p>
            )}
          </div>
        </div>
      )}
      
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-md font-medium">Workspace Link</h3>
            <p className="text-sm text-gray-500">Share this link to grant access to others</p>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              alert('Link copied to clipboard!');
            }}
            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
          >
            Copy Link
          </button>
        </div>
      </div>
    </div>
  );
} 