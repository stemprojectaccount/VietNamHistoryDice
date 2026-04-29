import React from 'react';
import { Difficulty } from '../types';
import { Trophy, Infinity as InfinityIcon } from 'lucide-react';

interface ProgressBarProps {
  currentQuestionIndex: number;
  totalQuestions: number;
  difficultyLevel: Difficulty;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ currentQuestionIndex, totalQuestions, difficultyLevel }) => {
  const isInfinity = difficultyLevel === Difficulty.INFINITY;
  
  // Calculate percentage
  // If infinity, we can just show a full bar or a pulsing bar
  const percentage = isInfinity ? 100 : Math.min(100, Math.max(0, (currentQuestionIndex / totalQuestions) * 100));

  return (
    <div className="w-full max-w-4xl px-4 py-2">
      <div className="flex justify-between items-end mb-2">
        <span className="text-sm font-bold text-slate-600 flex items-center gap-2">
          Tiến độ
        </span>
        <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 flex items-center gap-1">
          {isInfinity ? (
            <>
              <InfinityIcon size={14} /> Vô tận
            </>
          ) : (
            <>
              {currentQuestionIndex} / {totalQuestions} <Trophy size={14} className="text-amber-500 ml-1" />
            </>
          )}
        </span>
      </div>
      
      <div className="relative w-full h-3 bg-slate-200 rounded-full overflow-hidden shadow-inner">
        {isInfinity ? (
          <div className="absolute inset-0 bg-[length:30px_30px] bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)] bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 animate-[shimmer_2s_linear_infinite]"></div>
        ) : (
          <div 
            className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-700 ease-out relative"
            style={{ width: `${percentage}%` }}
          >
            <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)] bg-[length:20px_20px] animate-[shimmer_1s_linear_infinite]"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProgressBar;
