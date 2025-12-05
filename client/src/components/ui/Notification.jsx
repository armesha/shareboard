import React, { useEffect, useState, useRef } from 'react';
import { TIMING } from '../../constants';

const NOTIFICATION_STYLES = {
  success: {
    bg: 'bg-green-500',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    )
  },
  warning: {
    bg: 'bg-yellow-500',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    )
  },
  error: {
    bg: 'bg-red-500',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    )
  },
  info: {
    bg: 'bg-blue-500',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    )
  }
};

const Notification = React.memo(function Notification({
  message,
  type = 'info',
  duration = TIMING.NOTIFICATION_DURATION,
  onClose,
  visible = true
}) {
  const [isVisible, setIsVisible] = useState(visible);
  const [isAnimating, setIsAnimating] = useState(false);
  const hideTimerRef = useRef(null);
  const animationTimerRef = useRef(null);

  useEffect(() => {
    if (visible) {
      setIsVisible(true);
      setIsAnimating(true);

      hideTimerRef.current = setTimeout(() => {
        setIsAnimating(false);
        animationTimerRef.current = setTimeout(() => {
          setIsVisible(false);
          onClose?.();
        }, 300);
      }, duration);

      return () => {
        if (hideTimerRef.current) {
          clearTimeout(hideTimerRef.current);
        }
        if (animationTimerRef.current) {
          clearTimeout(animationTimerRef.current);
        }
      };
    }
  }, [visible, duration, onClose]);

  if (!isVisible || !message) return null;

  const style = NOTIFICATION_STYLES[type] || NOTIFICATION_STYLES.info;

  return (
    <div
      className={`fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ${
        isAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
      role="alert"
      aria-live="polite"
    >
      <div className={`${style.bg} text-white px-4 py-2 rounded-md shadow-lg flex items-center`}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 mr-2"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          {style.icon}
        </svg>
        {message}
      </div>
    </div>
  );
});

export default Notification;
