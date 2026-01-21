import React, { useState } from 'react';
import { TechnicalLessonPlan } from '../types';

interface SafetyBannerProps {
  plan: TechnicalLessonPlan;
  onAcknowledge?: () => void;
}

const SafetyBanner: React.FC<SafetyBannerProps> = ({ plan, onAcknowledge }) => {
  const [acknowledged, setAcknowledged] = useState(false);

  if (acknowledged) return null;

  const handleAcknowledge = () => {
    setAcknowledged(true);
    onAcknowledge?.();
  };

  return (
    <div className="bg-slate-50 border border-slate-200 p-4 mb-4 rounded-lg">
      <div className="flex items-start gap-3">
        <span className="text-2xl">⚠️</span>
        <div className="flex-1">
          <h4 className="font-bold text-slate-800 mb-2">Before You Begin</h4>
          
          <p className="text-slate-600 text-sm mb-3">
            This guide is AI-generated for educational purposes only. 
            Instructions may contain errors or omissions. Always:
          </p>
          
          <ul className="text-slate-600 text-sm mb-3 list-disc list-inside space-y-1">
            <li>Verify instructions against manufacturer documentation</li>
            <li>Use appropriate safety equipment for your project</li>
            <li>Seek adult supervision or professional guidance when needed</li>
            <li>Stop if something doesn't seem right</li>
          </ul>

          {plan.safetyOverview && (
            <p className="text-slate-700 text-sm mb-3 bg-white p-2 rounded border border-slate-100">
              <strong>AI Notes:</strong> {plan.safetyOverview}
            </p>
          )}

          {plan.requiredPrecautions && plan.requiredPrecautions.length > 0 && (
            <div className="mb-3 bg-white p-2 rounded border border-slate-100">
              <strong className="text-slate-700 text-sm">AI-Suggested Precautions:</strong>
              <ul className="text-slate-600 text-sm mt-1 list-disc list-inside space-y-0.5">
                {plan.requiredPrecautions.map((precaution, i) => (
                  <li key={i}>{precaution}</li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={handleAcknowledge}
            className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            I understand, proceed at my own risk
          </button>
          
          <p className="text-slate-400 text-xs mt-3">
            By continuing, you acknowledge that you are responsible for your own safety.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SafetyBanner;
