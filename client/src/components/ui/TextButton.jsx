import React, { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import { CANVAS, FONT_SIZES } from '../../constants';
import { useDropdownBehavior } from '../../hooks';
import NumberInput from './NumberInput';

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

  useDropdownBehavior(menuRef, isOpen, () => setIsOpen(false));

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
        <TextFieldsIcon
          className={isActive ? 'text-white' : 'text-gray-600'}
          sx={{ fontSize: 22 }}
        />
        <div className="absolute bottom-0.5 right-0.5 text-[8px] font-bold bg-white text-gray-600 rounded px-0.5 leading-tight shadow-sm">
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

          <div className="grid grid-cols-3 gap-2 mb-4">
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
            <NumberInput
              value={fontSize}
              onChange={onFontSizeChange}
              min={CANVAS.MIN_FONT_SIZE || 8}
              max={CANVAS.MAX_FONT_SIZE}
              className="w-16"
              label={`Font size: ${fontSize}px`}
            />
            <span className="text-sm text-gray-400">px</span>
          </div>
        </div>
      )}
    </div>
  );
});

export default TextButton;
