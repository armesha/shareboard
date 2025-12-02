import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import DeleteIcon from '@mui/icons-material/Delete';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import DownloadIcon from '@mui/icons-material/Download';
import { useWhiteboard } from '../../context/WhiteboardContext';
import { ExportPreviewModal, ConfirmDialog } from './index';
import { SOCKET_EVENTS, EXPORT } from '../../constants';

const OptionsMenu = React.memo(function OptionsMenu({
  onClearCanvas,
  onEndSession,
  isOwner = false,
  disabled = false,
  socket,
  workspaceId,
  readOnly = false
}) {
  const { t } = useTranslation(['toolbar', 'messages', 'common']);
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
      socket.emit(SOCKET_EVENTS.WHITEBOARD_CLEAR, { workspaceId });
    }
    onClearCanvas();
  };

  const handleEndSessionClick = () => {
    setIsOpen(false);
    setShowEndSessionConfirm(true);
  };

  const handleEndSessionConfirm = () => {
    if (socket) {
      socket.emit(SOCKET_EVENTS.END_SESSION, { workspaceId });
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
    link.download = `${EXPORT.FILENAME_PREFIX}-${Date.now()}.png`;
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
        title={t('messages:confirmDialog.clearWhiteboard.title')}
        message={t('messages:confirmDialog.clearWhiteboard.message')}
        confirmText={t('common:buttons.clear')}
        variant="danger"
      />

      <ConfirmDialog
        isOpen={showEndSessionConfirm}
        onClose={() => setShowEndSessionConfirm(false)}
        onConfirm={handleEndSessionConfirm}
        title={t('messages:confirmDialog.endSession.title')}
        message={t('messages:confirmDialog.endSession.message')}
        confirmText={t('options.endSession')}
        variant="danger"
      />
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          className="btn-icon"
          onClick={() => setIsOpen(!isOpen)}
          aria-label={t('common:accessibility.moreOptions')}
          aria-expanded={isOpen}
          aria-haspopup="menu"
          title={t('options.moreOptions')}
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
            aria-label={t('common:accessibility.moreOptions')}
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
              <span>{t('options.exportAsImage')}</span>
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
                <span>{t('options.clearWhiteboard')}</span>
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
                <span>{t('options.endSession')}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
});

export default OptionsMenu;
