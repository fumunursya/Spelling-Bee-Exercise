'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { scoreAnswers } from '../../lib/quiz';
import { isSfxSupported, playCorrectSfx, playWrongSfx, vibrateWrong } from '../../lib/sfx';
import { isSpeechSupported, speakSpelling, stopSpeaking } from '../../lib/tts';
import type { AnswerRecord, Question, UserConfig } from '../../types/quiz';

type FeedbackState = {
  kind: 'correct' | 'wrong';
  label: 'Benar' | 'Salah' | 'Timeout';
};

const FEEDBACK_DELAY_MS = 650;

export default function QuizPage() {
  const router = useRouter();
  const [config, setConfig] = useState<UserConfig | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [letters, setLetters] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const lettersRef = useRef<string[]>([]);
  const [cursorIndex, setCursorIndex] = useState(0);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [isAnswering, setIsAnswering] = useState(false);
  const [isSpeakingNow, setIsSpeakingNow] = useState(false);
  const [ttsSupport, setTtsSupport] = useState<boolean | null>(null);
  const [sfxSupport, setSfxSupport] = useState<boolean | null>(null);
  const [sfxEnabled, setSfxEnabled] = useState(true);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const feedbackTimeoutRef = useRef<number | null>(null);
  const answerLockRef = useRef(false);
  const isTtsReady = ttsSupport === true;

  const currentQuestion = questions[index];
  const progressText = useMemo(
    () => `${index + 1} / ${questions.length}`,
    [index, questions.length],
  );

  useEffect(() => {
    const rawConfig = sessionStorage.getItem('sbe_config');
    const rawQuestions = sessionStorage.getItem('sbe_questions');

    if (!rawConfig || !rawQuestions) {
      router.replace('/');
      return;
    }

    const parsedConfig = JSON.parse(rawConfig) as UserConfig;
    const parsedQuestions = JSON.parse(rawQuestions) as Question[];

    if (!Array.isArray(parsedQuestions) || parsedQuestions.length === 0) {
      router.replace('/');
      return;
    }

    setConfig(parsedConfig);
    setQuestions(parsedQuestions);
    setTimeLeft(parsedConfig.secondsPerQuestion);

    return () => {
      stopSpeaking();
      if (feedbackTimeoutRef.current !== null) {
        window.clearTimeout(feedbackTimeoutRef.current);
        feedbackTimeoutRef.current = null;
      }
      answerLockRef.current = false;
    };
  }, [router]);

  useEffect(() => {
    setTtsSupport(isSpeechSupported());
  }, []);

  useEffect(() => {
    setSfxSupport(isSfxSupported());
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem('sbe_sfx_enabled');
    if (stored !== null) {
      setSfxEnabled(stored === 'true');
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('sbe_sfx_enabled', String(sfxEnabled));
  }, [sfxEnabled]);

  useEffect(() => {
    if (!currentQuestion) return;

    const freshLetters = Array.from({ length: currentQuestion.word.length }, () => '');
    setLetters(freshLetters);
    setInputValue('');
    lettersRef.current = freshLetters;
    setCursorIndex(0);
    setFeedback(null);
    setIsAnswering(false);
    answerLockRef.current = false;
    stopSpeaking();
    setIsSpeakingNow(false);

    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [currentQuestion?.id]);

  useEffect(() => {
    if (!config || !currentQuestion || !config.timerEnabled || isAnswering) {
      return;
    }

    setTimeLeft(config.secondsPerQuestion);

    const timer = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          handleAnswer(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, config?.timerEnabled, config?.secondsPerQuestion, isAnswering]);

  useEffect(() => {
    if (!currentQuestion || isAnswering) return;
    if (lettersRef.current !== letters) return;
    if (letters.length > 0 && letters.every((char) => char !== '')) {
      handleAnswer(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letters, isAnswering, currentQuestion?.id]);

  const handleAnswer = (isTimeout: boolean) => {
    if (!currentQuestion || answerLockRef.current) return;

    answerLockRef.current = true;
    setIsAnswering(true);
    stopSpeaking();
    setIsSpeakingNow(false);

    const userAnswer = lettersRef.current.join('').toLowerCase();
    const correctAnswer = currentQuestion.answer;
    const isCorrect = userAnswer === correctAnswer;
    const resolvedTimeout = isTimeout && !isCorrect;

    if (isCorrect) {
      setFeedback({ kind: 'correct', label: 'Benar' });
    } else if (resolvedTimeout) {
      setFeedback({ kind: 'wrong', label: 'Timeout' });
    } else {
      setFeedback({ kind: 'wrong', label: 'Salah' });
    }

    if (sfxEnabled && sfxSupport) {
      if (isCorrect) {
        playCorrectSfx();
      } else {
        playWrongSfx();
        vibrateWrong();
      }
    }

    const record: AnswerRecord = {
      questionId: currentQuestion.id,
      word: currentQuestion.word,
      meaning: currentQuestion.meaning,
      userAnswer,
      correctAnswer,
      isCorrect,
      isTimeout: resolvedTimeout,
    };

    const nextAnswers = [...answers, record];
    setAnswers(nextAnswers);

    const isLast = index >= questions.length - 1;

    if (feedbackTimeoutRef.current !== null) {
      window.clearTimeout(feedbackTimeoutRef.current);
    }

    feedbackTimeoutRef.current = window.setTimeout(() => {
      feedbackTimeoutRef.current = null;
      setFeedback(null);
      setIsAnswering(false);
      answerLockRef.current = false;

      if (!isLast) {
        setIndex((value) => value + 1);
        return;
      }

      const result = scoreAnswers(nextAnswers);
      sessionStorage.setItem('sbe_answers', JSON.stringify(nextAnswers));
      sessionStorage.setItem('sbe_result', JSON.stringify(result));
      router.push('/result');
    }, FEEDBACK_DELAY_MS);
  };

  const applyInputValue = (rawValue: string) => {
    if (!currentQuestion) return;
    const cleaned = rawValue.replace(/[^a-zA-Z]/g, '').slice(0, currentQuestion.word.length).toLowerCase();
    setInputValue(cleaned);
    const nextLetters = Array.from({ length: currentQuestion.word.length }, (_, idx) => cleaned[idx] ?? '');
    setLetters(nextLetters);
    lettersRef.current = nextLetters;
    setCursorIndex(cleaned.length);
  };

  const handleLetterInput = (value: string) => {
    if (!currentQuestion) return;
    if (cursorIndex >= currentQuestion.word.length) return;
    const nextIndex = Math.min(cursorIndex, currentQuestion.word.length - 1);

    setLetters((prev) => {
      const next = [...prev];
      next[nextIndex] = value.toLowerCase();
      lettersRef.current = next;
      setInputValue(next.join(''));
      return next;
    });

    setCursorIndex((prev) => Math.min(prev + 1, currentQuestion.word.length));
  };

  const handleBackspace = () => {
    if (!currentQuestion) return;

    setLetters((prev) => {
      const next = [...prev];
      let nextCursor = cursorIndex;

      if (nextCursor > 0 && (nextCursor === next.length || next[nextCursor] === '')) {
        nextCursor -= 1;
      }

      next[nextCursor] = '';
      lettersRef.current = next;
      setInputValue(next.join(''));
      setCursorIndex(Math.max(nextCursor, 0));
      return next;
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!currentQuestion || isAnswering) return;

    if (event.key === 'Backspace') {
      event.preventDefault();
      handleBackspace();
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (lettersRef.current.some((char) => char === '')) {
        return;
      }
      handleAnswer(false);
      return;
    }

    if (/^[a-zA-Z]$/.test(event.key)) {
      if (cursorIndex >= currentQuestion.word.length) {
        return;
      }
      event.preventDefault();
      handleLetterInput(event.key);
    }
  };

  const handleSpeak = () => {
    if (!currentQuestion || isAnswering || !isTtsReady) return;

    if (isSpeakingNow) {
      stopSpeaking();
      setIsSpeakingNow(false);
      return;
    }

    const ok = speakSpelling(currentQuestion.word, () => setIsSpeakingNow(false));
    if (ok) {
      setIsSpeakingNow(true);
    }
  };

  if (!config || !currentQuestion) {
    return (
      <main className="ps-app">
        <section className="ps-panel">Loading quiz...</section>
      </main>
    );
  }

  const showMeaning = config.showMeaning ?? true;
  const showHintEn = config.showHintEn ?? false;
  const showHintId = config.showHintId ?? false;
  const activeIndex = Math.min(cursorIndex, Math.max(letters.length - 1, 0));
  const sfxDisabled = sfxSupport === false;

  return (
    <main className="ps-app">
      <div className="cyber-grid" />
      <section className="ps-panel">
        <div className="ps-quiz-top">
          <strong>{config.username}</strong>
          <span>Soal {progressText}</span>
          {config.timerEnabled ? <span>Time: {timeLeft}s</span> : <span>Timer OFF</span>}
        </div>

        {showMeaning ? (
          <div className="ps-quiz-meaning">{currentQuestion.meaning}</div>
        ) : (
          <div className="ps-quiz-meaning ps-quiz-meaning-hidden">
            Arti disembunyikan. Fokus ke ejaan dulu.
          </div>
        )}

        {showHintEn || showHintId ? (
          <div className="ps-hint-stack">
            {showHintEn ? (
              <div className="ps-hint-card">
                <div className="ps-hint-label">Hint (EN)</div>
                <p>{currentQuestion.hintEn ?? 'Hint belum tersedia.'}</p>
              </div>
            ) : null}
            {showHintId ? (
              <div className="ps-hint-card">
                <div className="ps-hint-label">Hint (ID)</div>
                <p>{currentQuestion.hintId ?? 'Hint belum tersedia.'}</p>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="ps-letter-grid" onClick={() => inputRef.current?.focus()}>
          {letters.map((letter, idx) => (
            <div
              key={`${currentQuestion.id}-${idx}`}
              className={`ps-letter-box ${
                letter ? 'is-filled' : ''
              } ${idx === activeIndex ? 'is-active' : ''} ${
                feedback ? (feedback.kind === 'correct' ? 'is-correct' : 'is-wrong') : ''
              }`}
            >
              {letter ? letter.toUpperCase() : ''}
            </div>
          ))}
        </div>

        <input
          ref={inputRef}
          className="ps-hidden-input"
          value={inputValue}
          onChange={(event) => applyInputValue(event.target.value)}
          onInput={(event) => applyInputValue((event.target as HTMLInputElement).value)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          inputMode="text"
          aria-label="Spelling input"
        />

        <div className="ps-quiz-actions">
          <button
            type="button"
            className="ps-btn ps-btn-small"
            onClick={handleSpeak}
            disabled={isAnswering || !isTtsReady}
            aria-label={isSpeakingNow ? 'Stop TTS' : 'Play spelling'}
          >
            {isSpeakingNow ? 'Stop Spelling' : 'Play Spelling'}
          </button>
          <button
            type="button"
            className="ps-btn ps-btn-ghost"
            disabled={isAnswering}
            onClick={() => handleAnswer(false)}
          >
            Skip
          </button>
        </div>

        {ttsSupport === null ? (
          <div className="ps-tts-note">Memeriksa dukungan audio...</div>
        ) : ttsSupport === false ? (
          <div className="ps-tts-note">TTS tidak tersedia di device ini.</div>
        ) : null}

        {feedback ? (
          <div
            className={`ps-answer-feedback ${feedback.kind === 'correct' ? 'is-correct' : 'is-wrong'}`}
            role="status"
            aria-live="polite"
          >
            <span className="ps-answer-feedback-icon" aria-hidden="true">
              {feedback.kind === 'correct' ? '\u2714' : '\u2716'}
            </span>
            <span>{feedback.label}</span>
          </div>
        ) : null}
      </section>
      <button
        type="button"
        className={`ps-sfx-fab ${!sfxEnabled || sfxDisabled ? 'is-off' : ''}`}
        onClick={() => setSfxEnabled((value) => !value)}
        aria-pressed={sfxEnabled}
        aria-label="Toggle sound effects"
        disabled={sfxDisabled}
        title={sfxDisabled ? 'Sound effect tidak tersedia' : 'Toggle sound effects'}
      >
        <svg className="ps-sfx-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M5 9v6h4l5 4V5L9 9H5Zm11.5 3c0-1.77-1-3.29-2.5-4.03v8.05c1.5-.73 2.5-2.25 2.5-4.02Zm2.5 0c0 2.97-1.64 5.55-4 6.92v-1.74c1.37-1.16 2.25-2.89 2.25-4.92s-.88-3.76-2.25-4.92V5.08c2.36 1.37 4 3.95 4 6.92Z"
          />
        </svg>
      </button>
    </main>
  );
}
