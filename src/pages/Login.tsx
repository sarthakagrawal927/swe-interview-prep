import { Code2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useEffect, useRef, useState } from 'react';

export default function Login() {
  const { signInWithGoogle, continueAsGuest } = useAuth();
  const [debugInfo, setDebugInfo] = useState<string>('');
  const googleButtonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    setDebugInfo(clientId ? 'Client ID configured' : 'Missing VITE_GOOGLE_CLIENT_ID');
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/20">
            <Code2 className="h-8 w-8 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">DSA Prep Studio</h1>
          <p className="text-gray-400">Master data structures & algorithms with spaced repetition and AI-powered tutoring.</p>
        </div>

        <div className="space-y-3">
          <div ref={googleButtonRef} className="flex justify-center"></div>

          <button
            onClick={signInWithGoogle}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-800"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Sign in with Google
          </button>

          {import.meta.env.DEV && debugInfo && (
            <p className="text-xs text-gray-600">{debugInfo}</p>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-800" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-gray-950 px-3 text-gray-500">or</span>
            </div>
          </div>

          <button
            onClick={continueAsGuest}
            className="w-full rounded-lg border border-gray-800 px-4 py-3 text-sm text-gray-400 transition-colors hover:bg-gray-900 hover:text-gray-200"
          >
            Continue as Guest
          </button>

          <p className="text-xs text-gray-600">
            Guest data is stored locally on this device only.
          </p>
        </div>
      </div>
    </div>
  );
}
