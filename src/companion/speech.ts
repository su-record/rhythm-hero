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

export type CheerTone = "high" | "normal";

/* Button feedback: a short, bright shout. Near the API's pitch ceiling (2.0)
   the phonemes smear, so "high" stays at 1.4 and speaks a touch slower.
   A lone syllable like "끝" is mumbled by most voices; a trailing vowel
   sound gives it somewhere to land without changing the word. */
const CHEER_TEXT: Record<"start" | "stop", string> = { start: "시작!", stop: "끝~!" };

export function cheer(kind: "start" | "stop", tone: CheerTone = "high"): boolean {
  const pitch = tone === "high" ? 1.4 : 1.1;
  return speak(CHEER_TEXT[kind], { rate: 0.95, pitch });
}

export function stopSpeaking(): void {
  if (speechSupported()) window.speechSynthesis.cancel();
}
