import React from 'react';
import { Evaluation } from '../../types';
import { getScoreColor } from '../../utils';

interface FeedbackDisplayProps {
  evaluation: Evaluation;
  onContinue?: () => void;
  showContinueButton?: boolean;
  compact?: boolean;
}

/**
 * Displays evaluation feedback with score, strengths, improvements, and better answer
 * Used by both Soft Skills and Technical Q&A modes
 */
const FeedbackDisplay: React.FC<FeedbackDisplayProps> = ({
  evaluation,
  onContinue,
  showContinueButton = true,
  compact = false,
}) => {
  const scoreColor = getScoreColor(evaluation.score);

  return (
    <div className={`space-y-${compact ? '3' : '4'} animate-fadeIn`}>
      {/* Score */}
      <div className="flex items-center gap-4">
        <div className={`text-4xl font-bold ${scoreColor.text}`}>
          {evaluation.score}/5
        </div>
        <div className="flex-1">
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full ${scoreColor.bar}`}
              style={{ width: `${(evaluation.score / 5) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Feedback Grid */}
      <div className={`grid grid-cols-1 ${compact ? '' : 'md:grid-cols-2'} gap-${compact ? '3' : '4'}`}>
        {/* Strengths */}
        <div className={`p-${compact ? '3' : '4'} bg-green-50 rounded-lg border border-green-100`}>
          <h3 className="text-sm font-bold text-green-800 mb-2 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Strengths
          </h3>
          <ul className="text-sm text-green-700 list-disc list-inside space-y-1">
            {evaluation.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>

        {/* Improvements */}
        <div className={`p-${compact ? '3' : '4'} bg-amber-50 rounded-lg border border-amber-100`}>
          <h3 className="text-sm font-bold text-amber-800 mb-2 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Improvements
          </h3>
          <ul className="text-sm text-amber-700 list-disc list-inside space-y-1">
            {evaluation.improvements.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Better Answer */}
      <div className={`bg-indigo-50 p-${compact ? '3' : '4'} rounded-lg border border-indigo-100`}>
        <h3 className="text-sm font-bold text-indigo-900 mb-2">Better Answer</h3>
        <p className="text-sm text-indigo-800 italic">"{evaluation.rewrittenAnswer}"</p>
      </div>

      {/* Evidence (if available) */}
      {evaluation.evidence && evaluation.evidence.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-slate-700 mb-2">Supporting Evidence</h3>
          <div className="space-y-2">
            {evaluation.evidence.map((ev, i) => (
              <div
                key={i}
                className="text-xs bg-slate-50 p-2 rounded border-l-2 border-slate-300 text-slate-600"
              >
                {ev.timestamp != null && (
                  <span className="font-mono font-bold mr-2 text-slate-400">
                    {new Date(ev.timestamp * 1000).toISOString().slice(14, 19)}
                  </span>
                )}
                {ev.text}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Continue Button */}
      {showContinueButton && onContinue && (
        <button
          onClick={onContinue}
          className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
        >
          Continue to Next Question
        </button>
      )}
    </div>
  );
};

export default FeedbackDisplay;
