import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BRUSH_COLORS, COLOR_PICKER } from '../../constants';

const { RECENT_COLORS_KEY, MAX_RECENT_COLORS, BASIC_COLORS } = COLOR_PICKER;

const getRecentColors = () => {
  try {
    const stored = localStorage.getItem(RECENT_COLORS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed.slice(0, MAX_RECENT_COLORS);
      }
    }
  } catch (e) {}
  return [];
};

const saveRecentColor = (color, recentColors) => {
  const normalizedColor = color.toUpperCase();
  if (BASIC_COLORS.map(c => c.toUpperCase()).includes(normalizedColor)) return recentColors;

  const filtered = recentColors.filter(c => c.toUpperCase() !== normalizedColor);
  const updated = [color, ...filtered].slice(0, MAX_RECENT_COLORS);
  try {
    localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(updated));
  } catch (e) {}
  return updated;
};

const ColorPicker = React.memo(function ColorPicker({
  currentColor,
  onColorChange,
  disabled = false,
  vertical = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [recentColors, setRecentColors] = useState(getRecentColors);
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

  const handleColorSelect = useCallback((color, fromPanel = false) => {
    onColorChange(color);
    setRecentColors(prev => saveRecentColor(color, prev));
    if (fromPanel) {
      setIsOpen(false);
    }
  }, [onColorChange]);

  if (disabled) return null;

  const isCurrentInBasic = BASIC_COLORS.some(c => c.toLowerCase() === currentColor.toLowerCase());
  const isCurrentInRecent = recentColors.some(c => c.toLowerCase() === currentColor.toLowerCase());

  return (
    <div className="relative" ref={menuRef}>
      <div className={vertical ? "flex flex-col items-center gap-1" : "flex items-center gap-1 border-r pr-2"}>
        {BASIC_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className={`color-swatch ${
              currentColor.toLowerCase() === color.toLowerCase()
                ? 'color-swatch-selected'
                : 'color-swatch-hover'
            }`}
            style={{ backgroundColor: color }}
            onClick={() => handleColorSelect(color)}
            title={color}
          />
        ))}

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`color-swatch flex items-center justify-center ${
            isOpen || (!isCurrentInBasic && !isCurrentInRecent)
              ? 'color-swatch-selected'
              : 'border-gray-300 hover:border-gray-400'
          }`}
          style={{
            backgroundColor: (!isCurrentInBasic && !isCurrentInRecent) ? currentColor : 'white',
            backgroundImage: (isCurrentInBasic || isCurrentInRecent) ? 'linear-gradient(135deg, #ff6b6b 25%, #4ecdc4 25%, #4ecdc4 50%, #ffe66d 50%, #ffe66d 75%, #95e1d3 75%)' : 'none'
          }}
          aria-label="More colors"
          aria-expanded={isOpen}
          title="More colors"
        />
      </div>

      {isOpen && (
        <div
          className={`dropdown-base rounded-xl p-3 animate-fadeIn ${
            vertical ? 'dropdown-side' : 'dropdown-top'
          }`}
          role="menu"
          aria-label="Color palette"
        >
          <div className="grid grid-cols-4 gap-2 mb-3">
            {BRUSH_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={`color-swatch rounded ${
                  currentColor.toLowerCase() === color.toLowerCase()
                    ? 'color-swatch-selected'
                    : color === '#FFFFFF'
                      ? 'border-gray-300 hover:border-gray-400'
                      : 'color-swatch-hover'
                }`}
                style={{ backgroundColor: color }}
                onClick={() => handleColorSelect(color, true)}
                title={color}
              />
            ))}
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
            <span className="text-xs text-gray-500">Custom</span>
            <input
              type="color"
              value={currentColor}
              onChange={(e) => handleColorSelect(e.target.value, true)}
              className="w-6 h-6 cursor-pointer rounded border-0"
              title="Custom color"
            />
          </div>
        </div>
      )}
    </div>
  );
});

export default ColorPicker;
