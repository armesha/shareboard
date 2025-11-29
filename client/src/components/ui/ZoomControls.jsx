import React, { useState, useEffect, useRef } from 'react';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { KEYBOARD_SHORTCUTS, ZOOM } from '../../constants';

const ZoomControls = React.memo(function ZoomControls({ zoom, onZoomChange }) {
  const [showShortcuts, setShowShortcuts] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowShortcuts(false);
      }
    };

    if (showShortcuts) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showShortcuts]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showShortcuts) {
        setShowShortcuts(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showShortcuts]);

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
    <div className="fixed bottom-4 right-4 flex items-center gap-2 z-40" ref={menuRef}>
      <div className="flex items-center bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
        <span className="px-3 py-1.5 text-sm font-medium text-gray-700 min-w-[50px] text-center border-r border-gray-200">
          {zoomPercentage}%
        </span>
        <button
          type="button"
          onClick={handleZoomOut}
          className="p-1.5 hover:bg-gray-100 transition-colors border-r border-gray-200"
          aria-label="Zoom out"
          title="Zoom out"
        >
          <RemoveIcon sx={{ fontSize: 18 }} className="text-gray-600" />
        </button>
        <button
          type="button"
          onClick={handleZoomIn}
          className="p-1.5 hover:bg-gray-100 transition-colors"
          aria-label="Zoom in"
          title="Zoom in"
        >
          <AddIcon sx={{ fontSize: 18 }} className="text-gray-600" />
        </button>
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setShowShortcuts(!showShortcuts)}
          className={`p-2 rounded-full bg-white shadow-lg border border-gray-200 hover:bg-gray-50 transition-colors ${
            showShortcuts ? 'ring-2 ring-blue-500' : ''
          }`}
          aria-label="Keyboard shortcuts"
          aria-expanded={showShortcuts}
          title="Keyboard shortcuts"
        >
          <HelpOutlineIcon sx={{ fontSize: 20 }} className="text-gray-600" />
        </button>

        {showShortcuts && (
          <div className="absolute bottom-full right-0 mb-2 bg-white rounded-xl shadow-lg border border-gray-200 p-3 min-w-[200px] animate-fadeIn">
            <div className="text-sm font-medium text-gray-700 mb-2 pb-2 border-b border-gray-100">
              Keyboard Shortcuts
            </div>
            <div className="space-y-1.5">
              {KEYBOARD_SHORTCUTS.map((shortcut) => (
                <div key={shortcut.key} className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">{shortcut.action}</span>
                  <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono text-gray-700">
                    {shortcut.key}
                  </kbd>
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
