import React, { useState, useCallback, useEffect } from 'react';
import { GameState, Question, HistoryItem } from './types';
import { generateQuestion, generateQuestionImage } from './services/geminiService';
import Dice from './components/Dice';
import QuestionCard from './components/QuestionCard';
import HistoryModal from './components/HistoryModal';
import { 
  Dices, Trophy, Flame, ScrollText, AlertCircle, RefreshCw, 
  User, GraduationCap, History as HistoryIcon, Play, 
  ArrowRight, Volume2, VolumeX, Shuffle, Key, Eye, 
  EyeOff, ExternalLink, CheckCircle2, Palette, X, 
  Rocket, Zap, ChevronRight, RotateCcw
} from 'lucide-react';

const GRADES = [
  "Lớp 6", "Lớp 7", "Lớp 8", "Lớp 9"
];

const SUGGESTED_TOPICS = [
  "Lịch sử Việt Nam - Thời Hùng Vương",
  "Lịch sử Việt Nam - Nhà Trần",
  "Lịch sử Việt Nam - Kháng chiến chống Pháp",
  "Lịch sử Thế Giới - Chiến tranh thế giới thứ 2",
  "Lịch sử Trung Quốc - Nhà Thanh",
  "Lịch sử Châu Âu thời Trung Cổ"
];

