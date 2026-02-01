'use client';

import { useRouter } from 'next/navigation';

export default function LandingPage() {
  const router = useRouter();

  const handlePlayClick = () => {
    router.push('/play');
  };

  return (
    <div className="min-h-screen bg-[#0F1419] text-white overflow-hidden">
      {/* Background Gradient Mesh */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-[#4DA2FF]/10 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[120px] translate-x-1/2 translate-y-1/2" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="font-title text-xl bg-gradient-to-r from-[#4DA2FF] to-purple-500 bg-clip-text text-transparent">
            TOPPEST
          </span>
        </div>
        <button
          onClick={handlePlayClick}
          className="px-4 py-2 bg-[#4DA2FF] text-white rounded-full text-sm font-medium hover:bg-[#4DA2FF]/80 transition-colors"
        >
          Play Now
        </button>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 flex flex-col items-center justify-center min-h-[80vh] px-6 text-center">
        {/* Glow behind logo */}
        <div className="absolute w-[300px] h-[300px] bg-[#4DA2FF]/20 rounded-full blur-[100px]" />

        <h1 className="font-title text-5xl md:text-7xl font-black tracking-wider bg-gradient-to-r from-[#4DA2FF] to-purple-500 bg-clip-text text-transparent mb-4 relative">
          TOPPEST
        </h1>
        <p className="text-white/60 text-lg md:text-xl mb-2">
          Rise to the Top on SUI
        </p>
        <p className="text-white/40 text-sm max-w-md mb-8">
          Play mini-games, compete on leaderboards, and earn real SUI rewards
        </p>

        <button
          onClick={handlePlayClick}
          className="px-8 py-4 bg-gradient-to-r from-[#4DA2FF] to-blue-400 rounded-full font-bold text-lg shadow-[0_0_30px_rgba(77,163,255,0.4)] hover:shadow-[0_0_40px_rgba(77,163,255,0.6)] transition-all hover:-translate-y-1"
        >
          Play Now
        </button>

        {/* Stats */}
        <div className="flex gap-8 mt-12">
          <div className="text-center">
            <p className="text-2xl font-bold text-white">12+</p>
            <p className="text-white/40 text-sm">Mini Games</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-[#4DA2FF]">5,000</p>
            <p className="text-white/40 text-sm">SUI Weekly Prizes</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-400">1,000+</p>
            <p className="text-white/40 text-sm">Players</p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative z-10 py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="p-6 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm">
              <div className="w-12 h-12 bg-[#4DA2FF]/20 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-[#4DA2FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="font-bold text-lg mb-2">1. Connect</h3>
              <p className="text-white/50 text-sm">
                Connect your SUI wallet or sign in with Google. No wallet? We&apos;ll create one for you.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm">
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-bold text-lg mb-2">2. Play</h3>
              <p className="text-white/50 text-sm">
                Choose from 12+ mini-games. Compete for high scores and climb the leaderboards.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm">
              <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-bold text-lg mb-2">3. Earn</h3>
              <p className="text-white/50 text-sm">
                Win SUI tokens and $LUCK rewards. Top players share weekly prize pools.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Games Preview Section */}
      <section className="relative z-10 py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-4">
            Featured Games
          </h2>
          <p className="text-white/50 text-center mb-12">
            Compete in skill-based mini-games and earn rewards
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {['Space Shooter', 'Crypto Slots', 'Puzzle Rush', 'Speed Runner'].map((game, i) => (
              <div
                key={game}
                onClick={handlePlayClick}
                className="aspect-square bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-2xl flex flex-col items-center justify-center p-4 hover:border-[#4DA2FF]/50 transition-colors cursor-pointer"
              >
                <div className="w-16 h-16 bg-white/10 rounded-xl mb-3 flex items-center justify-center">
                  <span className="text-2xl">{['🚀', '🎰', '🧩', '🏃'][i]}</span>
                </div>
                <p className="font-medium text-sm text-center">{game}</p>
                <p className="text-[#4DA2FF] text-xs mt-1">+50 SUI</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Rise to the Top?
          </h2>
          <p className="text-white/50 mb-8">
            Join thousands of players earning SUI rewards every day
          </p>
          <button
            onClick={handlePlayClick}
            className="px-8 py-4 bg-gradient-to-r from-[#4DA2FF] to-blue-400 rounded-full font-bold text-lg shadow-[0_0_30px_rgba(77,163,255,0.4)] hover:shadow-[0_0_40px_rgba(77,163,255,0.6)] transition-all hover:-translate-y-1"
          >
            Start Playing Now
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-8 px-6 border-t border-white/10">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-title text-lg bg-gradient-to-r from-[#4DA2FF] to-purple-500 bg-clip-text text-transparent">
              TOPPEST
            </span>
            <span className="text-white/30 text-sm">|</span>
            <span className="text-white/30 text-sm">Powered by SUI Network</span>
          </div>
          <div className="flex items-center gap-6 text-white/40 text-sm">
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Discord</a>
            <a href="#" className="hover:text-white transition-colors">Twitter</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
