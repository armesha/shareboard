import React from 'react';

const NumberInput = React.memo(function NumberInput({
  value,
  onChange,
  min = 1,
  max = 100,
  className = 'w-16',
  label
}) {
  const handleChange = (e) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val)) {
      if (val > max) {
        onChange(max);
      } else {
        onChange(val);
      }
    }
  };

  const handleBlur = (e) => {
    const val = parseInt(e.target.value, 10);
    if (isNaN(val) || val < min) {
      onChange(min);
    } else if (val > max) {
      onChange(max);
    }
  };

  return (
    <input
      type="number"
      min={min}
      max={max}
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      className={`${className} px-2 py-1 border border-gray-300 rounded text-sm text-center`}
      aria-label={label}
    />
  );
});

export default NumberInput;
