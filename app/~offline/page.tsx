'use client';

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-6 text-center">
      <div className="text-6xl mb-6">📡</div>
      <h1 className="text-2xl font-bold text-white mb-3">You're Offline</h1>
      <p className="text-gray-400 mb-8 max-w-sm">
        Toppest requires an internet connection to play games and sync your progress.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="px-8 py-3 bg-[#4DA2FF] text-white font-semibold rounded-xl hover:bg-[#3d8fe6] transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}
