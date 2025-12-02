import { useState, Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../components/ui';
import { getPersistentUserId } from '../utils';

const DemoWhiteboard = lazy(() => import('../components/demo/DemoWhiteboard'));

export default function LandingPage() {
  const { t } = useTranslation('landing');
  const [workspaceKey, setWorkspaceKey] = useState('');
  const [isLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const createWorkspace = async () => {
    try {
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
    }
  };

  const joinWorkspace = (e) => {
    e.preventDefault();
    if (workspaceKey.trim()) {
      navigate(`/w/${workspaceKey.trim()}`);
    }
  };

  return (
    <>
      <Suspense fallback={null}>
        <DemoWhiteboard />
      </Suspense>

      <div className="landing-content">
        <div className="absolute bottom-4 left-4 z-20">
          <LanguageSwitcher />
        </div>

        <div className="landing-card">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold text-gray-900">
              {t('title')}
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              {t('subtitle')}
            </p>
          </div>

          <div className="space-y-6">
            <button
              onClick={createWorkspace}
              disabled={isLoading}
              className={`w-full btn-primary ${
                isLoading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isLoading ? t('creating') : t('createWorkspace')}
            </button>

            {error && (
              <div className="text-red-600 text-sm text-center">
                {error}
              </div>
            )}

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white/90 text-gray-500">
                  {t('orJoinExisting')}
                </span>
              </div>
            </div>

            <form onSubmit={joinWorkspace} className="space-y-4">
              <input
                type="text"
                required
                className="w-full input"
                placeholder={t('workspaceKeyPlaceholder')}
                value={workspaceKey}
                onChange={(e) => setWorkspaceKey(e.target.value)}
              />
              <button
                type="submit"
                className="w-full btn-secondary"
              >
                {t('joinWorkspace')}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
