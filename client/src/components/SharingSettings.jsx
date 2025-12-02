import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSharing } from '../context/SharingContext';
import { useSocket } from '../context/SocketContext';
import { SOCKET_EVENTS, SHARING_MODES, STORAGE_KEYS, TIMING } from '../constants';

export default function SharingSettings({ workspaceId, onClose }) {
  const { t } = useTranslation(['sharing', 'common']);
  const { socket } = useSocket();
  const {
    sharingMode,
    isOwner,
    changeMode
  } = useSharing();
  const [editLink, setEditLink] = useState('');
  const [copySuccess, setCopySuccess] = useState('');

  useEffect(() => {
    if (!socket || !workspaceId) return;

    const persistentUserId = localStorage.getItem(STORAGE_KEYS.USER_ID);
    if (persistentUserId) {
      socket.emit(SOCKET_EVENTS.GET_SHARING_INFO, {
        workspaceId,
        userId: persistentUserId
      });
    }

    const handleActiveUsersUpdate = () => {
    };

    socket.on(SOCKET_EVENTS.ACTIVE_USERS_UPDATE, handleActiveUsersUpdate);
    socket.emit(SOCKET_EVENTS.GET_ACTIVE_USERS, { workspaceId });

    if (isOwner) {
      socket.emit(SOCKET_EVENTS.GET_EDIT_TOKEN, { workspaceId }, (response) => {
        if (response && response.editToken) {
          const baseUrl = window.location.origin;
          const path = `/w/${workspaceId}`;
          setEditLink(`${baseUrl}${path}?access=${response.editToken}`);
        } else {
          const baseUrl = window.location.origin;
          const path = `/w/${workspaceId}`;
          const editToken = `edit_${Math.random().toString(36).substring(2, 10)}`;
          setEditLink(`${baseUrl}${path}?access=${editToken}`);

          if (sharingMode === SHARING_MODES.READ_WRITE_SELECTED) {
            socket.emit(SOCKET_EVENTS.SET_EDIT_TOKEN, { workspaceId, editToken });
          }
        }
      });
    }

    return () => {
      socket.off(SOCKET_EVENTS.ACTIVE_USERS_UPDATE, handleActiveUsersUpdate);
    };
  }, [socket, workspaceId, sharingMode, isOwner]);

  const copyToClipboard = (text, isEditLink = false) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
    if (isEditLink) {
      setCopySuccess('edit');
    } else {
      setCopySuccess('view');
    }
    setTimeout(() => setCopySuccess(''), TIMING.COPY_SUCCESS_DURATION);
  };

  if (!isOwner) {
    const getModeLabel = (mode) => {
      if (mode === SHARING_MODES.READ_ONLY) return t('nonOwnerModes.readOnly.label');
      if (mode === SHARING_MODES.READ_WRITE_ALL) return t('nonOwnerModes.readWriteAll.label');
      if (mode === SHARING_MODES.READ_WRITE_SELECTED) return t('nonOwnerModes.readWriteSelected.label');
      return mode;
    };

    const getModeDescription = (mode) => {
      if (mode === SHARING_MODES.READ_ONLY) return t('nonOwnerModes.readOnly.description');
      if (mode === SHARING_MODES.READ_WRITE_ALL) return t('nonOwnerModes.readWriteAll.description');
      if (mode === SHARING_MODES.READ_WRITE_SELECTED) return t('nonOwnerModes.readWriteSelected.description');
      return '';
    };

    return (
      <div className="p-6 bg-white rounded-lg shadow-lg max-w-lg w-full">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">{t('title')}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">{t('currentMode')}</h3>
          <p className="text-base font-medium text-gray-900">{getModeLabel(sharingMode)}</p>
          <p className="text-sm text-gray-600 mt-1">{getModeDescription(sharingMode)}</p>
        </div>

        <p className="text-gray-600 text-sm">
          {t('onlyOwnerCanChange')}
        </p>

        <div className="mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            {t('common:buttons.close')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg max-w-lg w-full">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">{t('title')}</h2>
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
        <h3 className="text-sm font-semibold text-gray-900 mb-3">{t('sharingMode')}</h3>
        <div className="space-y-2">
          <label className="form-radio-item">
            <input
              type="radio"
              name="sharingMode"
              value={SHARING_MODES.READ_ONLY}
              checked={sharingMode === SHARING_MODES.READ_ONLY}
              onChange={(e) => changeMode(e.target.value)}
              className="mt-1 mr-3"
            />
            <div className="flex-1">
              <div className="font-medium text-gray-900">{t('modes.readOnly.label')}</div>
              <div className="text-sm text-gray-600">{t('modes.readOnly.description')}</div>
            </div>
          </label>

          <label className="form-radio-item">
            <input
              type="radio"
              name="sharingMode"
              value={SHARING_MODES.READ_WRITE_ALL}
              checked={sharingMode === SHARING_MODES.READ_WRITE_ALL}
              onChange={(e) => changeMode(e.target.value)}
              className="mt-1 mr-3"
            />
            <div className="flex-1">
              <div className="font-medium text-gray-900">{t('modes.readWriteAll.label')}</div>
              <div className="text-sm text-gray-600">{t('modes.readWriteAll.description')}</div>
            </div>
          </label>

          <label className="form-radio-item">
            <input
              type="radio"
              name="sharingMode"
              value={SHARING_MODES.READ_WRITE_SELECTED}
              checked={sharingMode === SHARING_MODES.READ_WRITE_SELECTED}
              onChange={(e) => changeMode(e.target.value)}
              className="mt-1 mr-3"
            />
            <div className="flex-1">
              <div className="font-medium text-gray-900">{t('modes.readWriteSelected.label')}</div>
              <div className="text-sm text-gray-600">{t('modes.readWriteSelected.description')}</div>
            </div>
          </label>
        </div>
      </div>

      <div className="mb-6 space-y-3">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex justify-between items-start mb-2">
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-blue-900 mb-1">{t('links.viewLink.title')}</h3>
              <p className="text-xs text-blue-700">{t('links.viewLink.description')}</p>
              <p className="text-xs text-gray-600 mt-1 break-all font-mono">{window.location.href.split('?')[0]}</p>
            </div>
            <button
              onClick={() => copyToClipboard(window.location.href.split('?')[0])}
              className="ml-3 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 whitespace-nowrap"
            >
              {copySuccess === 'view' ? t('common:buttons.copied') : t('common:buttons.copy')}
            </button>
          </div>
        </div>

        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex justify-between items-start mb-2">
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-green-900 mb-1">{t('links.editLink.title')}</h3>
              <p className="text-xs text-green-700">{t('links.editLink.description')}</p>
              {editLink && (
                <p className="text-xs text-gray-600 mt-1 break-all font-mono">{editLink}</p>
              )}
            </div>
            <button
              onClick={() => copyToClipboard(editLink, true)}
              className="ml-3 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 whitespace-nowrap"
              disabled={!editLink}
            >
              {copySuccess === 'edit' ? t('common:buttons.copied') : t('common:buttons.copy')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 