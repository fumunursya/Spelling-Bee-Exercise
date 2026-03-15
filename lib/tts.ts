let currentUtterance: SpeechSynthesisUtterance | null = null;
let activeSession = 0;

const isBrowserSupported = (): boolean => typeof window !== 'undefined' && 'speechSynthesis' in window;

const getPreferredVoice = (): SpeechSynthesisVoice | null => {
  if (!isBrowserSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.name === 'Google US English') ||
    voices.find((v) => v.lang === 'en-US' && v.name.includes('Google')) ||
    voices.find((v) => v.lang === 'en-US') ||
    voices[0] ||
    null
  );
};

const splitLetters = (word: string): string[] =>
  word
    .trim()
    .split('')
    .filter((char) => /[A-Za-z]/.test(char));

export const isSpeechSupported = (): boolean => isBrowserSupported();

export const speakSpelling = (word: string, onEnd?: () => void): boolean => {
  if (!isBrowserSupported()) return false;

  const letters = splitLetters(word);
  if (letters.length === 0) {
    onEnd?.();
    return false;
  }

  stopSpeaking();
  const voice = getPreferredVoice();
  const sessionId = (activeSession += 1);

  const speakNext = (index: number) => {
    if (sessionId !== activeSession) return;
    if (index >= letters.length) {
      currentUtterance = null;
      onEnd?.();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(letters[index].toUpperCase());
    utterance.lang = 'en-US';
    utterance.rate = 0.85;
    utterance.pitch = 1;
    utterance.volume = 1;

    if (voice) utterance.voice = voice;

    utterance.onend = () => speakNext(index + 1);
    utterance.onerror = () => speakNext(index + 1);

    currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  };

  speakNext(0);
  return true;
};

export const stopSpeaking = (): void => {
  if (!isBrowserSupported()) return;
  activeSession += 1;
  window.speechSynthesis.cancel();
  currentUtterance = null;
};

export const isSpeaking = (): boolean => {
  if (!isBrowserSupported()) return false;
  return window.speechSynthesis.speaking;
};
