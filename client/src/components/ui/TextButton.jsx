import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import { CANVAS } from '../../constants';

const FONT_SIZES = [12, 16, 20, 24, 32, 48, 64];

const TextButton = React.memo(function TextButton({
  isActive,
  onActivate,
  fontSize,
  onFontSizeChange,
  disabled = false
}) {
  const { t } = useTranslation('toolbar');
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

  const handleSizeSelect = useCallback((size) => {
    onFontSizeChange(size);
  }, [onFontSizeChange]);

  const handleButtonClick = () => {
    if (isActive) {
      setIsOpen(!isOpen);
    } else {
      onActivate();
    }
  };

  if (disabled) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        className={`${isActive ? 'btn-icon-active' : 'btn-icon'} relative`}
        onClick={handleButtonClick}
        aria-label={t('tools.text')}
        aria-expanded={isOpen}
        title={t('tools.text')}
      >
        <TextFieldsIcon className={isActive ? 'text-white' : 'text-gray-700'} />
        <div className="absolute bottom-0 right-0 text-[8px] font-bold bg-white text-gray-700 rounded px-0.5 leading-tight">
          {fontSize}
        </div>
      </button>

      {isOpen && (
        <div
          className="dropdown-base dropdown-side rounded-2xl p-4 animate-fadeIn ml-3"
          role="menu"
          aria-label={t('text.settings')}
          style={{ minWidth: '160px' }}
        >
          <div className="text-sm text-gray-500 mb-3">{t('text.fontSize')}</div>

          <div className="flex flex-wrap gap-2 mb-4">
            {FONT_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  fontSize === size
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                onClick={() => handleSizeSelect(size)}
              >
                {size}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 pt-3 border-t border-gray-200">
            <span className="text-sm text-gray-500">{t('text.custom')}</span>
            <input
              type="number"
              min={CANVAS.MIN_FONT_SIZE || 8}
              max={CANVAS.MAX_FONT_SIZE || 200}
              value={fontSize}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (val >= 8 && val <= 200) {
                  onFontSizeChange(val);
                }
              }}
              className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center"
            />
            <span className="text-sm text-gray-400">px</span>
          </div>
        </div>
      )}
    </div>
  );
});

export default TextButton;
