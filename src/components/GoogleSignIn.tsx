'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import './google-signin.css';
type GoogleApi = { accounts: { id: { initialize(options: { client_id: string; callback: (result: { credential: string }) => void; auto_select?: boolean }): void; renderButton(element: HTMLElement, options: Record<string, unknown>): void } } };
declare global { interface Window { google?: GoogleApi } }
const copy = {
  English: { missing: 'Google sign-in is being set up. Please check back soon.', heading: 'Continue with Google', busy: 'Signing in with Google…', failure: 'Google sign-in could not be completed. Please try again.', button: 'continue_with' },
  हिन्दी: { missing: 'Google साइन-इन सेट किया जा रहा है। कृपया थोड़ी देर बाद फिर देखें।', heading: 'Google के साथ जारी रखें', busy: 'Google से साइन इन हो रहा है…', failure: 'Google साइन-इन पूरा नहीं हो सका। फिर कोशिश करें।', button: 'continue_with' },
  ಕನ್ನಡ: { missing: 'Google ಸೈನ್-ಇನ್ ಸಿದ್ಧಪಡಿಸಲಾಗುತ್ತಿದೆ. ದಯವಿಟ್ಟು ಸ್ವಲ್ಪ ಸಮಯದ ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.', heading: 'Google ಮೂಲಕ ಮುಂದುವರಿಸಿ', busy: 'Google ಮೂಲಕ ಸೈನ್ ಇನ್ ಆಗುತ್ತಿದೆ…', failure: 'Google ಸೈನ್-ಇನ್ ಪೂರ್ಣಗೊಳಿಸಲಾಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.', button: 'continue_with' },
} as const;
type Language = keyof typeof copy;
export default function GoogleSignIn({ clientId, returnTo, purpose = 'sign-in' }: { clientId?: string; returnTo: string; purpose?: 'sign-in' | 'contribute' }) {
  const slot = useRef<HTMLDivElement>(null), callback = useRef<(credential: string) => void>(() => {});
  const [language, setLanguage] = useState<Language>('English'), [working, setWorking] = useState(false), [error, setError] = useState('');
  useEffect(() => { const saved = localStorage.getItem('archive-language'); if (saved && saved in copy) setLanguage(saved as Language); }, []);
  const finish = useCallback(async (credential: string) => {
    setWorking(true); setError('');
    try {
      const response = await fetch('/api/auth/google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || copy[language].failure);
      window.location.assign(returnTo);
    } catch (issue) { setError(issue instanceof Error ? issue.message : copy[language].failure); setWorking(false); }
  }, [language, returnTo]);
  callback.current = (credential) => { void finish(credential); };
  useEffect(() => {
    if (!clientId || !slot.current) return;
    let alive = true;
    const draw = () => {
      if (!alive || !slot.current || !window.google) return;
      window.google.accounts.id.initialize({ client_id: clientId, auto_select: false, callback: response => callback.current(response.credential) });
      slot.current.replaceChildren();
      window.google.accounts.id.renderButton(slot.current, { type: 'standard', theme: 'outline', size: 'large', shape: 'rectangular', text: copy[language].button, logo_alignment: 'left', width: Math.min(360, slot.current.clientWidth || 320), locale: language === 'हिन्दी' ? 'hi' : language === 'ಕನ್ನಡ' ? 'kn' : 'en' });
    };
    let script = document.querySelector<HTMLScriptElement>('script[data-google-identity]');
    if (window.google) draw();
    else if (!script) { script = document.createElement('script'); script.src = 'https://accounts.google.com/gsi/client'; script.async = true; script.defer = true; script.dataset.googleIdentity = 'true'; script.onload = draw; document.head.appendChild(script); }
    else script.addEventListener('load', draw, { once: true });
    return () => { alive = false; };
  }, [clientId, language]);
  const labels = copy[language];
  return <section className="google-signin" aria-label={labels.heading}><span className="eyebrow">{purpose === 'contribute' ? 'CONTRIBUTOR ACCOUNT' : 'SECURE ACCOUNT ACCESS'}</span><h2>{labels.heading}</h2>{clientId ? <div ref={slot} className="google-signin-slot"/> : <p role="status" className="google-signin-setup">{labels.missing}</p>}{working && <p role="status"><LoaderCircle size={15} className="spin"/> {labels.busy}</p>}{error && <p role="alert" className="google-signin-error">{error}</p>}</section>;
}
