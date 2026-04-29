export type QuestionType = 'multiple-choice' | 'essay';

export interface Question {
  type: QuestionType;
  text: string;
  options?: string[]; // Only for multiple-choice
  correctAnswerIndex?: number; // Only for multiple-choice
  sampleAnswer?: string; // Only for essay
  explanation: string;
  difficulty: number;
  topic: string;
  hint: string;     // Gợi ý khi trả lời sai
  funFact: string;  // Kiến thức thú vị mở rộng khi trả lời đúng
}

export interface HistoryItem {
  question: Question;
  selectedAnswerIndex?: number; // For multiple-choice
  studentAnswer?: string; // For essay
  isCorrect: boolean;
  feedback?: string; // For essay
  timestamp: number;
}

export enum GameState {
  SETUP = 'SETUP',
  IDLE = 'IDLE',
  ROLLING = 'ROLLING',
  FETCHING = 'FETCHING',
  ANSWERING = 'ANSWERING',
  EVALUATING = 'EVALUATING',
  RESULT = 'RESULT',
  ERROR = 'ERROR'
}

export enum Difficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD',
  INFINITY = 'INFINITY'
}

export interface AppState {
  topic: string;
  score: number;
  streak: number;
  gameState: GameState;
  currentRoll: number;
  currentQuestion: Question | null;
  selectedAnswerIndex: number | null;
  errorMsg: string | null;
}