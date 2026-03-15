type Tone = {
  frequency: number;
  durationMs: number;
  type?: OscillatorType;
  gain?: number;
};

let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new AudioCtx();
  }
  return audioContext;
};

const playSequence = async (tones: Tone[]): Promise<boolean> => {
  const ctx = getAudioContext();
  if (!ctx) return false;

  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      // Ignore resume errors; we still try to schedule tones.
    }
  }

  let cursor = ctx.currentTime;
  tones.forEach((tone) => {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const duration = tone.durationMs / 1000;
    const gain = tone.gain ?? 0.06;

    osc.type = tone.type ?? 'sine';
    osc.frequency.setValueAtTime(tone.frequency, cursor);
    gainNode.gain.setValueAtTime(gain, cursor);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, cursor + duration);

    osc.connect(gainNode).connect(ctx.destination);
    osc.start(cursor);
    osc.stop(cursor + duration);
    cursor += duration + 0.03;
  });

  return true;
};

export const isSfxSupported = (): boolean => {
  if (typeof window === 'undefined') return false;
  return Boolean(window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
};

export const canVibrate = (): boolean =>
  typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

export const vibrateWrong = (): void => {
  if (!canVibrate()) return;
  navigator.vibrate([120, 40, 80]);
};

export const playCorrectSfx = (): void => {
  void playSequence([
    { frequency: 740, durationMs: 90, type: 'triangle', gain: 0.06 },
    { frequency: 960, durationMs: 110, type: 'triangle', gain: 0.06 },
  ]);
};

export const playWrongSfx = (): void => {
  void playSequence([
    { frequency: 260, durationMs: 140, type: 'sawtooth', gain: 0.05 },
    { frequency: 180, durationMs: 160, type: 'sawtooth', gain: 0.04 },
  ]);
};
