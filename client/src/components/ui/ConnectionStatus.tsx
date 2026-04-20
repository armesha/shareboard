import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CONNECTION_STATUS } from '../../constants';

type ConnectionStatusType = typeof CONNECTION_STATUS[keyof typeof CONNECTION_STATUS];

interface ConnectionStatusProps {
  status?: ConnectionStatusType;
  error?: string | null;
  participantCount?: number;
}

interface StatusConfig {
  color: string;
  dotColor: string;
  text: string;
}

const ConnectionStatus = React.memo(function ConnectionStatus({
  status = CONNECTION_STATUS.CONNECTING,
  error = null,
  participantCount = 0
}: ConnectionStatusProps) {
  const { t } = useTranslation('workspace');

  const STATUS_CONFIG = useMemo((): Record<ConnectionStatusType, StatusConfig> => ({
    [CONNECTION_STATUS.CONNECTED]: {
      color: 'text-green-600',
      dotColor: 'bg-green-600',
      text: t('connection.online')
    },
    [CONNECTION_STATUS.CONNECTING]: {
      color: 'text-yellow-600',
      dotColor: 'bg-yellow-600',
      text: t('connection.connecting')
    },
    [CONNECTION_STATUS.DISCONNECTED]: {
      color: 'text-yellow-600',
      dotColor: 'bg-yellow-600',
      text: t('connection.offline')
    },
    [CONNECTION_STATUS.ERROR]: {
      color: 'text-red-600',
      dotColor: 'bg-red-600',
      text: t('connection.error')
    }
  }), [t]);

  const config = STATUS_CONFIG[status] || STATUS_CONFIG[CONNECTION_STATUS.CONNECTING];
  const showParticipants = status === CONNECTION_STATUS.CONNECTED && participantCount > 0;

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
      <span className="text-sm font-medium whitespace-nowrap">
        {config.text}
        {showParticipants && (
          <span className="text-gray-500 ml-1">
            ({t('connection.participants', { count: participantCount })})
          </span>
        )}
      </span>
    </div>
  );
});

export default ConnectionStatus;