// Define Background Options
const BACKGROUNDS = [
  { id: 'default', name: 'Mặc định', class: 'bg-amber-50', color: '#fffbeb' },
  { id: 'vintage', name: 'Giấy Dó', class: 'bg-pattern-vintage', color: '#fdf6e3' },
  { id: 'ceramic', name: 'Gốm Sứ', class: 'bg-pattern-ceramic', color: '#f0f9ff' },
  { id: 'bamboo', name: 'Tre Ngà', class: 'bg-pattern-bamboo', color: '#f7fee7' },
  { id: 'imperial', name: 'Cung Đình', class: 'bg-pattern-imperial', color: '#fff7ed' },
  { id: 'ocean', name: 'Sóng Biển', class: 'bg-pattern-ocean', color: '#ecfeff' },
];

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.SETUP);
  
  // Logic: Check for Environment Variable first
  const envKey = process.env.API_KEY; 
  const isUsingEnvKey = !!(envKey && envKey.trim() !== "");

  // User Inputs
  const [apiKey, setApiKey] = useState<string>(isUsingEnvKey ? envKey : "");
  const [studentName, setStudentName] = useState<string>("");
  const [grade, setGrade] = useState<string>("Lớp 6"); 
  const [topic, setTopic] = useState<string>("");
  
  // Validation Errors
  const [apiKeyError, setApiKeyError] = useState<string>("");
  const [nameError, setNameError] = useState<string>("");
  const [topicError, setTopicError] = useState<string>("");

  // Game State
  const [currentRoll, setCurrentRoll] = useState<number>(1);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState<number | null>(null);
  const [score, setScore] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [isImageGenerating, setIsImageGenerating] = useState(false);
  
  // Audio State
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(1.0); // 0.0 to 1.0

  // UI State
  const [showApiKey, setShowApiKey] = useState(false);
  const [bgId, setBgId] = useState<string>('default'); // Background State
  const [showThemeModal, setShowThemeModal] = useState(false);

  // History State
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Load from LocalStorage on mount
  useEffect(() => {
    try {
      // Basic Settings & Meta Data
      const savedScore = localStorage.getItem('suca_score');
      const savedStreak = localStorage.getItem('suca_streak');
      const savedHistory = localStorage.getItem('suca_history');
      const savedName = localStorage.getItem('suca_name');
      const savedGrade = localStorage.getItem('suca_grade');
      const savedTopic = localStorage.getItem('suca_topic');
      const savedMute = localStorage.getItem('suca_muted');
      const savedVolume = localStorage.getItem('suca_volume');
      const savedBg = localStorage.getItem('suca_bgId'); // Load Background
      
      // Only load API Key from storage if NOT using Env Key
      if (!isUsingEnvKey) {
        const savedApiKey = localStorage.getItem('suca_apiKey');
        if (savedApiKey) setApiKey(savedApiKey);
      }

      // Session State
      const savedGameState = localStorage.getItem('suca_gameState');
      const savedCurrentQuestion = localStorage.getItem('suca_currentQuestion');
      const savedCurrentRoll = localStorage.getItem('suca_currentRoll');
      const savedSelectedAnswerIndex = localStorage.getItem('suca_selectedAnswerIndex');

      if (savedScore) setScore(parseInt(savedScore));
      if (savedStreak) setStreak(parseInt(savedStreak));
      if (savedHistory) setHistory(JSON.parse(savedHistory));
      if (savedBg) setBgId(savedBg); // Restore Background
      
      let loadedName = "";
      if (savedName) {
        setStudentName(savedName);
        loadedName = savedName;
      }
      
      let loadedTopic = "";
      if (savedTopic) {
        setTopic(savedTopic);
        loadedTopic = savedTopic;
      }

      if (savedGrade) {
         if (GRADES.includes(savedGrade)) {
            setGrade(savedGrade);
         } else {
            setGrade("Lớp 6");
         }
      }
      if (savedMute) setIsMuted(savedMute === 'true');
      if (savedVolume) setVolume(parseFloat(savedVolume));

      // Restore Active Session Logic
      if (savedGameState && loadedName && loadedTopic) {
        const parsedState = savedGameState as GameState;
        
        // Restore Roll
        if (savedCurrentRoll) setCurrentRoll(parseInt(savedCurrentRoll));

        // Restore Question
        let parsedQuestion: Question | null = null;
        if (savedCurrentQuestion) {
          try {
            parsedQuestion = JSON.parse(savedCurrentQuestion);
            setCurrentQuestion(parsedQuestion);
          } catch (e) { console.error("Error parsing saved question", e); }
        }

        // Restore Selected Answer
        if (savedSelectedAnswerIndex) {
          setSelectedAnswerIndex(parseInt(savedSelectedAnswerIndex));
        }

        // Determine State
        if (parsedState === GameState.ANSWERING && parsedQuestion) {
          setGameState(GameState.ANSWERING);
        } else if (parsedState === GameState.RESULT && parsedQuestion) {
          setGameState(GameState.RESULT);
        } else if (parsedState === GameState.IDLE) {
          setGameState(GameState.IDLE);
        } else {
          setGameState(GameState.IDLE);
        }
      } else if (loadedName && loadedTopic) {
        setGameState(GameState.IDLE);
      }

    } catch (e) {
      console.error("Failed to load data", e);
    }
  }, [isUsingEnvKey]);

  // Save to LocalStorage on change
  useEffect(() => {
    localStorage.setItem('suca_score', score.toString());
    localStorage.setItem('suca_streak', streak.toString());
    localStorage.setItem('suca_history', JSON.stringify(history));
    localStorage.setItem('suca_name', studentName);
    localStorage.setItem('suca_grade', grade);
    localStorage.setItem('suca_topic', topic);
    localStorage.setItem('suca_muted', isMuted.toString());
    localStorage.setItem('suca_volume', volume.toString());
    localStorage.setItem('suca_bgId', bgId); // Save Background
    
    if (!isUsingEnvKey) {
       localStorage.setItem('suca_apiKey', apiKey); 
    }

    localStorage.setItem('suca_gameState', gameState);
    localStorage.setItem('suca_currentRoll', currentRoll.toString());
    
    if (currentQuestion) {
      localStorage.setItem('suca_currentQuestion', JSON.stringify(currentQuestion));
    } else {
      localStorage.removeItem('suca_currentQuestion');
    }

    if (selectedAnswerIndex !== null) {
      localStorage.setItem('suca_selectedAnswerIndex', selectedAnswerIndex.toString());
    } else {
      localStorage.removeItem('suca_selectedAnswerIndex');
    }

  }, [score, streak, history, studentName, grade, topic, isMuted, volume, gameState, currentRoll, currentQuestion, selectedAnswerIndex, apiKey, isUsingEnvKey, bgId]);

  // Fetch Question from Gemini
  // Memoized to prevent recreation on every render
  const fetchQuestion = useCallback(async (difficulty: number) => {
    setGameState(GameState.FETCHING);
    setIsImageGenerating(true); 

    try {
      const searchTopic = topic.trim() || "Lịch sử chung";
      
      const question = await generateQuestion(apiKey, searchTopic, difficulty, grade);
      
      setCurrentQuestion(question);
      setGameState(GameState.ANSWERING);

      generateQuestionImage(apiKey, question.text, searchTopic)
        .then((imageUrl) => {
           if (imageUrl) {
             setCurrentQuestion(prev => {
               if (!prev || prev.text !== question.text) return prev; 
               return { ...prev, imageUrl };
             });
           }
        })
        .finally(() => {
           setIsImageGenerating(false);
        });

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Lỗi kết nối. Vui lòng thử lại.");
      setGameState(GameState.ERROR);
      setIsImageGenerating(false);
    }
  }, [apiKey, topic, grade]);

  // Dice Roll Logic
  const handleRoll = useCallback(() => {
    if (gameState === GameState.ROLLING) return;
    
    setGameState(GameState.ROLLING);
    setIsRolling(true);
    setSelectedAnswerIndex(null);
    setErrorMsg(null);
    setIsImageGenerating(false);

    setTimeout(() => {
      const roll = Math.floor(Math.random() * 6) + 1;
      setCurrentRoll(roll);
      setIsRolling(false);
      fetchQuestion(roll);
    }, 1500);
  }, [gameState, fetchQuestion]); // Added fetchQuestion to dependencies

  // Handle Answer Selection
  const handleAnswer = useCallback((index: number, isRetry: boolean) => {
    if (gameState !== GameState.ANSWERING || !currentQuestion) return;
    
    setSelectedAnswerIndex(index);
    setGameState(GameState.RESULT);

    const newHistoryItem: HistoryItem = {
      question: currentQuestion,
      selectedAnswerIndex: index,
      timestamp: Date.now()
    };
    setHistory(prev => [newHistoryItem, ...prev]);

    if (index === currentQuestion.correctAnswerIndex) {
      if (isRetry) {
        setScore(s => s + (currentQuestion.difficulty * 5));
        setStreak(0); 
      } else {
        setScore(s => s + (currentQuestion.difficulty * 10));
        setStreak(s => s + 1);
      }
    } else {
      setStreak(0);
    }
  }, [gameState, currentQuestion]); // Optimized dependencies

  const resetGame = () => {
    setGameState(GameState.SETUP);
    setScore(0);
    setStreak(0);
    setCurrentQuestion(null);
    setSelectedAnswerIndex(null);
    setIsImageGenerating(false);
  };

  const clearHistory = () => {
    if (window.confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử học tập?")) {
      setHistory([]);
      setScore(0);
      setStreak(0);
    }
  };

  const handleRandomTopic = (e: React.MouseEvent) => {
    e.preventDefault();
    const randomIndex = Math.floor(Math.random() * SUGGESTED_TOPICS.length);
    setTopic(SUGGESTED_TOPICS[randomIndex]);
    if (topicError) setTopicError("");
  };

  const startGame = () => {
    let isValid = true;
    setNameError("");
    setTopicError("");
    setApiKeyError("");

    if (!apiKey.trim()) {
       setApiKeyError("Vui lòng nhập API Key để ứng dụng hoạt động.");
       isValid = false;
    }

    if (!studentName.trim()) {
      setNameError("Vui lòng nhập tên của bạn.");
      isValid = false;
    } else if (studentName.trim().length < 2) {
      setNameError("Tên quá ngắn, vui lòng nhập ít nhất 2 ký tự.");
      isValid = false;
    } else if (studentName.length > 50) {
      setNameError("Tên quá dài.");
      isValid = false;
    }

    if (!topic.trim()) {
      setTopicError("Vui lòng nhập chủ đề lịch sử.");
      isValid = false;
    } else if (topic.trim().length < 2) {
      setTopicError("Chủ đề quá ngắn, vui lòng mô tả rõ hơn.");
      isValid = false;
    }

    if (!isValid) return;

    setGameState(GameState.IDLE);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (val > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  // Resolve Background Class
  const currentBgClass = BACKGROUNDS.find(b => b.id === bgId)?.class || 'bg-amber-50';

  return (
    <div className={`min-h-screen ${currentBgClass} text-slate-900 flex flex-col font-sans selection:bg-amber-200 transition-colors duration-500`}>
      <HistoryModal 
        isOpen={showHistory} 
        onClose={() => setShowHistory(false)} 
        history={history} 
        onClearHistory={clearHistory}
        isMuted={isMuted}
        volume={volume}
      />

      {/* THEME SELECTION MODAL */}
      {showThemeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
           <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm animate-[scaleIn_0.2s_ease-out] border border-slate-200">
              <div className="flex justify-between items-center mb-4">
                 <h3 className="font-bold text-lg font-serif text-amber-900">Chọn Giao Diện</h3>
                 <button onClick={() => setShowThemeModal(false)} className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600"><X size={20} /></button>
              </div>
              <div className="grid grid-cols-1 gap-2">
                 {BACKGROUNDS.map((bg) => (
                    <button 
                      key={bg.id}
                      onClick={() => { setBgId(bg.id); }}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                         bgId === bg.id 
                         ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-200' 
                         : 'border-slate-100 hover:border-indigo-200 hover:bg-slate-50'
                      }`}
                    >
                       <div className={`w-8 h-8 rounded-full shadow-sm border border-slate-300 ${bg.class}`} style={{backgroundColor: bg.color}}></div>
                       <span className={`font-medium ${bgId === bg.id ? 'text-indigo-700' : 'text-slate-600'}`}>{bg.name}</span>
                       {bgId === bg.id && <CheckCircle2 size={16} className="ml-auto text-indigo-500" />}
                    </button>
                 ))}
              </div>
              <div className="mt-4 text-right">
                 <button onClick={() => setShowThemeModal(false)} className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors">Đóng</button>
              </div>
           </div>
        </div>
      )}

      {/* Navbar */}
      <header className="bg-white/80 backdrop-blur-md border-b border-amber-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setGameState(GameState.SETUP)}>
            <div className="bg-amber-700 p-2 rounded-lg text-white shadow-md">
              <ScrollText size={24} />
            </div>
            <h1 className="text-xl font-bold font-serif text-amber-900 hidden xs:block">
              Sử Ca
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
            {gameState !== GameState.SETUP && (
              <div className="flex items-center gap-3 text-sm font-medium">
                <div className="hidden md:flex items-center gap-2 text-slate-500 mr-2 border-r border-slate-200 pr-4">
                   <User size={16} />
                   <span className="truncate max-w-[100px]">{studentName}</span>
                </div>
                <div className="flex items-center gap-1.5 text-amber-600 bg-amber-100 px-3 py-1.5 rounded-full border border-amber-200">
                  <Flame size={16} fill="currentColor" />
                  <span>{streak}</span>
                </div>
                <div className="flex items-center gap-1.5 text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-200">
                  <Trophy size={16} />
                  <span>{score}</span>
                </div>
              </div>
            )}
            
            {/* Theme Toggle Button */}
            <button 
              onClick={() => setShowThemeModal(true)}
              className="p-2 text-slate-600 bg-slate-50 hover:bg-slate-200 rounded-full transition-colors"
              title="Đổi giao diện"
            >
              <Palette size={20} />
            </button>
            
            {/* Volume Control */}
            <div className="hidden sm:flex items-center bg-slate-100 rounded-full px-2 py-1 gap-2 hover:bg-slate-200 transition-colors group">
              <button 
                onClick={() => setIsMuted(!isMuted)}
                className="p-1 text-slate-600 hover:text-amber-600 rounded-full transition-colors"
                title={isMuted ? "Bật âm thanh" : "Tắt âm thanh"}
              >
                {isMuted || volume === 0 ? <VolumeX size={20} className="text-slate-400" /> : <Volume2 size={20} />}
              </button>
              <div className="w-0 overflow-hidden group-hover:w-20 transition-all duration-300 flex items-center">
                 <input 
                   type="range" 
                   min="0" 
                   max="1" 
                   step="0.1" 
                   value={isMuted ? 0 : volume} 
                   onChange={handleVolumeChange}
                   className="w-20 h-1 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-amber-600"
                 />
              </div>
            </div>

            <button 
              onClick={() => setShowHistory(true)}
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors relative"
              title="Lịch sử"
            >
              <HistoryIcon size={24} />
              {history.length > 0 && (
                <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-start p-4 md:p-8 max-w-5xl mx-auto w-full">
        
        {/* SETUP SCREEN */}
        {gameState === GameState.SETUP && (
          <div className="w-full max-w-lg mt-8 md:mt-12 animate-[fadeIn_0.5s_ease-out]">
            <div className="bg-white p-6 md:p-10 rounded-xl shadow-xl border border-amber-100 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-500 to-red-600"></div>
              
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold font-serif text-amber-900 mb-2">Hành Trình Lịch Sử</h2>
                <p className="text-slate-500">Khám phá quá khứ qua từng mặt xúc xắc</p>
              </div>
              
              <div className="space-y-6">

                {/* API Key Input - Secure Area */}
                {!isUsingEnvKey && (
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <label className="flex items-center justify-between text-sm font-bold text-slate-700 mb-2">
                      <span className="flex items-center gap-2">
                          <Key size={18} className="text-indigo-600" />
                          Google Gemini API Key <span className="text-red-500">*</span>
                      </span>
                      <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-indigo-500 hover:underline text-xs flex items-center gap-1">
                          Lấy Key <ExternalLink size={10} />
                      </a>
                    </label>
                    <div className="relative">
                      <input 
                        type={showApiKey ? "text" : "password"}
                        placeholder="Nhập khóa API của bạn..."
                        value={apiKey}
                        onChange={(e) => {
                            setApiKey(e.target.value);
                            if(apiKeyError) setApiKeyError("");
                        }}
                        className={`w-full p-3 pr-10 rounded-lg border ${apiKeyError ? 'border-red-500 focus:border-red-500 ring-red-100' : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-200'} bg-white focus:ring-2 outline-none transition-all font-mono text-sm`}
                      />
                      <button 
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors"
                      >
                          {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {apiKeyError && (
                      <p className="text-red-500 text-xs mt-1 font-medium">{apiKeyError}</p>
                    )}
                    <p className="text-[10px] text-slate-400 mt-2">
                      Key được lưu an toàn trong trình duyệt của bạn (LocalStorage).
                    </p>
                  </div>
                )}
                
                {/* Name Input */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                    <User size={18} className="text-amber-600" />
                    Tên của bạn <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    placeholder="Nhập tên học sinh..."
                    value={studentName}
                    onChange={(e) => {
                      setStudentName(e.target.value);
                      if(nameError) setNameError("");
                    }}
                    className={`w-full p-3 rounded-lg border ${nameError ? 'border-red-500 focus:border-red-500 ring-red-100' : 'border-slate-300 focus:border-amber-500 focus:ring-amber-200'} bg-white focus:ring-2 outline-none transition-all`}
                  />
                  {nameError && (
                    <p className="text-red-500 text-sm mt-1 animate-[fadeIn_0.2s]">{nameError}</p>
                  )}
                </div>

                {/* Grade Selection */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                    <GraduationCap size={18} className="text-amber-600" />
                    Lớp học
                  </label>
                  <select 
                    value={grade} 
                    onChange={(e) => setGrade(e.target.value)}
                    className="w-full p-3 rounded-lg border border-slate-300 bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none transition-all cursor-pointer"
                  >
                    {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>

                {/* Topic Input */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                    <HistoryIcon size={18} className="text-amber-600" />
                    Chủ đề lịch sử muốn học <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    placeholder="VD: Nhà Thanh, Chiến tranh thế giới, Thời Lý..."
                    value={topic}
                    onChange={(e) => {
                      setTopic(e.target.value);
                      if (topicError) setTopicError("");
                    }}
                    className={`w-full p-3 rounded-lg border ${topicError ? 'border-red-500 focus:border-red-500 ring-red-100' : 'border-slate-300 focus:border-amber-500 focus:ring-amber-200'} bg-white focus:ring-2 outline-none transition-all mb-2`}
                  />
                  {topicError && (
                     <p className="text-red-500 text-sm mb-2 animate-[fadeIn_0.2s]">{topicError}</p>
                  )}
                  
                  {/* Suggestions Pills */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleRandomTopic}
                      className="flex items-center gap-1 text-xs px-3 py-1 bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-md hover:bg-indigo-200 transition-all font-bold shadow-sm"
                      title="Chọn ngẫu nhiên một chủ đề"
                    >
                      <Shuffle size={12} /> Ngẫu nhiên
                    </button>
                    {SUGGESTED_TOPICS.slice(0, 4).map((t) => (
                      <button
                        key={t}
                        onClick={() => {
                          setTopic(t);
                          if(topicError) setTopicError("");
                        }}
                        className="text-xs px-2 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-md hover:bg-amber-100 transition-all transform hover:scale-105 hover:shadow-sm"
                      >
                        {t.split("-")[1] || t}
                      </button>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={startGame}
                  className="w-full mt-4 py-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-bold rounded-lg transition-all text-lg flex items-center justify-center gap-2 shadow-lg shadow-orange-200 group active:scale-[0.98]"
                >
                  <Rocket size={24} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                  Bắt Đầu Hành Trình
                </button>
                
                {history.length > 0 && (
                   <div className="text-center pt-2">
                      <button onClick={() => setShowHistory(true)} className="text-sm text-slate-500 hover:text-amber-700 underline">
                        Xem lại lịch sử ({history.length} câu)
                      </button>
                   </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* GAME SCREEN */}
        {gameState !== GameState.SETUP && (
          <div className="w-full flex flex-col items-center">
            
            {/* Header Info Mobile */}
            <div className="md:hidden w-full text-center mb-4 text-sm text-slate-500">
               Đang học: <span className="font-bold text-slate-800">{topic || "Lịch sử chung"}</span>
            </div>

            {/* Dice Section */}
            <div className="relative mb-8">
              <Dice 
                value={currentRoll} 
                isRolling={isRolling} 
                isMuted={isMuted} 
                volume={volume}
              />
              
              {/* Controls */}
              {(gameState === GameState.IDLE || gameState === GameState.RESULT || gameState === GameState.ERROR) && (
                <div className="flex flex-col gap-3 mt-8 items-center animate-[fadeInUp_0.3s_ease-out]">
                   <button
                    onClick={handleRoll}
                    className="px-10 py-4 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-full shadow-lg shadow-orange-200 hover:shadow-orange-300 transition-all hover:scale-105 active:scale-95 flex items-center gap-3 text-lg group"
                  >
                    {gameState === GameState.IDLE ? (
                      <>
                        <Dices className="w-6 h-6 animate-bounce" />
                        Tung Xúc Xắc
                      </>
                    ) : (
                      <>
                        <span>Tiếp Tục Thử Thách</span>
                        <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                  {gameState === GameState.RESULT && (
                     <button 
                       onClick={resetGame}
                       className="flex items-center gap-2 text-sm text-slate-500 hover:text-amber-700 font-medium transition-colors underline decoration-dotted underline-offset-4"
                     >
                       <RotateCcw size={14} />
                       Thay đổi chủ đề hoặc lớp học
                     </button>
                  )}
                </div>
              )}
            </div>

            {/* Error Message */}
            {gameState === GameState.ERROR && (
              <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 flex items-center gap-3 max-w-lg mb-8">
                <AlertCircle className="flex-shrink-0" />
                <p>{errorMsg}</p>
                <button onClick={handleRoll} className="ml-auto p-2 hover:bg-red-100 rounded-lg">
                  <RefreshCw size={18} />
                </button>
              </div>
            )}

            {/* Loading State */}
            {gameState === GameState.FETCHING && (
              <div className="flex flex-col items-center justify-center p-12 text-slate-500 gap-4 animate-pulse bg-white/50 rounded-xl border border-white/60">
                <div className="w-12 h-12 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin"></div>
                <p className="font-medium text-amber-800 flex items-center gap-2">
                   <Zap className="text-amber-500 animate-pulse" size={20} />
                   Đang tạo câu hỏi...
                </p>
                <p className="text-xs text-slate-400">Chủ đề: {topic || "Lịch sử chung"}</p>
              </div>
            )}

            {/* Question Card */}
            {(gameState === GameState.ANSWERING || gameState === GameState.RESULT) && currentQuestion && (
              <QuestionCard 
                question={currentQuestion}
                selectedAnswerIndex={selectedAnswerIndex}
                onSelectAnswer={handleAnswer}
                isAnswered={gameState === GameState.RESULT}
                onRetry={() => fetchQuestion(currentRoll)}
                isMuted={isMuted}
                volume={volume}
                apiKey={apiKey}
                isImageGenerating={isImageGenerating}
              />
            )}
            
          </div>
        )}
      </main>
    </div>
  );
};

export default App;