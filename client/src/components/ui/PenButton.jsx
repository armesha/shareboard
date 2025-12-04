import React, { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import CreateIcon from '@mui/icons-material/Create';
import { BRUSH_COLORS, CANVAS } from '../../constants';
import { useDropdownBehavior } from '../../hooks';
import NumberInput from './NumberInput';

const PenButton = React.memo(function PenButton({
  isActive,
  onActivate,
  currentColor,
  onColorChange,
  width,
  onWidthChange,
  disabled = false
}) {
  const { t } = useTranslation('toolbar');
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useDropdownBehavior(menuRef, isOpen, () => setIsOpen(false));

  const handleColorSelect = useCallback((color) => {
    onActivate();
    onColorChange(color);
    setIsOpen(false);
  }, [onColorChange, onActivate]);

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
        aria-label={t('pen.ariaLabel')}
        aria-expanded={isOpen}
        title={t('tools.penTitle')}
      >
        <CreateIcon
          className={isActive ? 'text-white' : 'text-gray-600'}
          sx={{ fontSize: 22 }}
        />
        <div
          className="absolute bottom-1 right-1 w-3 h-3 rounded-full border-2 border-white shadow-sm"
          style={{ backgroundColor: currentColor }}
        />
      </button>

      {isOpen && (
        <div
          className="dropdown-base dropdown-side rounded-2xl p-3 animate-fadeIn ml-3"
          role="menu"
          aria-label={t('pen.settings')}
        >
          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-200">
            <span className="text-sm text-gray-500">{t('pen.size')}</span>
            <input
              type="range"
              min={CANVAS.MIN_BRUSH_WIDTH}
              max={CANVAS.MAX_BRUSH_WIDTH}
              value={width}
              onChange={(e) => onWidthChange(parseInt(e.target.value, 10))}
              className="flex-1"
              aria-label={`Brush width: ${width}px`}
            />
            <NumberInput
              value={width}
              onChange={onWidthChange}
              min={CANVAS.MIN_BRUSH_WIDTH}
              max={CANVAS.MAX_BRUSH_WIDTH}
              className="w-14"
              label={`Brush width: ${width}px`}
            />
            <span className="text-sm text-gray-400">px</span>
          </div>

          <div
            className="grid gap-1.5 mb-3"
            style={{
              gridTemplateColumns: 'repeat(6, 36px)',
              justifyContent: 'center'
            }}
          >
            {BRUSH_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={`w-9 h-9 rounded-lg transition-all ${
                  currentColor.toLowerCase() === color.toLowerCase()
                    ? 'ring-2 ring-blue-500 ring-offset-2 scale-110 shadow-md'
                    : color === '#FFFFFF'
                      ? 'border-2 border-gray-300 hover:border-gray-400 hover:scale-105'
                      : 'border border-gray-200 hover:scale-110 hover:shadow-md'
                }`}
                style={{ backgroundColor: color }}
                onClick={() => handleColorSelect(color)}
                title={color}
              />
            ))}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-gray-200">
            <span className="text-sm text-gray-500">{t('pen.custom')}</span>
            <input
              type="color"
              value={currentColor}
              onChange={(e) => {
                onActivate();
                onColorChange(e.target.value);
              }}
              className="w-7 h-7 cursor-pointer rounded-md border border-gray-200"
              title={t('colorPicker.customColor')}
            />
          </div>
        </div>
      )}
    </div>
  );
});

export default PenButton;
