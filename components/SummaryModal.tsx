import React from 'react';
import { X, Trophy, Target, Flame, RotateCcw, Home, Share2 } from 'lucide-react';
import { Question } from '../types';

interface SummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: {
    totalQuestions: number;
    correctAnswers: number;
    sessionScore: number;
    longestStreak: number;
    difficulty: string;
  };
  studentName: string;
  onRestart: () => void;
  onHome: () => void;
}

const SummaryModal: React.FC<SummaryModalProps> = ({ isOpen, onClose, stats, studentName, onRestart, onHome }) => {
  if (!isOpen) return null;

  const accuracy = stats.totalQuestions > 0 
    ? Math.round((stats.correctAnswers / stats.totalQuestions) * 100) 
    : 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-[fadeIn_0.3s_ease-out]">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 animate-[scaleIn_0.3s_ease-out]">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-8 text-white text-center relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
          
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm border border-white/30">
            <Trophy size={40} className="text-yellow-300" />
          </div>
          
          <h2 className="text-2xl font-black font-serif uppercase tracking-tight">Tổng Kết Hành Trình</h2>
          <div className="inline-block px-3 py-1 bg-white/20 rounded-full text-xs font-bold uppercase tracking-widest mt-2 border border-white/30">
            Độ khó: {stats.difficulty}
          </div>
          <p className="text-indigo-100 mt-2 font-medium">Chúc mừng {studentName} đã hoàn thành!</p>
        </div>

        {/* Stats Grid */}
        <div className="p-8">
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col items-center text-center">
              <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mb-2">
                <Target size={20} />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Độ chính xác</span>
              <span className="text-2xl font-black text-slate-800">{accuracy}%</span>
            </div>
            
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col items-center text-center">
              <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center mb-2">
                <Trophy size={20} />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Điểm số</span>
              <span className="text-2xl font-black text-slate-800">+{stats.sessionScore}</span>
            </div>
            
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col items-center text-center">
              <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center mb-2">
                <Flame size={20} />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Chuỗi cao nhất</span>
              <span className="text-2xl font-black text-slate-800">{stats.longestStreak}</span>
            </div>
            
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col items-center text-center">
              <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-2">
                <RotateCcw size={20} />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tổng câu hỏi</span>
              <span className="text-2xl font-black text-slate-800">{stats.totalQuestions}</span>
            </div>
          </div>

          {/* Message */}
          <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 mb-8 text-center">
            <p className="text-indigo-800 font-medium italic">
              {accuracy >= 80 ? "Xuất sắc! Bạn là một nhà sử học thực thụ." : 
               accuracy >= 50 ? "Khá lắm! Hãy tiếp tục trau dồi kiến thức nhé." : 
               "Đừng nản chí, lịch sử luôn chờ bạn khám phá!"}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <button 
              onClick={onRestart}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <RotateCcw size={20} /> Tiếp tục học tập
            </button>
            <button 
              onClick={onHome}
              className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-2xl transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <Home size={20} /> Quay về trang chủ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SummaryModal;
