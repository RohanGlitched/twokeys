'use client';
// Reads a result aloud with a voice on the device where there is one (voice.localService), so the text
// stays on the phone. Some browsers (desktop Chrome among them) list network voices first; those send the
// text to the browser's speech service, so when only such a voice exists for the language, the first tap
// says so and plays only after the person agrees. When the browser has no voice for the language at all,
// the control stays, greyed, and a tap says why.
import { useEffect, useState } from 'react';
import type { Locale } from '@/i18n/locales';

export function Listen({ lang, text }: { lang: Locale; text: string }) {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [known, setKnown] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [why, setWhy] = useState(false);
  // An online voice: the notice is showing, or the person already agreed for this control.
  const [asking, setAsking] = useState(false);
  const [agreed, setAgreed] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('speechSynthesis' in window)) { setKnown(true); return; } // eslint-disable-line react-hooks/set-state-in-effect -- browser capability, read once
    const pick = () => {
      const vs = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith(lang === 'ar' ? 'ar' : 'en'));
      setVoice(vs.find((v) => v.localService) ?? vs[0] ?? null);
      if (window.speechSynthesis.getVoices().length) setKnown(true);
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
          {icon(false)}{lang === 'ar' ? 'استماع' : 'Listen'}
        </button>
        {why && (
          <span role="status" className="absolute end-0 top-full z-10 mt-1 w-56 rounded-[3px] border border-ink bg-paper px-3 py-2 text-[12.5px] leading-snug text-ink">
            {lang === 'ar' ? 'لا يوجد صوت عربي على هذا الجهاز. يمكن إضافته من إعدادات الهاتف أو المتصفح.' : 'This device has no English voice. You can add one in your phone or browser settings.'}
          </span>
        )}
      </span>
    );
  }
  const play = () => {
    const s = window.speechSynthesis;
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
  const toggle = () => {
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    // Nothing leaves the device without the person knowing: an online voice asks first.
    if (!voice.localService && !agreed) { setAsking((x) => !x); return; }
    play();
  };
  return (
    <span className="relative inline-flex shrink-0">
      <button onClick={toggle} aria-pressed={speaking} aria-expanded={!voice.localService ? asking : undefined} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-[2px] border border-rule px-2.5 text-[13px] hover:border-ink">
        {icon(!speaking)}
        {speaking ? (lang === 'ar' ? 'إيقاف' : 'Stop') : (lang === 'ar' ? 'استماع' : 'Listen')}
      </button>
      {asking && (
        <span role="status" className="absolute end-0 top-full z-10 mt-1 w-60 rounded-[3px] border border-ink bg-paper px-3 py-2 text-[12.5px] leading-snug text-ink">
          {lang === 'ar' ? 'يستخدم صوتاً عبر الإنترنت: يُرسَل النص إلى خدمة النطق في متصفحك.' : 'Uses an online voice: the text is sent to your browser’s speech service.'}
          <span className="mt-2 flex gap-2">
            <button onClick={() => { setAgreed(true); setAsking(false); play(); }} className="min-h-9 rounded-[2px] bg-ink px-3 text-[13px] font-medium text-wool">{lang === 'ar' ? 'تشغيل' : 'Play'}</button>
            <button onClick={() => setAsking(false)} className="min-h-9 rounded-[2px] border border-ink-3 px-3 text-[13px]">{lang === 'ar' ? 'إلغاء' : 'Cancel'}</button>
          </span>
        </span>
      )}
    </span>
  );
}
