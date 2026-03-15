import type { WordDefinition } from '../data/definitions';
import type { AnswerRecord, Question, QuizResult, SpellingItem, UserConfig } from '../types/quiz';

const shuffle = <T>(arr: T[]): T[] => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export const buildQuestions = (
  config: UserConfig,
  bank: SpellingItem[],
  definitions: WordDefinition[] | null = null,
): Question[] => {
  const definitionById = definitions
    ? new Map(definitions.map((definition) => [definition.id, definition]))
    : null;
  const pool =
    config.topicId && config.topicId !== 'all'
      ? bank.filter((item) => item.topicId === config.topicId)
      : bank;

  if (pool.length === 0) {
    throw new Error('Bank kosakata kosong.');
  }

  const total = Math.min(config.questionCount, pool.length);
  return shuffle(pool)
    .slice(0, total)
    .map((item) => {
      const definition = definitionById?.get(item.id);
      const definitionId = definition?.definitionId?.trim() ?? '';
      const isGenericId = definitionId.startsWith('Kata yang berarti');
      return {
        id: item.id,
        word: item.word,
        meaning: item.meaning,
        hintEn: definition?.definitionEn,
        hintId: isGenericId ? definition?.definitionEn : definition?.definitionId,
        answer: item.word.toLowerCase(),
      };
    });
};

export const scoreAnswers = (answers: AnswerRecord[]): QuizResult => {
  const total = answers.length;
  const correct = answers.filter((answer) => answer.isCorrect).length;
  const wrongItems = answers.filter((answer) => !answer.isCorrect);
  const percentage = total === 0 ? 0 : Math.round((correct / total) * 100);

  return { correct, total, percentage, wrongItems };
};
