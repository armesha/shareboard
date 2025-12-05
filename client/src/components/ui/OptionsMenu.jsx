import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import DeleteIcon from '@mui/icons-material/Delete';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import DownloadIcon from '@mui/icons-material/Download';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useWhiteboard } from '../../context/WhiteboardContext';
import { ExportPreviewModal, ConfirmDialog } from './index';
import { SOCKET_EVENTS, EXPORT } from '../../constants';

const HOVER_CLOSE_DELAY = 200;

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
  const [isHovered, setIsHovered] = useState(false);
  const closeTimeoutRef = useRef(null);

  const handleMouseEnter = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    closeTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
      closeTimeoutRef.current = null;
    }, HOVER_CLOSE_DELAY);
  }, []);

  // Clear timeout on component unmount to prevent memory leak
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);
  const [showExportPreview, setShowExportPreview] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showEndSessionConfirm, setShowEndSessionConfirm] = useState(false);
  const [fullCanvasImage, setFullCanvasImage] = useState(null);
  const [canvasDimensions, setCanvasDimensions] = useState(null);
  const [objectsBounds, setObjectsBounds] = useState(null);
  const { getFullCanvasImage } = useWhiteboard();

  if (disabled) return null;

  const handleClearCanvasConfirm = () => {
    if (socket) {
      socket.emit(SOCKET_EVENTS.WHITEBOARD_CLEAR, { workspaceId });
    }
    onClearCanvas();
  };

  const handleEndSessionClick = () => {
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

      <div
        className="flex flex-col items-center gap-1"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <button
          type="button"
          className="btn-icon"
          aria-label={t('options.moreOptions')}
          title={t('options.moreOptions')}
        >
          <ExpandMoreIcon sx={{ fontSize: 22 }} className="text-gray-600" />
        </button>

        <div
          className={`flex flex-col items-center gap-1 overflow-hidden transition-all duration-300 ease-out ${
            isHovered ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <button
            type="button"
            className="btn-icon"
            onClick={handleExportClick}
            aria-label={t('options.exportAsImage')}
            title={t('options.exportAsImage')}
          >
            <DownloadIcon sx={{ fontSize: 22 }} className="text-blue-500" />
          </button>

          {!readOnly && (
            <button
              type="button"
              className="btn-icon"
              onClick={() => setShowClearConfirm(true)}
              aria-label={t('options.clearWhiteboard')}
              title={t('options.clearWhiteboard')}
            >
              <DeleteIcon sx={{ fontSize: 22 }} className="text-red-500" />
            </button>
          )}

          {isOwner && (
            <button
              type="button"
              className="btn-icon"
              onClick={handleEndSessionClick}
              aria-label={t('options.endSession')}
              title={t('options.endSession')}
            >
              <ExitToAppIcon sx={{ fontSize: 22 }} className="text-red-500" />
            </button>
          )}
        </div>
      </div>
    </>
  );
});

export default OptionsMenu;
