export type SpellingItem = {
  id: string;
  word: string;
  meaning: string;
  topicId?: string;
};

export type UserConfig = {
  username: string;
  timerEnabled: boolean;
  secondsPerQuestion: number;
  questionCount: number;
  topicId: string;
  showMeaning: boolean;
  showHintEn: boolean;
  showHintId: boolean;
};

export type Question = {
  id: string;
  word: string;
  meaning: string;
  hintEn?: string;
  hintId?: string;
  answer: string;
};

export type AnswerRecord = {
  questionId: string;
  word: string;
  meaning: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  isTimeout: boolean;
};

export type QuizResult = {
  correct: number;
  total: number;
  percentage: number;
  wrongItems: AnswerRecord[];
};
