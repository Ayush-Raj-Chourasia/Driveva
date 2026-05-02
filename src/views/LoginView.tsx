import React, { useState, useRef } from 'react';
import { getClient, saveSession } from '../lib/telegram/client';
import { pullSyncState } from '../lib/telegram/sync';

export default function LoginView({ onLogin }: { onLogin: () => void }) {
  const [step, setStep] = useState<'phone' | 'otp' | 'password'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const resolveCodeRef = useRef<(code: string) => void>(undefined);
  const resolvePasswordRef = useRef<(pass: string) => void>(undefined);

  const handleStartLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const client = await getClient();
      await client.start({
        phoneNumber: phone,
        phoneCode: async () => {
          setLoading(false);
          setStep('otp');
          return new Promise<string>((resolve) => {
            resolveCodeRef.current = resolve;
          });
        },
        password: async () => {
          setLoading(false);
          setStep('password');
          return new Promise<string>((resolve) => {
            resolvePasswordRef.current = resolve;
          });
        },
        onError: (err: Error) => {
          console.error(err);
          setError(err.message);
        },
      });
      
      await completeLogin(client);
    } catch (e: any) {
      setError(e.message || 'Failed to login');
      setLoading(false);
    }
  };

  const submitCode = () => {
    setLoading(true);
    setError('');
    if (resolveCodeRef.current) {
      resolveCodeRef.current(code);
      resolveCodeRef.current = undefined;
    }
  };

  const submitPassword = () => {
    setLoading(true);
    setError('');
    if (resolvePasswordRef.current) {
      resolvePasswordRef.current(password);
      resolvePasswordRef.current = undefined;
    }
  };

  const completeLogin = async (client: any) => {
     await saveSession(client);
     // Pull initial sync state
     await pullSyncState();
     onLogin();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-6">
      <div className="glass-panel p-8 rounded-3xl w-full max-w-md shadow-xl flex flex-col gap-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-primary mb-2">TeleDrive</h1>
          <p className="text-on-surface-variant">Sign in with Telegram</p>
        </div>

        {error && <div className="bg-error-container text-on-error-container p-3 rounded-lg text-sm">{error}</div>}

        {step === 'phone' && (
          <div className="flex flex-col gap-4">
            <input 
              type="tel" 
              placeholder="Phone Number (e.g. +1234567890)" 
              className="px-4 py-3 rounded-xl bg-surface-container border-none focus:ring-2 focus:ring-primary outline-none transition-all"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <button 
              onClick={handleStartLogin}
              disabled={loading || !phone}
              className="bg-primary text-on-primary py-3 rounded-xl font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? 'Connecting...' : 'Send Code'}
            </button>
          </div>
        )}

        {step === 'otp' && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-center text-outline">Code sent to your Telegram app.</p>
            <input 
              type="text" 
              placeholder="Login Code" 
              className="px-4 py-3 rounded-xl bg-surface-container border-none focus:ring-2 focus:ring-primary outline-none transition-all text-center tracking-widest text-lg"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <button 
              onClick={submitCode}
              disabled={loading || !code}
              className="bg-primary text-on-primary py-3 rounded-xl font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify Code'}
            </button>
          </div>
        )}

        {step === 'password' && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-center text-outline">Enter your 2FA password.</p>
            <input 
              type="password" 
              placeholder="Password" 
              className="px-4 py-3 rounded-xl bg-surface-container border-none focus:ring-2 focus:ring-primary outline-none transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button 
              onClick={submitPassword}
              disabled={loading || !password}
              className="bg-primary text-on-primary py-3 rounded-xl font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify Password'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
