import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { STORAGE_KEYS } from '../constants';

export default function LandingPage() {
  const [workspaceKey, setWorkspaceKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const createWorkspace = async () => {
    try {
      let userId = localStorage.getItem(STORAGE_KEYS.USER_ID);
      if (!userId) {
        userId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        localStorage.setItem(STORAGE_KEYS.USER_ID, userId);
      }
      
      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId })
      });
      
      if (!response.ok) {
        throw new Error('Failed to create workspace');
      }
      
      const data = await response.json();
      navigate(`/w/${data.workspaceId}`);
    } catch {
      setError('Failed to create workspace. Please try again.');
    }
  };

  const joinWorkspace = (e) => {
    e.preventDefault();
    if (workspaceKey.trim()) {
      navigate(`/w/${workspaceKey.trim()}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            ShareBoard
          </h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            Real-time collaborative whiteboard and code editor
          </p>
        </div>
        
        <div className="mt-8 space-y-6">
          <button
            onClick={createWorkspace}
            disabled={isLoading}
            className={`w-full btn-primary ${
              isLoading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isLoading ? 'Creating...' : 'Create New Workspace'}
          </button>

          {error && (
            <div className="text-red-600 text-sm text-center">
              {error}
            </div>
          )}
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-50 text-gray-500">
                Or join existing
              </span>
            </div>
          </div>

          <form onSubmit={joinWorkspace} className="mt-8 space-y-6">
            <input
              type="text"
              required
              className="w-full input"
              placeholder="Enter workspace key"
              value={workspaceKey}
              onChange={(e) => setWorkspaceKey(e.target.value)}
            />
            <button
              type="submit"
              className="w-full btn-secondary"
            >
              Join Workspace
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
