let cachedVoice = null;

export function getSkVoice() {
  if (!("speechSynthesis" in window)) return null;
  if (cachedVoice) return cachedVoice;
  const voices = window.speechSynthesis.getVoices();
  cachedVoice =
    voices.find((v) => v.lang === "sk-SK") ||
    voices.find((v) => v.lang.startsWith("sk")) ||
    null;
  return cachedVoice;
}

export function hasSkVoice() {
  return !!getSkVoice();
}

export function warmVoices() {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.getVoices();
}

export function speak(text, onEnd) {
  if (!("speechSynthesis" in window)) {
    onEnd?.();
    return false;
  }
  const u = new SpeechSynthesisUtterance(text);
  const v = getSkVoice();
  if (v) u.voice = v;
  u.lang = "sk-SK";
  u.rate = 0.85;
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
  return true;
}