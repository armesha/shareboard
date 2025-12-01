import React, { useState, useEffect, useRef } from 'react';
import DeleteIcon from '@mui/icons-material/Delete';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import DownloadIcon from '@mui/icons-material/Download';
import { useWhiteboard } from '../../context/WhiteboardContext';
import { ExportPreviewModal, ConfirmDialog } from './index';

const OptionsMenu = React.memo(function OptionsMenu({
  onClearCanvas,
  onEndSession,
  isOwner = false,
  disabled = false,
  socket,
  workspaceId,
  readOnly = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [showExportPreview, setShowExportPreview] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showEndSessionConfirm, setShowEndSessionConfirm] = useState(false);
  const [fullCanvasImage, setFullCanvasImage] = useState(null);
  const [canvasDimensions, setCanvasDimensions] = useState(null);
  const [objectsBounds, setObjectsBounds] = useState(null);
  const menuRef = useRef(null);
  const { getFullCanvasImage } = useWhiteboard();

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

  const handleClearCanvasClick = () => {
    setIsOpen(false);
    setShowClearConfirm(true);
  };

  const handleClearCanvasConfirm = () => {
    if (socket) {
      socket.emit('whiteboard-clear', { workspaceId });
    }
    onClearCanvas();
  };

  const handleEndSessionClick = () => {
    setIsOpen(false);
    setShowEndSessionConfirm(true);
  };

  const handleEndSessionConfirm = () => {
    if (socket) {
      socket.emit('end-session', { workspaceId });
    }
    onEndSession?.();
  };

  const handleExportClick = () => {
    const full = getFullCanvasImage();

    if (full) {
      setFullCanvasImage(full.dataUrl);
      setCanvasDimensions({ width: full.width, height: full.height });
      setObjectsBounds(full.objectsBounds);
    }
    setShowExportPreview(true);
    setIsOpen(false);
  };

  const handleDownload = (imageData) => {
    if (!imageData) return;

    const link = document.createElement('a');
    link.href = imageData;
    link.download = `shareboard-export-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportPreview(false);
  };

  return (
    <>
      <ExportPreviewModal
        isOpen={showExportPreview}
        onClose={() => setShowExportPreview(false)}
        fullCanvasImage={fullCanvasImage}
        canvasDimensions={canvasDimensions}
        objectsBounds={objectsBounds}
        onDownload={handleDownload}
      />

      <ConfirmDialog
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={handleClearCanvasConfirm}
        title="Clear Whiteboard"
        message="This will remove all objects from the whiteboard. This action cannot be undone."
        confirmText="Clear"
        variant="danger"
      />

      <ConfirmDialog
        isOpen={showEndSessionConfirm}
        onClose={() => setShowEndSessionConfirm(false)}
        onConfirm={handleEndSessionConfirm}
        title="End Session"
        message="This will end the session for all participants. Everyone will be disconnected from this workspace."
        confirmText="End Session"
        variant="danger"
      />
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          className="btn-icon"
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
            className="dropdown-base dropdown-side py-2 w-48"
            role="menu"
            aria-label="More options"
          >
            <button
              type="button"
              className="w-full px-4 py-2 hover:bg-gray-100 flex items-center text-left"
              onClick={handleExportClick}
              role="menuitem"
            >
              <div className="w-6 flex justify-center items-center mr-2 text-blue-500">
                <DownloadIcon className="h-5 w-5" />
              </div>
              <span>Export as Image</span>
            </button>

            {!readOnly && (
              <button
                type="button"
                className="w-full px-4 py-2 hover:bg-gray-100 flex items-center text-left"
                onClick={handleClearCanvasClick}
                role="menuitem"
              >
                <div className="w-6 flex justify-center items-center mr-2 text-red-500">
                  <DeleteIcon className="h-5 w-5" />
                </div>
                <span>Clear Whiteboard</span>
              </button>
            )}

            {isOwner && (
              <button
                type="button"
                className="w-full px-4 py-2 hover:bg-gray-100 flex items-center text-left"
                onClick={handleEndSessionClick}
                role="menuitem"
              >
                <div className="w-6 flex justify-center items-center mr-2 text-red-500">
                  <ExitToAppIcon className="h-5 w-5" />
                </div>
                <span>End Session</span>
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
});

export default OptionsMenu;
