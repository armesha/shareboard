import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { CONTROL_TIPS, ZOOM } from '../../constants';

const ZoomControls = React.memo(function ZoomControls({ zoom, onZoomChange }) {
  const { t } = useTranslation(['workspace', 'common', 'toolbar']);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const zoomPercentage = Math.round(zoom * 100);

  const handleZoomIn = () => {
    const newZoom = Math.min(zoom + ZOOM.BUTTON_INCREMENT, ZOOM.MAX);
    onZoomChange(newZoom);
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(zoom - ZOOM.BUTTON_INCREMENT, ZOOM.MIN);
    onZoomChange(newZoom);
  };

  return (
    <div className="fixed bottom-4 right-4 flex items-center gap-2 z-40">
      <div className="flex items-center bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
        <span className="px-3 py-1.5 text-sm font-medium text-gray-700 min-w-[50px] text-center border-r border-gray-200">
          {zoomPercentage}%
        </span>
        <button
          type="button"
          onClick={handleZoomOut}
          className="p-1.5 hover:bg-gray-100 transition-colors border-r border-gray-200"
          aria-label={t('common:accessibility.zoomOut')}
          title={t('common:accessibility.zoomOut')}
        >
          <RemoveIcon sx={{ fontSize: 18 }} className="text-gray-600" />
        </button>
        <button
          type="button"
          onClick={handleZoomIn}
          className="p-1.5 hover:bg-gray-100 transition-colors"
          aria-label={t('common:accessibility.zoomIn')}
          title={t('common:accessibility.zoomIn')}
        >
          <AddIcon sx={{ fontSize: 18 }} className="text-gray-600" />
        </button>
      </div>

      <div
        className="relative"
        onMouseEnter={() => setShowShortcuts(true)}
        onMouseLeave={() => setShowShortcuts(false)}
      >
        <button
          type="button"
          className="p-1.5 hover:bg-gray-100 rounded transition-colors"
          aria-label={t('common:accessibility.keyboardShortcuts')}
          aria-expanded={showShortcuts}
        >
          <HelpOutlineIcon sx={{ fontSize: 18 }} className="text-gray-600" />
        </button>

        {showShortcuts && (
          <div className="dropdown-base absolute bottom-full right-0 mb-2 rounded-xl p-3 animate-fadeIn w-max">
            <div className="space-y-2">
              {CONTROL_TIPS.map((tip) => (
                <div key={tip.key} className="flex items-center gap-3">
                  <kbd className="shrink-0 w-24 px-2 py-1 bg-gray-100 border border-gray-200 rounded text-xs font-mono text-gray-700 text-center whitespace-nowrap">
                    {t(`toolbar:controls.${tip.keyTranslationKey}`)}
                  </kbd>
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {t(`toolbar:controls.${tip.translationKey}`)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default ZoomControls;
