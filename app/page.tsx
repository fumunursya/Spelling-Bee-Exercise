'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SPELLING_TOPICS } from '../data/spellingBank';
import { buildQuestions } from '../lib/quiz';
import { loadDefinitionsForTopics } from '../lib/definitions';
import {
  getTopicCount,
  getTopicIdsFromBank,
  getTotalCount,
  loadSpellingBank,
} from '../lib/spellingBank';
import { isSpeechSupported } from '../lib/tts';
import type { UserConfig } from '../types/quiz';

const TIMER_OPTIONS = [10, 12, 15, 20, 30, 45, 60] as const;

export default function HomePage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [secondsPerQuestion, setSecondsPerQuestion] = useState(20);
  const [questionCount, setQuestionCount] = useState(20);
  const [topicId, setTopicId] = useState('all');
  const [showMeaning, setShowMeaning] = useState(true);
  const [showHintEn, setShowHintEn] = useState(false);
  const [showHintId, setShowHintId] = useState(false);
  const [error, setError] = useState('');
  const [isStarting, setIsStarting] = useState(false);

  const topicOptions = useMemo(() => SPELLING_TOPICS, []);

  const filteredBankSize = useMemo(() => {
    if (topicId === 'all') return getTotalCount();
    return getTopicCount(topicId);
  }, [topicId]);

  const [ttsSupport, setTtsSupport] = useState<boolean | null>(null);

  const formatTopicLabel = (value: string) =>
    value
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());

  useEffect(() => {
    setTtsSupport(isSpeechSupported());
  }, []);

  const handleStart = async () => {
    if (isStarting) return;
    setError('');

    if (!username.trim()) {
      setError('Username wajib diisi.');
      return;
    }

    if (filteredBankSize === 0) {
      setError('Bank kosakata kosong.');
      return;
    }

    if (!Number.isFinite(questionCount) || questionCount <= 0) {
      setError('Jumlah soal tidak valid.');
      return;
    }

    if (questionCount > filteredBankSize) {
      setError(`Jumlah soal melebihi bank kata (${filteredBankSize}).`);
      return;
    }

    setIsStarting(true);
    try {
      const bank = await loadSpellingBank(topicId);

      if (bank.length === 0) {
        setError('Bank kosakata kosong.');
        return;
      }

      if (questionCount > bank.length) {
        setError(`Jumlah soal melebihi bank kata (${bank.length}).`);
        return;
      }

      const config: UserConfig = {
        username: username.trim(),
        timerEnabled,
        secondsPerQuestion,
        questionCount,
        topicId,
        showMeaning,
        showHintEn,
        showHintId,
      };

      const shouldLoadHints = config.showHintEn || config.showHintId;
      const topicsForHints = topicId === 'all' ? getTopicIdsFromBank(bank) : [topicId];
      const definitions = shouldLoadHints
        ? await loadDefinitionsForTopics(topicsForHints)
        : null;
      const questions = buildQuestions(config, bank, definitions);

      sessionStorage.setItem('sbe_config', JSON.stringify(config));
      sessionStorage.setItem('sbe_questions', JSON.stringify(questions));
      sessionStorage.removeItem('sbe_answers');
      sessionStorage.removeItem('sbe_result');

      router.push('/quiz');
    } catch {
      setError('Bank kosakata belum siap.');
    } finally {
      setIsStarting(false);
    }
  };

  useEffect(() => {
    if (filteredBankSize > 0 && questionCount > filteredBankSize) {
      setQuestionCount(filteredBankSize);
    }
  }, [filteredBankSize, questionCount]);

  return (
    <main className="ps-app">
      <div className="cyber-grid" />
      <section className="ps-panel ps-setup-panel">
        <div className="ps-setup-head">
          <h1>Spelling Bee Exercise</h1>
          <p>Latihan mengeja kata bahasa Inggris lewat audio spelling per huruf.</p>
          <div className="ps-setup-note">
            {ttsSupport === null
              ? 'Memeriksa dukungan audio di perangkatmu...'
              : ttsSupport
                ? 'Audio akan mengeja huruf satu per satu. Dengarkan, lalu ketik jawabannya.'
                : 'TTS tidak tersedia di device ini. Kamu tetap bisa latihan manual.'}
          </div>
        </div>

        <div className="ps-setup-grid">
          <div className="ps-setup-block">
            <label className="ps-field">
              Username
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Nama kamu"
              />
            </label>

            <label className="ps-field">
              Jumlah soal per sesi
              <input
                type="number"
                min={5}
                max={filteredBankSize}
                value={questionCount}
                onChange={(event) => setQuestionCount(Number(event.target.value))}
              />
            </label>
            <label className="ps-field">
              Topik kosakata
              <select value={topicId} onChange={(event) => setTopicId(event.target.value)}>
                <option value="all">Semua topik</option>
                {topicOptions.map((topic) => (
                  <option key={topic} value={topic}>
                    {formatTopicLabel(topic)}
                  </option>
                ))}
              </select>
            </label>
            <div className="ps-helper">Bank kata tersedia: {filteredBankSize} kata</div>
          </div>

          <div className="ps-setup-block">
            <div className="ps-toggle-row">
              <h3 className="ps-block-title">Timer</h3>
              <button
                type="button"
                className={`ps-switch ${timerEnabled ? 'is-on' : ''}`}
                onClick={() => setTimerEnabled((value) => !value)}
              >
                {timerEnabled ? 'ON' : 'OFF'}
              </button>
            </div>

            {timerEnabled ? (
              <label className="ps-field">
                Detik per soal
                <select
                  value={secondsPerQuestion}
                  onChange={(event) => setSecondsPerQuestion(Number(event.target.value))}
                >
                  {TIMER_OPTIONS.map((seconds) => (
                    <option key={seconds} value={seconds}>
                      {seconds === 60 ? '60 detik (1 menit)' : `${seconds} detik`}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <h3 className="ps-block-title">Tampilan Soal</h3>
            <div className="ps-checks">
              <label className="ps-check-item">
                <input
                  type="checkbox"
                  checked={showMeaning}
                  onChange={() => setShowMeaning((value) => !value)}
                />
                Tampilkan arti saat quiz
              </label>
              <label className="ps-check-item">
                <input
                  type="checkbox"
                  checked={showHintEn}
                  onChange={() => setShowHintEn((value) => !value)}
                />
                Tampilkan hint (English)
              </label>
              <label className="ps-check-item">
                <input
                  type="checkbox"
                  checked={showHintId}
                  onChange={() => setShowHintId((value) => !value)}
                />
                Tampilkan hint (Indonesia)
              </label>
            </div>
          </div>

          <div className="ps-setup-block ps-setup-summary">
            <div className="ps-meta">Total soal sesi: {questionCount}</div>
            {error ? <div className="ps-error">{error}</div> : null}
            <button type="button" className="ps-btn" onClick={handleStart} disabled={isStarting}>
              {isStarting ? 'Menyiapkan...' : 'Start Spelling Bee'}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
