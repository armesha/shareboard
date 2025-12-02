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
      className={`${
        isActive ? 'btn-icon-active' : 'btn-icon'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      onClick={disabled ? undefined : onClick}
      title={title}
      aria-label={title}
      aria-pressed={isActive}
      disabled={disabled}
    >
      <Icon
        className={isActive ? 'text-white' : 'text-gray-600'}
        sx={{ fontSize: 22 }}
      />
    </button>
  );
});

export default ToolButton;
