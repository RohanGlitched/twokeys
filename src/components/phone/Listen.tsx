'use client';
// Reads a result aloud with the phone's own voices (no audio leaves the device). Hidden when the
// browser has no voice for the language.
import { useEffect, useState } from 'react';
import type { Locale } from '@/i18n/locales';

export function Listen({ lang, text }: { lang: Locale; text: string }) {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const pick = () => {
      const vs = window.speechSynthesis.getVoices();
      setVoice(vs.find((v) => v.lang.toLowerCase().startsWith(lang === 'ar' ? 'ar' : 'en')) ?? null);
    };
    pick();
    window.speechSynthesis.addEventListener('voiceschanged', pick);
    return () => { window.speechSynthesis.removeEventListener('voiceschanged', pick); window.speechSynthesis.cancel(); };
  }, [lang]);
  if (!voice) return null;
  const toggle = () => {
    const s = window.speechSynthesis;
    if (speaking) { s.cancel(); setSpeaking(false); return; }
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = 0.92;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    s.cancel();
    s.speak(u);
    setSpeaking(true);
  };
  return (
    <button onClick={toggle} aria-pressed={speaking} className="inline-flex items-center gap-1.5 rounded-[2px] border border-rule px-2.5 py-1.5 text-[13px] hover:border-ink">
      <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden><path d="M2 6h3l4-3v10L5 10H2z" fill="currentColor" />{!speaking && <path d="M11 5.5a3.5 3.5 0 0 1 0 5M12.5 3.5a6 6 0 0 1 0 9" stroke="currentColor" fill="none" strokeWidth="1.4" />}</svg>
      {speaking ? (lang === 'ar' ? 'إيقاف' : 'Stop') : (lang === 'ar' ? 'استمع' : 'Listen')}
    </button>
  );
}
