'use client';
// Reads a result aloud with the phone's own voices (no audio leaves the device). When the browser has
// no voice for the language, the control stays, greyed, and a tap says why.
import { useEffect, useState } from 'react';
import type { Locale } from '@/i18n/locales';

export function Listen({ lang, text }: { lang: Locale; text: string }) {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [known, setKnown] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [why, setWhy] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('speechSynthesis' in window)) { setKnown(true); return; } // eslint-disable-line react-hooks/set-state-in-effect -- browser capability, read once
    const pick = () => {
      const vs = window.speechSynthesis.getVoices();
      setVoice(vs.find((v) => v.lang.toLowerCase().startsWith(lang === 'ar' ? 'ar' : 'en')) ?? null);
      if (vs.length) setKnown(true);
    };
    pick();
    // Some browsers fill the voice list late, and some never fire voiceschanged: decide after a moment.
    const settle = setTimeout(() => setKnown(true), 1500);
    window.speechSynthesis.addEventListener('voiceschanged', pick);
    return () => { clearTimeout(settle); window.speechSynthesis.removeEventListener('voiceschanged', pick); window.speechSynthesis.cancel(); };
  }, [lang]);
  if (!known && !voice) return null;
  const icon = (on: boolean) => <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden><path d="M2 6h3l4-3v10L5 10H2z" fill="currentColor" />{on && <path d="M11 5.5a3.5 3.5 0 0 1 0 5M12.5 3.5a6 6 0 0 1 0 9" stroke="currentColor" fill="none" strokeWidth="1.4" />}</svg>;
  if (!voice) {
    return (
      <span className="relative inline-flex">
        <button onClick={() => setWhy((x) => !x)} aria-disabled="true" aria-expanded={why} className="inline-flex min-h-9 items-center gap-1.5 rounded-[2px] border border-rule px-2.5 text-[13px] text-ink-3">
          {icon(false)}{lang === 'ar' ? 'استمع' : 'Listen'}
        </button>
        {why && (
          <span role="status" className="absolute end-0 top-full z-10 mt-1 w-56 rounded-[3px] border border-ink bg-paper px-3 py-2 text-[12.5px] leading-snug text-ink">
            {lang === 'ar' ? 'لا يوجد صوت عربي على هذا الجهاز. يمكن إضافته من إعدادات الهاتف أو المتصفح.' : 'This device has no English voice. You can add one in your phone or browser settings.'}
          </span>
        )}
      </span>
    );
  }
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
    <button onClick={toggle} aria-pressed={speaking} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-[2px] border border-rule px-2.5 text-[13px] hover:border-ink">
      {icon(!speaking)}
      {speaking ? (lang === 'ar' ? 'إيقاف' : 'Stop') : (lang === 'ar' ? 'استمع' : 'Listen')}
    </button>
  );
}
