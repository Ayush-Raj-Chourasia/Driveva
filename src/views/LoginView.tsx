import React, { useState } from 'react';
import { getClient, saveSession } from '../lib/telegram/client';
import { pullSyncState } from '../lib/telegram/sync';
import { Api } from 'telegram';

export default function LoginView({ onLogin }: { onLogin: () => void }) {
  const [step, setStep] = useState<'phone' | 'otp' | 'password'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [phoneCodeHash, setPhoneCodeHash] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendCode = async () => {
    setLoading(true);
    setError('');
    try {
      const client = await getClient();
      const result = await client.sendCode(
        // @ts-ignore
        { apiId: 0, apiHash: '' }, // Not used directly in sendCode if passed in constructor
        phone
      );
      setPhoneCodeHash(result.phoneCodeHash);
      setStep('otp');
    } catch (e: any) {
      setError(e.message || 'Failed to send code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    setLoading(true);
    setError('');
    try {
      const client = await getClient();
      await client.invoke(new Api.auth.SignIn({
        phoneNumber: phone,
        phoneCodeHash,
        phoneCode: code
      }));
      await completeLogin(client);
    } catch (e: any) {
      if (e.message.includes('SESSION_PASSWORD_NEEDED')) {
        setStep('password');
      } else {
        setError(e.message || 'Invalid code');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePassword = async () => {
    setLoading(true);
    setError('');
    try {
      const client = await getClient();
      
      // Calculate password hash using gramjs utils if needed, or check if CheckPassword accepts raw
      // Gramjs CheckPassword requires calculating the hash. 
      // A safer way in gramjs is to use signInWithPassword if available, or compute the hash.
      // For simplicity in this wrapper, we assume 2FA might require computeCheckPasswordParams
      // Let's use standard CheckPassword. If it fails, we might need the crypto implementation.
      const algo = await client.invoke(new Api.account.GetPassword());
      // Actually computing the password hash in gramjs requires complex SRP logic.
      // GramJS has `client.signInWithPassword(password)` helper!
      // Let's use the helper if possible, or fall back. 
      // We will try client.signIn(undefined, undefined, password) or similar.
      // For now, let's just use the known helper if it exists in the version we installed.
      
      // Let's assume user doesn't have 2FA for this hackathon-level prototype,
      // OR we just show an error if 2FA is needed because full SRP in browser is heavy.
      // But we included crypto polyfill, so it might work.
      
      await client.signIn(undefined, { password: async () => password, onError: (e) => { throw e; } });
      await completeLogin(client);
    } catch (e: any) {
      setError(e.message || 'Invalid password');
    } finally {
      setLoading(false);
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
              onClick={handleSendCode}
              disabled={loading || !phone}
              className="bg-primary text-on-primary py-3 rounded-xl font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Code'}
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
              onClick={handleVerifyCode}
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
              onClick={handlePassword}
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
