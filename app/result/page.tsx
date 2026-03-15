'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { buildQuestions } from '../../lib/quiz';
import { isSpeechSupported, speakSpelling, stopSpeaking } from '../../lib/tts';
import { getTopicIdsFromBank, loadSpellingBank } from '../../lib/spellingBank';
import { loadDefinitionsForTopics } from '../../lib/definitions';
import type { Question, QuizResult, UserConfig } from '../../types/quiz';

type ResultData = {
  config: UserConfig;
  result: QuizResult;
};

const isQuestionArray = (value: unknown): value is Question[] =>
  Array.isArray(value) &&
  value.every(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as Question).id === 'string' &&
      typeof (item as Question).word === 'string' &&
      typeof (item as Question).meaning === 'string' &&
      typeof (item as Question).answer === 'string',
  );

export default function ResultPage() {
  const router = useRouter();
  const [data, setData] = useState<ResultData | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [retryError, setRetryError] = useState('');
  const [isRetrying, setIsRetrying] = useState(false);
  const [ttsSupport, setTtsSupport] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const rawConfig = sessionStorage.getItem('sbe_config');
      const rawResult = sessionStorage.getItem('sbe_result');

      if (!rawConfig || !rawResult) {
        setData(null);
        return;
      }

      const parsedConfig = JSON.parse(rawConfig) as UserConfig;
      const parsedResult = JSON.parse(rawResult) as QuizResult;

      setData({
        config: parsedConfig,
        result: parsedResult,
      });
    } catch {
      setData(null);
    } finally {
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    setTtsSupport(isSpeechSupported());
    return () => stopSpeaking();
  }, []);

  const handleRetry = async () => {
    if (!data?.config || isRetrying) return;
    setRetryError('');
    setIsRetrying(true);
    try {
      const rawQuestions = sessionStorage.getItem('sbe_questions');
      if (rawQuestions) {
        const parsed = JSON.parse(rawQuestions);
        if (isQuestionArray(parsed) && parsed.length > 0) {
          sessionStorage.removeItem('sbe_answers');
          sessionStorage.removeItem('sbe_result');
          router.push('/quiz');
          return;
        }
      }
      const bank = await loadSpellingBank(data.config.topicId);
      if (bank.length === 0) {
        setRetryError('Bank kosakata kosong. Tidak bisa mulai ulang.');
        return;
      }
      const shouldLoadHints = data.config.showHintEn || data.config.showHintId;
      const topicsForHints =
        data.config.topicId === 'all'
          ? getTopicIdsFromBank(bank)
          : [data.config.topicId];
      const definitions = shouldLoadHints
        ? await loadDefinitionsForTopics(topicsForHints)
        : null;
      const questions = buildQuestions(data.config, bank, definitions);
      sessionStorage.setItem('sbe_questions', JSON.stringify(questions));
      sessionStorage.removeItem('sbe_answers');
      sessionStorage.removeItem('sbe_result');
      router.push('/quiz');
    } catch {
      setRetryError('Bank kosakata belum siap.');
    } finally {
      setIsRetrying(false);
    }
  };

  const handlePlayWord = (word: string) => {
    if (!ttsSupport) return;
    speakSpelling(word);
  };

  if (!isReady) {
    return (
      <main className="ps-app">
        <div className="cyber-grid" />
        <section className="ps-panel">
          <p>Loading result...</p>
        </section>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="ps-app">
        <div className="cyber-grid" />
        <section className="ps-panel">
          <p>Data hasil tidak ditemukan.</p>
          <button type="button" className="ps-btn" onClick={() => router.push('/')}>
            Back to Setup
          </button>
        </section>
      </main>
    );
  }

  const { config, result } = data;
  const issuedDate = new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return (
    <main className="ps-app">
      <div className="cyber-grid" />
      <section className="ps-panel ps-result-panel">
        <div className="ps-setup-head">
          <div className="ps-result-logo ps-fade-in">
            <img src="/learning_english_geuwat_rb_3d.png" alt="GEUWAT" />
          </div>
          <h1>Spelling Bee Result</h1>
          <p>Selamat, kamu sudah menyelesaikan sesi ini.</p>
          <p>Ringkasan hasil latihan untuk {config.username}.</p>
          <div className="ps-helper">Tanggal: {issuedDate}</div>
        </div>

        <div className="ps-score-grid">
          <div className="ps-score-item">
            <span>Jumlah Benar</span>
            <strong>
              {result.correct} / {result.total}
            </strong>
          </div>
          <div className="ps-score-item">
            <span>Akurasi</span>
            <strong>{result.percentage}%</strong>
          </div>
        </div>

        <h3 className="ps-result-subtitle">Jawaban salah</h3>
        {result.wrongItems.length === 0 ? (
          <div className="ps-correct-all">Semua jawaban benar. Mantap.</div>
        ) : (
          <div className="ps-wrong-table-wrap">
            <table className="ps-wrong-table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Word</th>
                  <th>Meaning</th>
                  <th>Jawaban Kamu</th>
                  <th>Jawaban Benar</th>
                  <th>Play</th>
                </tr>
              </thead>
              <tbody>
                {result.wrongItems.map((item, idx) => (
                  <tr key={`${item.questionId}-${idx}`}>
                    <td data-label="No">{idx + 1}</td>
                    <td data-label="Word">{item.word}</td>
                    <td data-label="Meaning">{item.meaning}</td>
                    <td data-label="Jawaban Kamu" className="ps-wrong-user">
                      {item.userAnswer || '-'}
                    </td>
                    <td data-label="Jawaban Benar" className="ps-wrong-correct">
                      {item.correctAnswer}
                    </td>
                    <td data-label="Play">
                      <button
                        type="button"
                        className="ps-btn ps-table-play"
                        onClick={() => handlePlayWord(item.word)}
                        disabled={ttsSupport === false}
                      >
                        Play
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="ps-actions ps-result-actions">
          <div className="ps-result-actions-left">
            <button type="button" className="ps-btn" onClick={handleRetry} disabled={isRetrying}>
              {isRetrying ? 'Menyiapkan...' : 'Retry Quiz'}
            </button>
            {retryError ? <div className="ps-error">{retryError}</div> : null}
          </div>
          <button type="button" className="ps-btn ps-btn-ghost" onClick={() => router.push('/')}>Back to Setup</button>
        </div>
      </section>
    </main>
  );
}
