'use client';

import { useState, useCallback } from 'react';
import { useSoundSettings } from '@/hooks/useSoundSettings';

// Volume slider component
function VolumeSlider({
  label,
  value,
  onChange,
  isMuted,
  onToggleMute,
  icon,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onToggleMute}
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
          isMuted ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white'
        }`}
      >
        {icon}
      </button>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-400">{label}</span>
          <span className="text-xs text-gray-500">{Math.round(value * 100)}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={value * 100}
          onChange={(e) => onChange(Number(e.target.value) / 100)}
          disabled={isMuted}
          className={`w-full h-1.5 rounded-full appearance-none cursor-pointer ${
            isMuted ? 'bg-gray-700' : 'bg-white/20'
          } [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#4DA2FF] [&::-webkit-slider-thumb]:cursor-pointer`}
        />
      </div>
    </div>
  );
}

// Sound icon
function SoundIcon({ muted }: { muted: boolean }) {
  if (muted) {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
      </svg>
    );
  }
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
    </svg>
  );
}

// Music icon
function MusicIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
    </svg>
  );
}

// SFX icon
function SfxIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

// Main sound control button with dropdown
export function SoundControl() {
  const [isOpen, setIsOpen] = useState(false);

  const {
    masterVolume,
    musicVolume,
    sfxVolume,
    isMuted,
    setMasterVolume,
    setMusicVolume,
    setSfxVolume,
    toggleMute,
    toggleMusicMute,
    toggleSfxMute,
    isMusicMuted,
    isSfxMuted,
  } = useSoundSettings();

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <div className="relative">
      {/* Toggle Button */}
      <button
        onClick={handleToggle}
        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
          isMuted
            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
            : 'bg-white/10 text-white border border-white/10 hover:bg-white/20'
        }`}
      >
        <SoundIcon muted={isMuted} />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={handleClose}
          />

          {/* Panel */}
          <div className="absolute right-0 top-12 z-50 w-64 bg-[#1A1F26] border border-white/10 rounded-xl p-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-sm">Sound Settings</h3>
              <button
                onClick={toggleMute}
                className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                  isMuted
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-green-500/20 text-green-400'
                }`}
              >
                {isMuted ? 'MUTED' : 'ON'}
              </button>
            </div>

            <div className="space-y-4">
              {/* Master Volume */}
              <VolumeSlider
                label="Master"
                value={masterVolume}
                onChange={setMasterVolume}
                isMuted={isMuted}
                onToggleMute={toggleMute}
                icon={<SoundIcon muted={isMuted} />}
              />

              {/* Music Volume */}
              <VolumeSlider
                label="Music"
                value={musicVolume}
                onChange={setMusicVolume}
                isMuted={isMuted || isMusicMuted}
                onToggleMute={toggleMusicMute}
                icon={<MusicIcon />}
              />

              {/* SFX Volume */}
              <VolumeSlider
                label="Effects"
                value={sfxVolume}
                onChange={setSfxVolume}
                isMuted={isMuted || isSfxMuted}
                onToggleMute={toggleSfxMute}
                icon={<SfxIcon />}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
