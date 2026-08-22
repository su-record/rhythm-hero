/* Browser speech synthesis: no server, no key, no permission prompt. Mobile
   browsers refuse to speak until the page has seen a user gesture, so the
   first tap primes the engine with a silent utterance. */

const LANG = "ko-KR";
let primed = false;
let voices: SpeechSynthesisVoice[] = [];

export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

/* Chrome returns an empty list until `voiceschanged` fires. Speaking before
   that falls back to the system default, which is rarely Korean and mangles
   Hangul. Load once, keep the list, and refresh whenever the browser says so. */
function refreshVoices(): SpeechSynthesisVoice[] {
  if (!speechSupported()) return [];
  const found = window.speechSynthesis.getVoices();
  if (found.length) voices = found;
  return voices;
}

if (speechSupported()) {
  refreshVoices();
  window.speechSynthesis.addEventListener("voiceschanged", refreshVoices);
}

/** Preference order: the natural Korean voices first, then any ko-KR, then any ko-*. */
const PREFERRED = [/Yuna/i, /Google.*한국/i, /Google.*Korean/i, /Sora/i, /Siri.*Korean/i, /Heami/i, /SunHi/i];

export function koreanVoice(): SpeechSynthesisVoice | null {
  const list = refreshVoices();
  const korean = list.filter((voice) => voice.lang.replace("_", "-").toLowerCase().startsWith("ko"));
  for (const pattern of PREFERRED) {
    const match = korean.find((voice) => pattern.test(voice.name));
    if (match) return match;
  }
  return korean.find((voice) => voice.localService) ?? korean[0] ?? null;
}

function whenVoicesReady(): Promise<void> {
  if (refreshVoices().length) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      window.speechSynthesis.removeEventListener("voiceschanged", done);
      resolve();
    };
    window.speechSynthesis.addEventListener("voiceschanged", done);
    setTimeout(done, 1200);
  });
}

export function primeSpeech(): void {
  if (primed || !speechSupported()) return;
  primed = true;
  const silent = new SpeechSynthesisUtterance("");
  silent.volume = 0;
  window.speechSynthesis.speak(silent);
  refreshVoices();
}

interface SpeakOptions {
  rate?: number;
  pitch?: number;
}

export function speak(text: string, options: SpeakOptions = {}): boolean {
  if (!speechSupported() || !text.trim()) return false;
  void whenVoicesReady().then(() => {
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = LANG;
    utterance.rate = options.rate ?? 1.0;
    utterance.pitch = options.pitch ?? 1.1;
    const voice = koreanVoice();
    if (voice) utterance.voice = voice;
    synth.speak(utterance);
  });
  return true;
}

export function stopSpeaking(): void {
  if (speechSupported()) window.speechSynthesis.cancel();
}

export type CheerTone = "high" | "normal";

/* Button feedback: short and bright. No tilde or decoration in the text; some
   voices read punctuation aloud or let it bend the intonation. Pitch stays
   well under the 2.0 ceiling so the consonants survive. */
const CHEER_TEXT: Record<"start" | "stop", string> = { start: "시작!", stop: "끝!" };

export function cheer(kind: "start" | "stop", tone: CheerTone = "high"): boolean {
  return speak(CHEER_TEXT[kind], { rate: 0.9, pitch: tone === "high" ? 1.35 : 1.0 });
}

/** What the user will actually hear, for the settings screen. */
export function describeVoice(): string {
  if (!speechSupported()) return "이 브라우저는 음성을 지원하지 않아요";
  const voice = koreanVoice();
  if (!voice) return refreshVoices().length ? "한국어 음성이 설치돼 있지 않아요" : "음성 목록을 불러오는 중";
  return `${voice.name}${voice.localService ? "" : " · 온라인"}`;
}
