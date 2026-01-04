import React, { useState, useMemo } from 'react';
import { HistoryItem } from '../types';
import { X, Trash2, Calendar, CheckCircle2, XCircle, ArrowUpDown } from 'lucide-react';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryItem[];
  onClearHistory: () => void;
  isMuted: boolean;
  volume: number;
}

const HistoryModal: React.FC<HistoryModalProps> = ({ 
  isOpen, 
  onClose, 
  history, 
  onClearHistory,
  isMuted,
  volume
}) => {
  const [sortOption, setSortOption] = useState<string>('date_desc');

  // Logic sắp xếp
  const sortedHistory = useMemo(() => {
    return [...history].sort((a, b) => {
      switch (sortOption) {
        case 'date_desc':
          return b.timestamp - a.timestamp; // Mới nhất
        case 'date_asc':
          return a.timestamp - b.timestamp; // Cũ nhất
        case 'difficulty_desc':
          return b.question.difficulty - a.question.difficulty; // Khó nhất
        case 'difficulty_asc':
          return a.question.difficulty - b.question.difficulty; // Dễ nhất
        default:
          return 0;
      }
    });
  }, [history, sortOption]);

  const playClearSound = () => {
    if (isMuted || volume <= 0) return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      
      const ctx = new AudioContext();
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // "Swoosh" sound for clearing
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(600, t);
      osc.frequency.exponentialRampToValueAtTime(100, t + 0.3);

      gain.gain.setValueAtTime(0.15 * volume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    } catch (e) {}
  };

  const handleClearClick = () => {
    playClearSound();
    onClearHistory();
  };

  if (!isOpen) return null;

  // Thống kê nhanh
  const totalQuestions = history.length;
  const correctAnswers = history.filter(h => h.selectedAnswerIndex === h.question.correctAnswerIndex).length;
  const accuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-white w-full max-w-3xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-[scaleIn_0.2s_ease-out] border border-slate-200">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white z-20">
          <div>
            <h2 className="text-2xl font-bold font-serif text-amber-900 flex items-center gap-2">
              Lịch Sử Học Tập
            </h2>
            <div className="text-sm text-slate-500 mt-1 flex gap-3">
              <span>Đã làm: <b>{totalQuestions}</b> câu</span>
              <span className="text-slate-300">|</span>
              <span className={`${accuracy >= 80 ? 'text-green-600' : accuracy >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                Chính xác: <b>{accuracy}%</b>
              </span>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-700"
          >
            <X size={28} />
          </button>
        </div>

        {/* Toolbar / Filter */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap gap-2 items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-slate-500">
              <ArrowUpDown size={16} />
              <span className="text-xs font-bold uppercase tracking-wider">Sắp xếp:</span>
            </div>
            
            <div className="relative">
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
                className="appearance-none bg-white border border-slate-300 hover:border-indigo-400 text-slate-700 text-sm rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 block w-full pl-3 pr-8 py-2 outline-none cursor-pointer transition-all shadow-sm font-medium"
              >
                <option value="date_desc">Mới nhất trước</option>
                <option value="date_asc">Cũ nhất trước</option>
                <option value="difficulty_desc">Khó nhất trước</option>
                <option value="difficulty_asc">Dễ nhất trước</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
              </div>
            </div>
          </div>
          
          {history.length > 0 && (
             <button 
               onClick={handleClearClick}
               className="text-xs text-red-500 hover:text-red-700 font-medium hover:underline flex items-center gap-1 px-3 py-1.5 rounded hover:bg-red-50 transition-colors"
             >
               <Trash2 size={14} /> Xóa lịch sử
             </button>
          )}
        </div>
        
        {/* Content List */}
        <div className="overflow-y-auto p-5 space-y-4 flex-1 bg-slate-50/30">
          {sortedHistory.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <Calendar size={32} className="opacity-50" />
              </div>
              <p>Chưa có dữ liệu lịch sử.</p>
              <p className="text-sm">Hãy trả lời câu hỏi để lưu lại quá trình học!</p>
            </div>
          ) : (
            sortedHistory.map((item, idx) => {
              const isCorrect = item.selectedAnswerIndex === item.question.correctAnswerIndex;
              return (
                <div 
                  key={item.timestamp + idx} 
                  className={`relative bg-white rounded-xl p-0 shadow-sm border transition-all hover:shadow-md ${
                    isCorrect ? 'border-l-4 border-l-green-500 border-y-slate-200 border-r-slate-200' : 'border-l-4 border-l-red-500 border-y-slate-200 border-r-slate-200'
                  }`}
                >
                  <div className="p-5">
                    {/* Meta info row */}
                    <div className="flex justify-between items-start mb-2">
                       <div className="flex flex-wrap items-center gap-2">
                          <span className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wide ${
                             isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {isCorrect ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                            {isCorrect ? 'Đúng' : 'Sai'}
                          </span>
                          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {item.question.topic}
                          </span>
                          <span className="text-xs text-slate-400">
                            {new Date(item.timestamp).toLocaleDateString('vi-VN')} {new Date(item.timestamp).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}
                          </span>
                       </div>
                       <span className={`text-xs px-2 py-1 rounded font-bold border ${
                         item.question.difficulty <= 2 ? 'bg-green-50 text-green-700 border-green-100' :
                         item.question.difficulty <= 4 ? 'bg-yellow-50 text-yellow-700 border-yellow-100' :
                         'bg-red-50 text-red-700 border-red-100'
                       }`}>
                         Độ khó {item.question.difficulty}
                       </span>
                    </div>
                    
                    {/* Question */}
                    <h3 className="font-bold text-slate-800 mb-3 text-lg">{item.question.text}</h3>
                    
                    {/* Answers Comparison */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                      <div className={`p-3 rounded-lg border text-sm ${
                        isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                      }`}>
                        <span className="block text-xs font-bold opacity-70 mb-1 uppercase">Bạn chọn</span>
                        <span className={`font-semibold ${isCorrect ? 'text-green-800' : 'text-red-800 line-through'}`}>
                          {item.question.options[item.selectedAnswerIndex]}
                        </span>
                      </div>
                      
                      {!isCorrect && (
                        <div className="p-3 rounded-lg border bg-green-50 border-green-200 text-sm">
                          <span className="block text-xs font-bold text-green-700 opacity-70 mb-1 uppercase">Đáp án đúng</span>
                          <span className="font-semibold text-green-800">
                            {item.question.options[item.question.correctAnswerIndex]}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* Explanation */}
                    {item.question.explanation && (
                      <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <span className="font-bold text-slate-700 mr-1">💡 Giải thích:</span>
                        {item.question.explanation}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
           <button 
             onClick={onClose}
             className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg transition-all active:scale-95 shadow-lg shadow-slate-200"
           >
             Đóng
           </button>
        </div>
      </div>
    </div>
  );
};

export default HistoryModal;