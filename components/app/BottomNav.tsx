'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  isCenter?: boolean;
}

const navItems: NavItem[] = [
  {
    href: '/play',
    label: 'Play',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    href: '/play/quests',
    label: 'Quests',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    href: '/play/shop',
    label: 'Shop',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
    isCenter: true,
  },
  {
    href: '/play/ranking',
    label: 'Ranks',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    href: '/play/profile',
    label: 'Profile',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
];

export function BottomNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/play') {
      return pathname === '/play';
    }
    return pathname.startsWith(href);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 flex justify-center pb-6 px-4 z-50 pointer-events-none safe-bottom">
      {/* Background gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0F1419] via-[#0F1419]/80 to-transparent pointer-events-none" />

      {/* Navigation bar */}
      <nav className="relative w-full max-w-[380px] h-16 bg-[#1A1F26]/90 backdrop-blur-xl border border-white/10 rounded-full flex items-center justify-between px-2 shadow-2xl pointer-events-auto">
        {/* Left items */}
        <div className="flex items-center justify-evenly flex-1 pr-6">
          {navItems.slice(0, 2).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 w-14 py-2 rounded-xl transition-all ${
                isActive(item.href)
                  ? 'text-[#4DA2FF]'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {item.icon}
              <span className="text-[10px] font-semibold">{item.label}</span>
            </Link>
          ))}
        </div>

        {/* Center elevated button */}
        <div className="absolute left-1/2 -translate-x-1/2 -top-4">
          <Link
            href={navItems[2].href}
            className={`w-16 h-16 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(77,163,255,0.4)] border-4 border-[#0F1419] transform hover:scale-105 transition-transform active:scale-95 ${
              isActive(navItems[2].href)
                ? 'bg-[#4DA2FF]'
                : 'bg-gradient-to-br from-[#4DA2FF] to-[#2D7DD2]'
            }`}
          >
            <span className="text-white">{navItems[2].icon}</span>
          </Link>
        </div>

        {/* Right items */}
        <div className="flex items-center justify-evenly flex-1 pl-6">
          {navItems.slice(3).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 w-14 py-2 rounded-xl transition-all ${
                isActive(item.href)
                  ? 'text-[#4DA2FF]'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {item.icon}
              <span className="text-[10px] font-semibold">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
