import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const GUEST_KEY = 'dsa-prep-guest';
const AUTH_KEY = 'dsa-prep-auth';
const API_URL = import.meta.env.DEV ? 'http://localhost:3001' : '';

interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isGuest: boolean;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  continueAsGuest: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          prompt: () => void;
          renderButton: (parent: HTMLElement, options: any) => void;
        };
      };
    };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(() => localStorage.getItem(GUEST_KEY) === '1');
  const [loading, setLoading] = useState(true);
  const [googleLoaded, setGoogleLoaded] = useState(false);

  // Load auth from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(AUTH_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        setUser(data.user);
        setToken(data.token);
        setIsGuest(false);
      }
    } catch (error) {
      console.error('Failed to load auth from localStorage:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load Google Sign-In script
  useEffect(() => {
    if (googleLoaded) return;

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => setGoogleLoaded(true);
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, [googleLoaded]);

  const login = useCallback(async (credential: string) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });

      if (!res.ok) {
        throw new Error('Authentication failed');
      }

      const data = await res.json();
      setUser(data.user);
      setToken(data.token);
      setIsGuest(false);
      localStorage.setItem(AUTH_KEY, JSON.stringify(data));
      localStorage.removeItem(GUEST_KEY);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }, []);

  // Initialize Google One Tap when loaded
  useEffect(() => {
    if (!googleLoaded || user || isGuest) return;

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.warn('VITE_GOOGLE_CLIENT_ID not configured');
      return;
    }

    window.google?.accounts.id.initialize({
      client_id: clientId,
      callback: (response: any) => {
        if (response.credential) {
          login(response.credential);
        }
      },
    });

    // Show One Tap prompt
    window.google?.accounts.id.prompt();
  }, [googleLoaded, user, isGuest, login]);

  const signInWithGoogle = async () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId || !googleLoaded) {
      console.error('Google Sign-In not ready');
      return;
    }

    // Trigger the One Tap prompt
    window.google?.accounts.id.prompt();
  };

  const signOut = async () => {
    setUser(null);
    setToken(null);
    setIsGuest(false);
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(GUEST_KEY);
  };

  const continueAsGuest = () => {
    setIsGuest(true);
    localStorage.setItem(GUEST_KEY, '1');
  };

  return (
    <AuthContext.Provider value={{ user, token, isGuest, loading, signInWithGoogle, signOut, continueAsGuest }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

export function getAuthToken(): string | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return data.token;
    }
  } catch (error) {
    console.error('Failed to get auth token:', error);
  }
  return null;
}
