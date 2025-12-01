import React from 'react';
import { CANVAS } from '../../constants';

const WidthSlider = React.memo(function WidthSlider({
  width,
  onWidthChange,
  disabled = false,
  vertical = false
}) {
  if (disabled) return null;

  if (vertical) {
    return (
      <div className="flex flex-col items-center gap-1">
        <input
          type="range"
          min={CANVAS.MIN_BRUSH_WIDTH}
          max={CANVAS.MAX_BRUSH_WIDTH}
          value={width}
          onChange={(e) => onWidthChange(parseInt(e.target.value, 10))}
          className="h-16 w-2"
          style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
          aria-label={`Brush width: ${width}px`}
          title={`Width: ${width}px`}
        />
        <span className="text-xs text-gray-600 tabular-nums">
          {width}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2 border-r pr-3">
      <input
        type="range"
        min={CANVAS.MIN_BRUSH_WIDTH}
        max={CANVAS.MAX_BRUSH_WIDTH}
        value={width}
        onChange={(e) => onWidthChange(parseInt(e.target.value, 10))}
        className="w-16 sm:w-24"
        aria-label={`Brush width: ${width}px`}
        title={`Width: ${width}px`}
      />
      <span className="text-xs sm:text-sm text-gray-600 w-6 sm:w-8 tabular-nums">
        {width}px
      </span>
    </div>
  );
});

export default WidthSlider;
