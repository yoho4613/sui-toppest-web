'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useZkLogin } from '@/hooks/useZkLogin';

export default function AuthCallbackPage() {
  const router = useRouter();
  const { handleCallback, error: zkError } = useZkLogin();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>(
    'processing'
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function processCallback() {
      // Check if we have a hash with id_token
      if (!window.location.hash.includes('id_token')) {
        setStatus('error');
        setError('No authentication token received');
        return;
      }

      try {
        const success = await handleCallback();

        if (success) {
          setStatus('success');
          // Redirect to home after short delay
          setTimeout(() => {
            router.push('/');
          }, 1500);
        } else {
          setStatus('error');
          setError(zkError || 'Authentication failed');
        }
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Authentication failed');
      }
    }

    processCallback();
  }, [handleCallback, zkError, router]);

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="card max-w-md w-full text-center py-12">
        {status === 'processing' && (
          <>
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
            <h2 className="text-2xl font-semibold mb-2">Authenticating...</h2>
            <p className="text-gray-400">
              Please wait while we verify your credentials
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-8 h-8 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-green-400 mb-2">
              Login Successful!
            </h2>
            <p className="text-gray-400">Redirecting to app...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-8 h-8 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-red-400 mb-2">
              Login Failed
            </h2>
            <p className="text-gray-400 mb-6">{error}</p>
            <button
              onClick={() => router.push('/')}
              className="btn btn-primary"
            >
              Back to Home
            </button>
          </>
        )}
      </div>
    </main>
  );
}
