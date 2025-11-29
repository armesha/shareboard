import React, { useState, useEffect, useRef } from 'react';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';

const OptionsMenu = React.memo(function OptionsMenu({
  onClearCanvas,
  onEndSession,
  isOwner = false,
  disabled = false,
  socket,
  workspaceId
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (disabled) return null;

  const handleClearCanvas = () => {
    const confirmClear = window.confirm('Are you sure you want to clear the whiteboard?');
    if (confirmClear) {
      if (socket) {
        socket.emit('whiteboard-clear', { workspaceId });
      }
      onClearCanvas();
    }
    setIsOpen(false);
  };

  const handleEndSession = () => {
    const confirmEnd = window.confirm('Are you sure you want to end the session for all participants?');
    if (confirmEnd) {
      if (socket) {
        socket.emit('end-session', { workspaceId });
      }
      onEndSession?.();
    }
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        className="p-2 rounded-full hover:bg-gray-100 transition-all duration-200"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="More options"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        title="More Options"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 text-gray-700"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>

      {isOpen && (
        <div
          className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50 w-48"
          role="menu"
          aria-label="More options"
        >
          <button
            type="button"
            className="w-full px-4 py-2 hover:bg-gray-100 flex items-center text-left"
            onClick={handleClearCanvas}
            role="menuitem"
          >
            <CleaningServicesIcon className="h-5 w-5 mr-2 text-red-500" />
            <span>Clear Whiteboard</span>
          </button>

          {isOwner && (
            <button
              type="button"
              className="w-full px-4 py-2 hover:bg-gray-100 flex items-center text-left"
              onClick={handleEndSession}
              role="menuitem"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2 text-red-500"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z"
                  clipRule="evenodd"
                />
              </svg>
              <span>End Session</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
});

export default OptionsMenu;
