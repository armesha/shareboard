import React, { useState } from 'react';
import { BRUSH_COLORS } from '../../constants';

const VISIBLE_COLORS = 4;

const ColorPicker = React.memo(function ColorPicker({
  currentColor,
  onColorChange,
  disabled = false
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (disabled) return null;

  const visibleColors = isExpanded ? BRUSH_COLORS : BRUSH_COLORS.slice(0, VISIBLE_COLORS);
  const hasMoreColors = BRUSH_COLORS.length > VISIBLE_COLORS;

  return (
    <div className="flex items-center space-x-1 border-r pr-3">
      <div
        className="flex gap-1"
        role="radiogroup"
        aria-label="Color selection"
      >
        {visibleColors.map((color) => (
          <button
            key={color}
            type="button"
            className={`w-6 h-6 sm:w-7 sm:h-7 rounded-md border transition-all flex-shrink-0 ${
              currentColor === color
                ? 'ring-2 ring-blue-500 ring-offset-1'
                : color === '#FFFFFF'
                  ? 'border-gray-300 hover:border-gray-400'
                  : 'border-transparent hover:scale-110'
            }`}
            style={{ backgroundColor: color }}
            onClick={() => onColorChange(color)}
            aria-label={`Select color ${color}`}
            aria-pressed={currentColor === color}
            title={color}
          />
        ))}
      </div>

      {hasMoreColors && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-6 h-6 sm:w-7 sm:h-7 rounded-md border border-gray-300 hover:bg-gray-100 transition-all flex items-center justify-center flex-shrink-0"
          aria-label={isExpanded ? 'Show less colors' : 'Show more colors'}
          title={isExpanded ? 'Less colors' : 'More colors'}
        >
          <svg
            className={`w-3 h-3 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      <input
        type="color"
        value={currentColor}
        onChange={(e) => onColorChange(e.target.value)}
        className="w-6 h-6 sm:w-7 sm:h-7 cursor-pointer rounded border-0 flex-shrink-0"
        aria-label="Custom color picker"
        title="Custom color"
      />
    </div>
  );
});

export default ColorPicker;
