export interface Question {
  text: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
  difficulty: number;
  topic: string;
  hint: string;     // Gợi ý khi trả lời sai
  funFact: string;  // Kiến thức thú vị mở rộng khi trả lời đúng
  imageUrl?: string; // Hình ảnh minh họa (Base64 data URL)
}

export interface HistoryItem {
  question: Question;
  selectedAnswerIndex: number;
  timestamp: number;
}

export enum GameState {
  SETUP = 'SETUP',
  IDLE = 'IDLE',
  ROLLING = 'ROLLING',
  FETCHING = 'FETCHING',
  ANSWERING = 'ANSWERING',
  RESULT = 'RESULT',
  ERROR = 'ERROR'
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