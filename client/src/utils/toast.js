import { toast as reactToast } from 'react-toastify';
import { TOAST } from '../constants';

const activeToasts = new Set();

function manageToastLimit(excludeId = null) {
  const toastsToCheck = excludeId
    ? [...activeToasts].filter(id => id !== excludeId)
    : [...activeToasts];

  while (toastsToCheck.length >= TOAST.MAX_TOASTS) {
    const oldestToastId = toastsToCheck.shift();
    activeToasts.delete(oldestToastId);
    reactToast.dismiss(oldestToastId);
  }
}

function createToastWithLimit(type) {
  return (message, options = {}) => {
    const customToastId = options.toastId;

    if (customToastId && activeToasts.has(customToastId)) {
      return customToastId;
    }

    manageToastLimit(customToastId);

    const toastId = reactToast[type](message, {
      ...options,
      onClose: () => {
        activeToasts.delete(toastId);
        if (options.onClose) {
          options.onClose();
        }
      }
    });

    activeToasts.add(toastId);
    return toastId;
  };
}

export const toast = {
  success: createToastWithLimit('success'),
  error: createToastWithLimit('error'),
  warning: createToastWithLimit('warning'),
  info: createToastWithLimit('info'),
  dismiss: reactToast.dismiss,
};
