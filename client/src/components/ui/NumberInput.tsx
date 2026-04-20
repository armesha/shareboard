import React, { ChangeEvent, FocusEvent } from 'react';

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  className?: string;
  label?: string;
}

const NumberInput = React.memo(function NumberInput({
  value,
  onChange,
  min = 1,
  max = 100,
  className = 'w-16',
  label
}: NumberInputProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val)) {
      if (val > max) {
        onChange(max);
      } else {
        onChange(val);
      }
    }
  };

  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
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
