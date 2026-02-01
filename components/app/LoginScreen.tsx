'use client';

import { ConnectButton } from '@mysten/dapp-kit';
import { useZkLogin } from '@/hooks/useZkLogin';

export function LoginScreen() {
  const { login: zkLogin, isLoading: zkLoading } = useZkLogin();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      {/* Logo & Title */}
      <div className="text-center mb-10">
        <div className="relative inline-block mb-4">
          {/* Glow effect */}
          <div className="absolute inset-0 bg-[#4DA2FF]/30 blur-[40px] rounded-full scale-150" />
          <h1 className="font-title text-4xl font-black tracking-wider bg-gradient-to-r from-[#4DA2FF] to-purple-500 bg-clip-text text-transparent relative">
            TOPPEST
          </h1>
        </div>
        <p className="text-white/60 text-sm">
          Rise to the Top on SUI
        </p>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-sm bg-[#1A1F26] border border-white/10 rounded-2xl p-6">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-[#4DA2FF]/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#4DA2FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white">Connect to Play</h2>
          <p className="text-white/50 text-sm mt-1">
            Choose how you want to connect
          </p>
        </div>

        {/* Google Login - Primary Option */}
        <button
          onClick={zkLogin}
          disabled={zkLoading}
          className="w-full flex items-center justify-center gap-3 p-4 bg-white text-gray-800 rounded-xl font-medium hover:bg-gray-100 transition-colors disabled:opacity-50 mb-4"
        >
          {zkLoading ? (
            <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          Continue with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-white/30 text-xs">or use wallet</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Wallet Connect */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-1">
          <ConnectButton className="w-full" />
        </div>

        {/* Info */}
        <p className="text-white/30 text-xs text-center mt-6">
          By connecting, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>

      {/* Features hint */}
      <div className="mt-8 flex items-center gap-6 text-white/40 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎮</span>
          <span>12+ Games</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg">🏆</span>
          <span>Weekly Prizes</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg">💎</span>
          <span>Earn SUI</span>
        </div>
      </div>
    </div>
  );
}
