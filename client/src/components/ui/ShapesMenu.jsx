import React, { useState, useEffect, useRef } from 'react';
import CropSquareIcon from '@mui/icons-material/CropSquare';
import ChangeHistoryIcon from '@mui/icons-material/ChangeHistory';
import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined';
import { SHAPES, TOOLS } from '../../constants';

const SHAPE_ICONS = {
  [SHAPES.RECTANGLE]: CropSquareIcon,
  [SHAPES.TRIANGLE]: ChangeHistoryIcon,
  [SHAPES.CIRCLE]: CircleOutlinedIcon,
};

const ShapesMenu = React.memo(function ShapesMenu({
  selectedShape,
  onSelectShape,
  setTool,
  disabled = false
}) {
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

  if (disabled) return null;

  const CurrentIcon = selectedShape ? SHAPE_ICONS[selectedShape] : CropSquareIcon;

  const handleShapeSelect = (shape) => {
    onSelectShape(shape);
    setTool(TOOLS.SHAPES);
    setIsOpen(false);
  };

  const handleToggle = () => {
    if (isOpen) {
      setIsOpen(false);
      onSelectShape(null);
    } else {
      setIsOpen(true);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        className={`p-2 rounded-full transition-all duration-200 ${
          selectedShape ? 'bg-blue-500 hover:bg-blue-600' : 'hover:bg-gray-100'
        }`}
        onClick={handleToggle}
        aria-label="Shapes menu"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        title="Shapes"
      >
        <CurrentIcon className={selectedShape ? 'text-white' : 'text-gray-700'} />
      </button>

      {isOpen && (
        <div
          className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50"
          role="menu"
          aria-label="Shape options"
        >
          {Object.entries(SHAPES).map(([key, shape]) => {
            const Icon = SHAPE_ICONS[shape];
            return (
              <button
                key={shape}
                type="button"
                className={`w-full px-4 py-2 hover:bg-gray-100 flex items-center justify-center ${
                  selectedShape === shape ? 'bg-blue-50' : ''
                }`}
                onClick={() => handleShapeSelect(shape)}
                role="menuitem"
                aria-label={`Select ${shape}`}
              >
                <Icon className="text-gray-700" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});

export default ShapesMenu;
