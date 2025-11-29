import React from 'react';
import { CONNECTION_STATUS } from '../../constants';

const STATUS_CONFIG = {
  [CONNECTION_STATUS.CONNECTED]: {
    color: 'text-green-600',
    dotColor: 'bg-green-600',
    text: 'Online'
  },
  [CONNECTION_STATUS.CONNECTING]: {
    color: 'text-yellow-600',
    dotColor: 'bg-yellow-600',
    text: 'Connecting...'
  },
  [CONNECTION_STATUS.DISCONNECTED]: {
    color: 'text-yellow-600',
    dotColor: 'bg-yellow-600',
    text: 'Offline - Reconnecting...'
  },
  [CONNECTION_STATUS.ERROR]: {
    color: 'text-red-600',
    dotColor: 'bg-red-600',
    text: 'Connection Error'
  }
};

const ConnectionStatus = React.memo(function ConnectionStatus({
  status = CONNECTION_STATUS.CONNECTING,
  error = null
}) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG[CONNECTION_STATUS.CONNECTING];

  return (
    <div
      className={`flex items-center gap-2 ${config.color}`}
      title={error || ''}
      role="status"
      aria-live="polite"
    >
      <div
        className={`w-2 h-2 rounded-full ${config.dotColor}`}
        aria-hidden="true"
      />
      <span className="text-sm font-medium">
        {config.text}
      </span>
    </div>
  );
});

export default ConnectionStatus;
