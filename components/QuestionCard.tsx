import React, { useState, useRef, useEffect } from 'react';
import { Question } from '../types';
import { CheckCircle, XCircle, HelpCircle, RefreshCw, Lightbulb, Sparkles, Maximize2, X, Volume2, Square, Loader2, RotateCcw, Send } from 'lucide-react';
import { generateSpeechFromText } from '../services/geminiService';

interface QuestionCardProps {
  question: Question;
  selectedAnswerIndex: number | null;
  onSelectAnswer: (answer: number | string, isRetry: boolean) => void;
  isAnswered: boolean;
  onRetry: () => void;
  isMuted: boolean;
  volume: number;
  apiKey: string;
  pointsEarned: number | null;
  onRefresh?: () => void;
  feedback?: string;
  isCorrectEssay?: boolean;
  backgroundImageUrl?: string;
}

type AudioType = 'question' | 'explanation' | 'hint' | 'option-0' | 'option-1' | 'option-2' | 'option-3' | null;

const QuestionCard: React.FC<QuestionCardProps> = React.memo(({ 
  question, 
  selectedAnswerIndex, 
  onSelectAnswer, 
  isAnswered,
  onRetry,
  isMuted,
  volume,
  apiKey,
  pointsEarned,
  onRefresh,
  feedback,
  isCorrectEssay,
  backgroundImageUrl
}) => {
  const [processingIndex, setProcessingIndex] = useState<number | null>(null);
  const [wrongIndices, setWrongIndices] = useState<number[]>([]);
  const [hasFailed, setHasFailed] = useState(false);
  const [isRetryAttempt, setIsRetryAttempt] = useState(false);
  const [essayAnswer, setEssayAnswer] = useState("");
  const [isSubmittingEssay, setIsSubmittingEssay] = useState(false);
  
  // Audio State
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [isPlayingAI, setIsPlayingAI] = useState(false);
  const [playingType, setPlayingType] = useState<AudioType>(null);
  const [aiVolume, setAiVolume] = useState<number>(1.0); 
  
  // Audio Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioGainNodeRef = useRef<GainNode | null>(null); 
  const currentAudioBufferRef = useRef<AudioBuffer | null>(null); 
  const startedAtRef = useRef<number>(0); 
  const isMounted = useRef(true);

  // Reset states when question changes
  useEffect(() => {
    setWrongIndices([]);
    setProcessingIndex(null);
    setHasFailed(false);
    setIsRetryAttempt(false);
    setEssayAnswer("");
    setIsSubmittingEssay(false);
  }, [question]);

  const isCorrectFinal = isAnswered && (
    (question.type === 'multiple-choice' && selectedAnswerIndex === question.correctAnswerIndex) ||
    (question.type === 'essay' && isCorrectEssay)
  );

  // --- AUDIO HELPERS ---
  const decodeBase64Audio = (base64: string): Uint8Array => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  useEffect(() => {
    if (audioGainNodeRef.current) {
      const effectiveVolume = isMuted ? 0 : (volume * aiVolume);
      try {
        const currentTime = audioContextRef.current?.currentTime || 0;
        audioGainNodeRef.current.gain.cancelScheduledValues(currentTime);
        audioGainNodeRef.current.gain.setValueAtTime(effectiveVolume, currentTime);
      } catch (e) {
        audioGainNodeRef.current.gain.value = effectiveVolume;
      }
    }
  }, [aiVolume, volume, isMuted]);

  const playAudioBuffer = (buffer: AudioBuffer, offset: number = 0) => {
     try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const ctx = audioContextRef.current;
      
      // Stop previous source if exists
      if (audioSourceRef.current) {
        try { 
          audioSourceRef.current.onended = null;
          audioSourceRef.current.stop(); 
        } catch(e) {}
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gainNode = ctx.createGain();
      gainNode.gain.value = isMuted ? 0 : (volume * aiVolume);
      audioGainNodeRef.current = gainNode;
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      audioSourceRef.current = source;
      
      startedAtRef.current = ctx.currentTime - offset;
      
      source.start(0, offset);
      if (isMounted.current) setIsPlayingAI(true);
      
      source.onended = () => {
        if (isMounted.current) {
          setIsPlayingAI(false);
          setPlayingType(null);
        }
      };
     } catch (e) {
       console.error("Error playing buffer:", e);
       if (isMounted.current) {
         setIsPlayingAI(false);
         setPlayingType(null);
       }
     }
  };

  const processAndPlayPCM = async (base64Data: string) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') await ctx.resume();
      const pcmData = decodeBase64Audio(base64Data);
      const dataInt16 = new Int16Array(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength / 2);
      const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < dataInt16.length; i++) {
        channelData[i] = dataInt16[i] / 32768.0;
      }
      currentAudioBufferRef.current = buffer;
      playAudioBuffer(buffer, 0);
    } catch (e) {
      console.error("Error decoding/playing PCM audio:", e);
      if (isMounted.current) {
        setIsPlayingAI(false);
        setPlayingType(null);
      }
    }
  };

  const stopAIAudio = () => {
    if (audioSourceRef.current) {
      try { audioSourceRef.current.stop(); audioSourceRef.current = null; } catch (e) {}
    }
    if (isMounted.current) { setIsPlayingAI(false); setPlayingType(null); }
  };

  const handleRewind = () => {
    if (!audioContextRef.current || !currentAudioBufferRef.current || !isPlayingAI) return;
    const ctx = audioContextRef.current;
    
    // Calculate elapsed time based on the "virtual" start time
    const elapsed = ctx.currentTime - startedAtRef.current;
    
    // Rewind 5 seconds, clamping to 0
    const newTime = Math.max(0, elapsed - 5);
    
    playAudioBuffer(currentAudioBufferRef.current, newTime);
  };

  const triggerAIVoice = async (isCorrect: boolean) => {
    if (!isMounted.current) return;
    stopAIAudio(); 
    setIsAudioLoading(true);
    setPlayingType(isCorrect ? 'explanation' : 'hint');
    let script = isCorrect 
      ? `Chính xác! ${question.explanation} Và bạn có biết: ${question.funFact}`
      : `Chưa đúng rồi. Gợi ý cho bạn: ${question.hint}`;
    const base64 = await generateSpeechFromText(apiKey, script);
    if (!isMounted.current) return;
    setIsAudioLoading(false);
    if (base64) processAndPlayPCM(base64);
    else setPlayingType(null);
  };

  const triggerQuestionVoice = async () => {
    if (!isMounted.current) return;
    stopAIAudio();
    setIsAudioLoading(true);
    setPlayingType('question');
    const base64 = await generateSpeechFromText(apiKey, question.text);
    if (!isMounted.current) return;
    setIsAudioLoading(false);
    if (base64) processAndPlayPCM(base64);
    else setPlayingType(null);
  };

  const triggerOptionVoice = async (index: number) => {
    if (!isMounted.current) return;
    stopAIAudio();
    setIsAudioLoading(true);
    const type = `option-${index}` as AudioType;
    setPlayingType(type);
    const base64 = await generateSpeechFromText(apiKey, `Lựa chọn ${String.fromCharCode(65 + index)}: ${question.options[index]}`);
    if (!isMounted.current) return;
    setIsAudioLoading(false);
    if (base64) processAndPlayPCM(base64);
    else setPlayingType(null);
  };

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      stopAIAudio();
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []);

  const difficultyColors = [
    "bg-green-100 text-green-800 border-green-200", 
    "bg-blue-100 text-blue-800 border-blue-200",   
    "bg-cyan-100 text-cyan-800 border-cyan-200",   
    "bg-yellow-100 text-yellow-800 border-yellow-200", 
    "bg-orange-100 text-orange-800 border-orange-200", 
    "bg-red-100 text-red-800 border-red-200"        
  ];

  const customKeyframes = `
    @keyframes selectionGlow {
      0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); border-color: rgb(16 185 129); }
      70% { box-shadow: 0 0 0 12px rgba(16, 185, 129, 0); border-color: rgb(16 185 129); }
      100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); border-color: rgb(34 197 94); }
    }
    @keyframes selectionShake {
      0%, 100% { transform: translateX(0); }
      20% { transform: translateX(-4px); }
      40% { transform: translateX(4px); }
      60% { transform: translateX(-4px); }
      80% { transform: translateX(4px); }
    }
    @keyframes continuousPulse {
      0%, 100% { box-shadow: 0 0 5px rgba(34, 197, 94, 0.2); }
      50% { box-shadow: 0 0 20px rgba(34, 197, 94, 0.5); }
    }
    @keyframes softGlow {
      0%, 100% { box-shadow: 0 0 5px rgba(74, 222, 128, 0.2); border-color: rgb(187 247 208); transform: scale(1); } 
      50% { box-shadow: 0 0 25px rgba(74, 222, 128, 0.6); border-color: rgb(34, 197, 94); transform: scale(1.01); }
    }
    @keyframes errorShake {
      0%, 100% { transform: translateX(0); }
      15% { transform: translateX(-6px) rotate(-1.5deg); }
      30% { transform: translateX(5px) rotate(1.5deg); }
      45% { transform: translateX(-4px) rotate(-1deg); }
      60% { transform: translateX(3px) rotate(1deg); }
      75% { transform: translateX(-2px); }
    }
    @keyframes smoothReveal {
      0% { opacity: 0; transform: translateY(15px) scale(0.98); filter: blur(4px); }
      100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
    }
  `;

  // --- AUDIO LOGIC (SFX) ---
  const playSelectSound = () => {
    if (isMuted || volume <= 0) return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, t);
      osc.frequency.exponentialRampToValueAtTime(300, t + 0.1);
      gain.gain.setValueAtTime(0.1 * volume, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.1);
    } catch (e) {}
  };

  const playRetrySound = () => {
    if (isMuted || volume <= 0) return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, t);
      osc.frequency.exponentialRampToValueAtTime(1200, t + 0.15);
      gain.gain.setValueAtTime(0.2 * volume, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.15);
    } catch (e) {}
  };

  const playFeedbackSound = (isCorrect: boolean) => {
    if (isMuted || volume <= 0) return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const t = ctx.currentTime;
      const masterGain = ctx.createGain();
      masterGain.gain.value = 0.2 * volume; 
      masterGain.connect(ctx.destination);
      if (isCorrect) {
        [523.25, 659.25, 783.99].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const oscGain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, t);
          oscGain.gain.setValueAtTime(0, t);
          oscGain.gain.linearRampToValueAtTime(0.3, t + 0.03); 
          oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
          osc.connect(oscGain);
          oscGain.connect(masterGain);
          osc.start(t);
          osc.stop(t + 1.0);
        });
      } else {
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, t); 
        osc.frequency.exponentialRampToValueAtTime(80, t + 0.3);
        oscGain.gain.setValueAtTime(0, t);
        oscGain.gain.linearRampToValueAtTime(0.5, t + 0.02);
        oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.connect(oscGain);
        oscGain.connect(masterGain);
        osc.start(t);
        osc.stop(t + 0.35);
      }
    } catch (e) {}
  };

  const handleSelection = (index: number) => {
    if (isAnswered || processingIndex !== null || wrongIndices.includes(index) || (hasFailed && !isAnswered)) return;
    playSelectSound();
    stopAIAudio();
    setProcessingIndex(index);
    setTimeout(() => {
      const isCorrect = index === question.correctAnswerIndex;
      playFeedbackSound(isCorrect);
      setProcessingIndex(null);
      if (isCorrect) {
        onSelectAnswer(index, isRetryAttempt);
        if (!isMuted && volume > 0) triggerAIVoice(true);
      } else {
        setWrongIndices(prev => [...prev, index]);
        if (isRetryAttempt) {
          // Final fail
          onSelectAnswer(index, true);
          if (!isMuted && volume > 0) triggerAIVoice(false);
        } else {
          // First fail - allow retry
          setHasFailed(true);
          if (!isMuted && volume > 0) triggerAIVoice(false);
        }
      }
    }, 600);
  };

  const handleRetryQuestion = () => {
    playRetrySound();
    stopAIAudio();
    setHasFailed(false);
    setIsRetryAttempt(true);
    // We don't clear wrongIndices because we want to show they were wrong before?
    // Actually, the prompt says "re-attempt the same question". 
    // Usually that means they get a fresh start or at least can pick again.
    // Let's clear the processing state but keep the UI clean.
  };

  const handleRetryClick = () => {
    playRetrySound();
    stopAIAudio();
    onRetry();
  };

  return (
    <>
      <div 
        className={`w-full max-w-4xl rounded-2xl shadow-xl overflow-hidden border animate-[fadeIn_0.5s_ease-out] relative ${backgroundImageUrl ? 'border-white/20' : 'bg-white border-slate-200'}`}
        style={backgroundImageUrl ? {
          backgroundImage: `url(${backgroundImageUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        } : undefined}
      >
        <style>{customKeyframes}</style>
        
        {backgroundImageUrl && (
          <div className="absolute inset-0 bg-slate-900/75 z-0 pointer-events-none"></div>
        )}
        
        <div className="relative z-10">
          {/* Header */}
          <div className={`p-6 border-b flex justify-between items-center ${backgroundImageUrl ? 'bg-black/30 border-white/10 backdrop-blur-sm' : 'bg-slate-50 border-slate-100'}`}>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${difficultyColors[question.difficulty - 1]}`}>
                Độ khó {question.difficulty}
              </span>
              {onRefresh && !isAnswered && (
                <button 
                  onClick={() => { stopAIAudio(); onRefresh(); }}
                  className={`p-1.5 rounded-lg transition-all ${backgroundImageUrl ? 'text-white/50 hover:text-white hover:bg-white/20' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                  title="Đổi câu hỏi khác"
                >
                  <RefreshCw size={16} />
                </button>
              )}
            </div>
            <span className={`text-sm font-medium uppercase tracking-widest ${backgroundImageUrl ? 'text-slate-300' : 'text-slate-400'}`}>{question.topic}</span>
          </div>

        {/* Content */}
        <div className="p-6 md:p-8">
          
          <div className="flex items-start justify-between gap-4 mb-6">
            <h2 key={question.text} className={`text-xl md:text-2xl font-bold leading-relaxed animate-[scaleIn_0.5s_ease-out] ${backgroundImageUrl ? 'text-white' : 'text-slate-800'}`}>
              {question.text}
            </h2>
            <button 
                onClick={playingType === 'question' && isPlayingAI ? stopAIAudio : triggerQuestionVoice}
                disabled={isAudioLoading && playingType !== 'question'}
                className={`flex-shrink-0 p-3 rounded-full transition-all ${
                    playingType === 'question' && isPlayingAI 
                    ? 'bg-amber-100 text-amber-600 animate-pulse' 
                    : backgroundImageUrl
                      ? 'bg-white/10 text-white hover:bg-white/20'
                      : 'bg-slate-100 text-slate-400 hover:bg-indigo-100 hover:text-indigo-600'
                }`}
            >
                {isAudioLoading && playingType === 'question' ? <Loader2 size={24} className="animate-spin" /> : playingType === 'question' && isPlayingAI ? <Square size={24} fill="currentColor" /> : <Volume2 size={24} />}
            </button>
          </div>

          {question.type === 'multiple-choice' && question.options ? (
            <div className="space-y-3">
            {question.options.map((option, index) => {
              const isProcessing = processingIndex === index;
              const isAnyProcessing = processingIndex !== null;
              const isWrong = wrongIndices.includes(index);
              const isCorrect = isAnswered && index === question.correctAnswerIndex;
              const isSelected = selectedAnswerIndex === index;
              
              let btnClass = "w-full text-left p-4 rounded-xl border-2 transition-all duration-300 relative group ";
              let animationStyle: React.CSSProperties = {};
              
              if (isProcessing) {
                if (index === question.correctAnswerIndex) {
                  btnClass += "bg-emerald-50 border-emerald-400 text-emerald-800 scale-[1.02]";
                  animationStyle = { animation: 'selectionGlow 0.6s ease-out both' };
                } else {
                  btnClass += "bg-rose-50 border-rose-400 text-rose-800";
                  animationStyle = { animation: 'selectionShake 0.4s ease-in-out both' };
                }
              } else if (isAnswered) {
                if (index === question.correctAnswerIndex) {
                  btnClass += "bg-green-50 border-green-500 text-green-800 ring-2 ring-green-200 ring-offset-1";
                  animationStyle = { animation: 'successPop 0.6s ease-out, continuousPulse 2.5s infinite ease-in-out' };
                } else if (isWrong || (isSelected && !isCorrect)) {
                  btnClass += "bg-red-50 border-red-200 text-red-800 opacity-60";
                  if (isSelected) animationStyle = { animation: 'shake 0.5s cubic-bezier(.36,.07,.19,.97) both' };
                } else {
                  btnClass += backgroundImageUrl ? "bg-white/5 border-white/10 text-white/40 opacity-40" : "bg-white border-slate-100 text-slate-400 opacity-40";
                }
              } else {
                if (isWrong) {
                  btnClass += "bg-red-50 border-red-200 text-red-400 cursor-not-allowed opacity-80";
                  animationStyle = { animation: 'selectionShake 0.4s ease-in-out both' };
                } else {
                  btnClass += backgroundImageUrl ? "bg-white/10 border-white/20 hover:bg-white/20 hover:border-white/30 text-white backdrop-blur-sm" : "bg-white border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 hover:-translate-y-1 hover:shadow-lg text-slate-700";
                }
              }

              return (
                <div 
                  key={index} 
                  onClick={() => !(isAnswered || isAnyProcessing || isWrong || (hasFailed && !isAnswered)) && handleSelection(index)} 
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      !(isAnswered || isAnyProcessing || isWrong || (hasFailed && !isAnswered)) && handleSelection(index);
                    }
                  }}
                  role="button"
                  tabIndex={isAnswered || isAnyProcessing || isWrong || (hasFailed && !isAnswered) ? -1 : 0}
                  aria-disabled={isAnswered || isAnyProcessing || isWrong || (hasFailed && !isAnswered)}
                  className={`${btnClass} ${isAnswered || isAnyProcessing || isWrong || (hasFailed && !isAnswered) ? 'cursor-default' : 'cursor-pointer'}`} 
                  style={animationStyle}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-3">
                      <span className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold ${
                         isCorrect || (isProcessing && index === question.correctAnswerIndex) ? 'bg-green-200 text-green-800' :
                         (isWrong || (isProcessing && index !== question.correctAnswerIndex)) ? 'bg-red-200 text-red-800' :
                         backgroundImageUrl ? 'bg-white/20 text-white group-hover:bg-white/30' : 'bg-slate-100 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600'
                      }`}>
                        {String.fromCharCode(65 + index)}
                      </span>
                      <span className="font-medium">{option}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (playingType === `option-${index}` && isPlayingAI) stopAIAudio();
                          else triggerOptionVoice(index);
                        }}
                        disabled={isAudioLoading && playingType !== `option-${index}`}
                        className={`p-2 rounded-full transition-all ${
                          playingType === `option-${index}` && isPlayingAI
                            ? 'bg-indigo-100 text-indigo-600 animate-pulse'
                            : backgroundImageUrl
                              ? 'text-white/50 hover:text-white hover:bg-white/20'
                              : 'text-slate-300 hover:text-indigo-500 hover:bg-indigo-50'
                        }`}
                      >
                        {isAudioLoading && playingType === `option-${index}` ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : playingType === `option-${index}` && isPlayingAI ? (
                          <Square size={16} fill="currentColor" />
                        ) : (
                          <Volume2 size={16} />
                        )}
                      </button>
                      {isCorrect && <CheckCircle className="w-6 h-6 text-green-500 animate-[scaleIn_0.3s_ease-out]" />}
                      {(isWrong || (isAnswered && isSelected && !isCorrect)) && <XCircle className="w-6 h-6 text-red-500 animate-[scaleIn_0.3s_ease-out]" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          ) : (
            <div className="space-y-4">
              <textarea
                value={essayAnswer}
                onChange={(e) => setEssayAnswer(e.target.value)}
                disabled={isAnswered || isSubmittingEssay}
                placeholder="Nhập câu trả lời của bạn vào đây..."
                className={`w-full min-h-[150px] p-4 rounded-xl border-2 focus:ring-4 transition-all resize-y disabled:opacity-70 ${
                  backgroundImageUrl 
                  ? 'bg-white/10 border-white/20 text-white placeholder-white/50 focus:border-white/50 focus:ring-white/20 disabled:bg-white/5' 
                  : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20 text-slate-700 disabled:bg-slate-50'
                }`}
              />
              {!isAnswered && (
                <button
                  onClick={async () => {
                    if (!essayAnswer.trim()) return;
                    setIsSubmittingEssay(true);
                    await onSelectAnswer(essayAnswer, isRetryAttempt);
                    setIsSubmittingEssay(false);
                  }}
                  disabled={!essayAnswer.trim() || isSubmittingEssay}
                  className="w-full py-3 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmittingEssay ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      Đang chấm điểm...
                    </>
                  ) : (
                    <>
                      <Send size={20} />
                      Gửi câu trả lời
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {!isAnswered && hasFailed && question.type === 'multiple-choice' && (
            <div className="mt-6 animate-[fadeInUp_0.3s_ease-out]">
              <div className={`p-5 rounded-2xl border flex flex-col items-center gap-4 text-center ${backgroundImageUrl ? 'bg-rose-900/40 border-rose-500/30 backdrop-blur-md' : 'bg-rose-50 border-rose-200'}`}>
                <div className={`flex items-center gap-2 font-bold ${backgroundImageUrl ? 'text-rose-400' : 'text-rose-700'}`}>
                  <XCircle className="text-rose-500" size={24} />
                  <span>Câu trả lời chưa chính xác!</span>
                </div>
                <div className="flex flex-col items-center gap-3">
                  <div className={`flex items-center gap-3 px-4 py-2 rounded-xl border ${backgroundImageUrl ? 'bg-black/40 border-rose-500/20' : 'bg-white/50 border-rose-100'}`}>
                    <p className={`text-sm italic font-medium ${backgroundImageUrl ? 'text-rose-300' : 'text-rose-600'}`}>"{question.hint}"</p>
                    <button 
                      onClick={playingType === 'hint' && isPlayingAI ? stopAIAudio : () => triggerAIVoice(false)}
                      disabled={isAudioLoading && playingType !== 'hint'}
                      className={`flex-shrink-0 p-2 rounded-full transition-all ${
                        playingType === 'hint' && isPlayingAI 
                        ? 'bg-rose-200 text-rose-700 animate-pulse' 
                        : backgroundImageUrl ? 'bg-rose-900/50 text-rose-300 hover:text-rose-200' : 'bg-rose-100 text-rose-400 hover:text-rose-600'
                      }`}
                      title="Nghe gợi ý"
                    >
                      {isAudioLoading && playingType === 'hint' ? <Loader2 size={16} className="animate-spin" /> : playingType === 'hint' && isPlayingAI ? <Square size={16} fill="currentColor" /> : <Volume2 size={16} />}
                    </button>
                  </div>
                  {pointsEarned !== null && pointsEarned === 0 && (
                    <div className="bg-rose-100 text-rose-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                      +0 điểm
                    </div>
                  )}
                </div>
                <button 
                  onClick={handleRetryQuestion}
                  className="flex items-center gap-2 px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-lg shadow-rose-200 transition-all active:scale-95"
                >
                  <RotateCcw size={18} /> Thử lại ngay (Không mất chuỗi)
                </button>
              </div>
            </div>
          )}

          {!isAnswered && !hasFailed && wrongIndices.length > 0 && (
            <div className="mt-6 animate-[fadeInUp_0.3s_ease-out]">
              <div className={`p-4 rounded-xl border flex items-start gap-3 relative ${backgroundImageUrl ? 'bg-amber-900/40 border-amber-500/30 backdrop-blur-md' : 'bg-amber-50 border-amber-200'}`}>
                <Lightbulb className="w-6 h-6 text-amber-500 flex-shrink-0 animate-pulse" />
                <div className="flex-1">
                  <h3 className={`font-bold mb-1 ${backgroundImageUrl ? 'text-amber-400' : 'text-amber-800'}`}>Gợi ý nhỏ:</h3>
                  <p className={`text-sm ${backgroundImageUrl ? 'text-amber-100' : 'text-amber-800'}`}>{question.hint}</p>
                </div>
                <div className="flex flex-col items-center justify-center ml-2 pl-2 border-l border-amber-200 gap-2">
                   {isAudioLoading && playingType === 'hint' ? <Loader2 className="animate-spin text-amber-500" size={20} /> : isPlayingAI && playingType === 'hint' ? (
                     <div className="flex items-center gap-1 bg-amber-100 p-1 rounded-lg border border-amber-200">
                       <button onClick={stopAIAudio} className="text-amber-600 p-1 hover:bg-amber-200 rounded" title="Dừng đọc"><Square size={16} fill="currentColor" /></button>
                       <div className="w-px h-4 bg-amber-300"></div>
                       <button onClick={handleRewind} className="text-amber-600 p-1 hover:bg-amber-200 rounded" title="Tua lại 5 giây"><RotateCcw size={16} /></button>
                     </div>
                   ) : <button onClick={() => triggerAIVoice(false)} className="text-amber-400 p-2 hover:bg-amber-100 rounded-full transition-colors"><Volume2 size={24} /></button>}
                </div>
              </div>
            </div>
          )}

          {isAnswered && (
            <div className="mt-8 space-y-6">
              
              {/* ESSAY FEEDBACK BLOCK */}
              {question.type === 'essay' && feedback && (
                <div className={`p-6 rounded-2xl border animate-[smoothReveal_0.6s_cubic-bezier(0.22,1,0.36,1)_both] relative ${
                  isCorrectEssay 
                    ? (backgroundImageUrl ? 'bg-emerald-900/60 border-emerald-500/30 backdrop-blur-md' : 'bg-emerald-50 border-emerald-200') 
                    : (backgroundImageUrl ? 'bg-rose-900/60 border-rose-500/30 backdrop-blur-md' : 'bg-rose-50 border-rose-200')
                }`}>
                  {pointsEarned !== null && (
                    <div className={`absolute -top-3 right-6 px-4 py-1.5 rounded-full font-black text-sm shadow-md animate-[bounce_1s_infinite] ${pointsEarned > 0 ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                      {pointsEarned > 0 ? `+${pointsEarned} điểm` : '0 điểm'}
                    </div>
                  )}
                  <div className="flex flex-col gap-4">
                    <div className="flex-1">
                      <h3 className={`font-bold mb-2 flex items-center gap-2 text-lg ${isCorrectEssay ? (backgroundImageUrl ? 'text-emerald-400' : 'text-emerald-900') : (backgroundImageUrl ? 'text-rose-400' : 'text-rose-900')}`}>
                        {isCorrectEssay ? <CheckCircle size={22} className="text-emerald-500" /> : <XCircle size={22} className="text-rose-500" />} 
                        Nhận xét:
                      </h3>
                      <p className={`text-sm md:text-base leading-relaxed ${isCorrectEssay ? (backgroundImageUrl ? 'text-emerald-100' : 'text-emerald-800') : (backgroundImageUrl ? 'text-rose-100' : 'text-rose-800')}`}>{feedback}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* EXPLANATION BLOCK */}
              <div className={`p-6 rounded-2xl border animate-[smoothReveal_0.6s_cubic-bezier(0.22,1,0.36,1)_both] relative ${backgroundImageUrl ? 'bg-indigo-900/60 border-indigo-500/30 backdrop-blur-md' : 'bg-indigo-50 border-indigo-100'}`}>
                {pointsEarned !== null && question.type === 'multiple-choice' && (
                  <div className={`absolute -top-3 right-6 px-4 py-1.5 rounded-full font-black text-sm shadow-md animate-[bounce_1s_infinite] ${pointsEarned > 0 ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                    {pointsEarned > 0 ? `+${pointsEarned} điểm` : '0 điểm'}
                  </div>
                )}
                <div className="flex flex-col gap-4">
                  <div className="flex-1">
                    <h3 className={`font-bold mb-2 flex items-center gap-2 text-lg ${backgroundImageUrl ? 'text-indigo-300' : 'text-indigo-900'}`}>
                      <HelpCircle size={22} className="text-indigo-500" /> Giải thích:
                    </h3>
                    <p className={`text-sm md:text-base leading-relaxed ${backgroundImageUrl ? 'text-indigo-100' : 'text-indigo-800'}`}>{question.explanation}</p>
                    
                    {/* Audio Controls for Explanation */}
                    <div className="mt-4 flex items-center gap-3">
                       {isAudioLoading && playingType === 'explanation' ? (
                         <div className={`flex items-center gap-2 ${backgroundImageUrl ? 'text-indigo-300' : 'text-indigo-400'}`}>
                           <Loader2 className="animate-spin" size={20} />
                           <span className="text-xs font-bold uppercase">Đang đọc...</span>
                         </div>
                       ) : isPlayingAI && playingType === 'explanation' ? (
                         <div className={`flex items-center gap-2 p-1.5 px-3 rounded-full border shadow-sm ${backgroundImageUrl ? 'bg-black/40 border-indigo-500/30' : 'bg-white/60 border-indigo-200'}`}>
                           <button onClick={stopAIAudio} className={`transition-colors ${backgroundImageUrl ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-800'}`} title="Dừng đọc"><Square size={18} fill="currentColor" /></button>
                           <button onClick={handleRewind} className={`transition-colors ${backgroundImageUrl ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-500 hover:text-indigo-700'}`} title="Tua lại 5 giây"><RotateCcw size={18} /></button>
                           <div className={`w-px h-4 mx-1 ${backgroundImageUrl ? 'bg-indigo-500/30' : 'bg-indigo-200'}`}></div>
                           <input type="range" min="0" max="1" step="0.1" value={aiVolume} onChange={(e) => setAiVolume(parseFloat(e.target.value))} className="w-16 h-1 bg-indigo-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" title="Âm lượng giọng đọc" />
                         </div>
                       ) : (
                         <button onClick={() => triggerAIVoice(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-md active:scale-95">
                           <Volume2 size={16} /> Nghe giải thích
                         </button>
                       )}
                    </div>
                  </div>
                </div>
              </div>

              {/* FUN FACT BLOCK */}
              {isCorrectFinal && question.funFact && (
                <div className={`p-6 rounded-2xl border relative overflow-hidden animate-[smoothReveal_0.6s_cubic-bezier(0.22,1,0.36,1)_both] ${backgroundImageUrl ? 'bg-emerald-900/60 border-emerald-500/30 backdrop-blur-md' : 'bg-emerald-50 border-emerald-100'}`} style={{ animationDelay: '250ms' }}>
                  <div className="absolute -right-8 -top-8 text-emerald-100 opacity-40 rotate-12 scale-150"><Sparkles size={100} /></div>
                  
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-2">
                      <Sparkles className="w-6 h-6 text-emerald-600" />
                      <h3 className={`font-bold text-lg ${backgroundImageUrl ? 'text-emerald-400' : 'text-emerald-900'}`}>Có thể bạn chưa biết:</h3>
                    </div>
                    <p className={`text-sm md:text-base leading-relaxed italic font-medium ${backgroundImageUrl ? 'text-emerald-100' : 'text-emerald-800'}`}>"{question.funFact}"</p>
                  </div>
                </div>
              )}

              {/* ACTION AREA */}
              <div className={`flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t animate-[smoothReveal_0.6s_cubic-bezier(0.22,1,0.36,1)_both] ${backgroundImageUrl ? 'border-white/10' : 'border-slate-100'}`} style={{ animationDelay: '450ms' }}>
                {onRefresh && (
                  <button 
                    onClick={() => { stopAIAudio(); onRefresh(); }}
                    className={`flex-1 py-4 border-2 font-bold rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 ${backgroundImageUrl ? 'bg-white/10 border-white/20 text-white hover:bg-white/20' : 'bg-white border-slate-200 hover:border-indigo-400 text-slate-700'}`}
                  >
                    Thử lại lượt này <RefreshCw size={20} className={backgroundImageUrl ? 'text-white/70' : 'text-indigo-500'} />
                  </button>
                )}
                <button onClick={handleRetryClick} className="flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-extrabold rounded-2xl shadow-xl transition-all transform active:scale-95 w-full sm:w-auto hover:-translate-y-1">
                  <RotateCcw size={22} /> Tiếp tục hành trình
                </button>
              </div>
            </div>
          )}
        </div>
        </div>
      </div>
    </>
  );
});

export default QuestionCard;