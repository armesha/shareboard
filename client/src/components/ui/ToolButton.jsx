import React from 'react';

const ToolButton = React.memo(function ToolButton({
  icon: Icon,
  isActive = false,
  onClick,
  title,
  disabled = false,
  className = ''
}) {
  return (
    <button
      type="button"
      className={`p-2 rounded-full transition-all duration-200 ${
        isActive
          ? 'bg-blue-500 hover:bg-blue-600'
          : 'hover:bg-gray-100'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      onClick={disabled ? undefined : onClick}
      title={title}
      aria-label={title}
      aria-pressed={isActive}
      disabled={disabled}
    >
      <Icon className={isActive ? 'text-white' : 'text-gray-700'} />
    </button>
  );
});

export default ToolButton;
