/* Browser speech synthesis: no server, no key, no permission prompt. Mobile
   browsers refuse to speak until the page has seen a user gesture, so the
   first tap primes the engine with a silent utterance. */

const LANG = "ko-KR";
let primed = false;

export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

function koreanVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((voice) => voice.lang === LANG && /Yuna|Google/i.test(voice.name))
    ?? voices.find((voice) => voice.lang === LANG)
    ?? voices.find((voice) => voice.lang.startsWith("ko"))
    ?? null;
}

export function primeSpeech(): void {
  if (primed || !speechSupported()) return;
  primed = true;
  const silent = new SpeechSynthesisUtterance("");
  silent.volume = 0;
  window.speechSynthesis.speak(silent);
}

interface SpeakOptions {
  rate?: number;
  pitch?: number;
}

export function speak(text: string, options: SpeakOptions = {}): boolean {
  if (!speechSupported() || !text.trim()) return false;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = LANG;
  utterance.rate = options.rate ?? 1.02;
  utterance.pitch = options.pitch ?? 1.15;
  const voice = koreanVoice();
  if (voice) utterance.voice = voice;
  synth.speak(utterance);
  return true;
}

/* Button feedback: a short, bright shout. Pitch is capped at 2 by the API. */
export function cheer(text: "시작!" | "끝!"): boolean {
  return speak(text, { rate: 1.15, pitch: 1.9 });
}

export function stopSpeaking(): void {
  if (speechSupported()) window.speechSynthesis.cancel();
}
