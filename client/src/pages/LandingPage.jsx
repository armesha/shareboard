import { useState, Suspense, lazy, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../components/ui';
import { useSocket } from '../context/SocketContext';
import { getPersistentUserId } from '../utils';
import { CURSOR_ANIMALS, CURSOR_COLORS, SOCKET_EVENTS } from '../constants';
import { toast } from 'react-toastify';

const DemoWhiteboard = lazy(() => import('../components/demo/DemoWhiteboard'));

function FloatingCursor({ color, name, className, style }) {
  return (
    <div className={`floating-cursor ${className}`} style={style}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path
          d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87c.48 0 .72-.58.38-.92L6.35 2.85a.5.5 0 0 0-.85.36Z"
          fill={color}
          stroke="white"
          strokeWidth="1.5"
        />
      </svg>
      <span
        className="absolute left-5 top-4 px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap"
        style={{ backgroundColor: color, color: 'white' }}
      >
        {name}
      </span>
    </div>
  );
}


function ArrowRightIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

export default function LandingPage() {
  const { t } = useTranslation('landing');
  const { t: tCommon } = useTranslation('common');
  const { t: tMessages } = useTranslation('messages');
  const [workspaceKey, setWorkspaceKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { socket } = useSocket();

  const demoCursors = useMemo(() => [
    { animalKey: CURSOR_ANIMALS[0], color: CURSOR_COLORS[0].color, className: 'cursor-1', style: { top: '15%', left: '10%' } },
    { animalKey: CURSOR_ANIMALS[2], color: CURSOR_COLORS[1].color, className: 'cursor-2', style: { top: '25%', right: '15%' } },
    { animalKey: CURSOR_ANIMALS[5], color: CURSOR_COLORS[2].color, className: 'cursor-3', style: { bottom: '20%', left: '20%' } },
  ], []);

  const createWorkspace = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const userId = getPersistentUserId();

      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId })
      });

      if (!response.ok) {
        throw new Error('Failed to create workspace');
      }

      const data = await response.json();
      navigate(`/w/${data.workspaceId}`);
    } catch {
      setError(t('errors.createFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const joinWorkspace = useCallback((e) => {
    e.preventDefault();
    const key = workspaceKey.trim();
    if (!key) return;

    if (!socket || !socket.connected) {
      toast.error(tMessages('errors.connectionError'), {
        position: 'bottom-left',
        autoClose: 3000
      });
      return;
    }

    setIsJoining(true);

    const handleResult = ({ exists }) => {
      socket.off(SOCKET_EVENTS.WORKSPACE_EXISTS_RESULT, handleResult);
      setIsJoining(false);

      if (exists) {
        navigate(`/w/${key}`);
      } else {
        toast.error(tMessages('errors.workspaceNotFound'), {
          position: 'bottom-left',
          autoClose: 3000
        });
      }
    };

    socket.on(SOCKET_EVENTS.WORKSPACE_EXISTS_RESULT, handleResult);
    socket.emit(SOCKET_EVENTS.CHECK_WORKSPACE_EXISTS, { workspaceId: key });

    setTimeout(() => {
      socket.off(SOCKET_EVENTS.WORKSPACE_EXISTS_RESULT, handleResult);
      setIsJoining(false);
    }, 5000);
  }, [socket, workspaceKey, navigate, tMessages]);

  return (
    <>
      <Suspense fallback={null}>
        <DemoWhiteboard />
      </Suspense>

      <div className="landing-content">
        <div className="landing-lang-switcher">
          <LanguageSwitcher />
        </div>

        {demoCursors.map((cursor, index) => (
          <FloatingCursor
            key={index}
            color={cursor.color}
            name={tCommon(`animals.${cursor.animalKey}`)}
            className={cursor.className}
            style={cursor.style}
          />
        ))}

        <div className="landing-card">
          <div className="text-center mb-8">
            <h1 className="landing-title">
              {t('title')}
            </h1>
            <p className="landing-subtitle mt-3">
              {t('subtitle')}
            </p>
          </div>

          <div className="space-y-5">
            <button
              onClick={createWorkspace}
              disabled={isLoading}
              className="landing-btn-primary"
            >
              <span>
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {t('creating')}
                  </>
                ) : (
                  <>
                    {t('createWorkspace')}
                    <ArrowRightIcon />
                  </>
                )}
              </span>
            </button>

            {error && (
              <div className="landing-error">
                {error}
              </div>
            )}

            <div className="landing-divider">
              <span>{t('orJoinExisting')}</span>
            </div>

            <form onSubmit={joinWorkspace} className="space-y-4">
              <div className="landing-input-wrapper">
                <input
                  type="text"
                  required
                  className="landing-input"
                  placeholder={t('workspaceKeyPlaceholder')}
                  value={workspaceKey}
                  onChange={(e) => setWorkspaceKey(e.target.value)}
                  autoComplete="off"
                  spellCheck="false"
                />
              </div>
              <button
                type="submit"
                disabled={isJoining}
                className="landing-btn-secondary"
              >
                {isJoining ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  </span>
                ) : (
                  t('joinWorkspace')
                )}
              </button>
            </form>
          </div>

        </div>
      </div>
    </>
  );
}
