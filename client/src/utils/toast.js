import { toast as reactToast } from 'react-toastify';
import { TOAST } from '../constants';

const activeToasts = [];

function manageToastLimit() {
  if (activeToasts.length >= TOAST.MAX_TOASTS) {
    const oldestToastId = activeToasts.shift();
    reactToast.dismiss(oldestToastId);
  }
}

function createToastWithLimit(type) {
  return (message, options = {}) => {
    manageToastLimit();

    const toastId = reactToast[type](message, {
      ...options,
      onClose: () => {
        const index = activeToasts.indexOf(toastId);
        if (index > -1) {
          activeToasts.splice(index, 1);
        }
        if (options.onClose) {
          options.onClose();
        }
      }
    });

    activeToasts.push(toastId);
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
