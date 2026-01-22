import React, { useState, useEffect } from 'react';

interface DisclaimerModalProps {
  onAccept: () => void;
}

const CONSENT_KEY = 'skillsync_terms_accepted';
const CONSENT_VERSION = '1.0'; // Increment this to force re-acceptance

export const hasAcceptedTerms = (): boolean => {
  try {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) return false;
    const { version } = JSON.parse(stored);
    return version === CONSENT_VERSION;
  } catch {
    return false;
  }
};

export const acceptTerms = (): void => {
  localStorage.setItem(CONSENT_KEY, JSON.stringify({
    version: CONSENT_VERSION,
    acceptedAt: new Date().toISOString(),
  }));
};

const DisclaimerModal: React.FC<DisclaimerModalProps> = ({ onAccept }) => {
  const [checked, setChecked] = useState({
    terms: false,
    privacy: false,
    aiDisclaimer: false,
  });

  const allChecked = checked.terms && checked.privacy && checked.aiDisclaimer;

  const handleAccept = () => {
    if (allChecked) {
      acceptTerms();
      onAccept();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-indigo-500 to-purple-500">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Welcome to SkillSync</h2>
              <p className="text-sm text-white/80">Please review and accept before continuing</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          {/* AI Disclaimer - Most Important */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-amber-800 mb-1">AI-Generated Content Disclaimer</h3>
                <p className="text-sm text-amber-700 mb-3">
                  SkillSync uses artificial intelligence (Google Gemini) to analyze videos and generate educational content. 
                  <strong> AI may produce inaccurate, incomplete, or misleading information.</strong>
                </p>
                <ul className="text-xs text-amber-600 space-y-1 mb-3">
                  <li>• Questions, answers, and feedback are AI-generated and may contain errors</li>
                  <li>• Technical instructions should be verified with official sources</li>
                  <li>• Do not rely on AI advice for safety-critical decisions</li>
                  <li>• Always use your own judgment and consult professionals when needed</li>
                </ul>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked.aiDisclaimer}
                    onChange={(e) => setChecked({ ...checked, aiDisclaimer: e.target.checked })}
                    className="w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500"
                  />
                  <span className="text-sm font-medium text-amber-800">
                    I understand AI may make mistakes and I will verify important information
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Terms of Service */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-slate-800 mb-1">Terms of Service</h3>
                <p className="text-sm text-slate-600 mb-2">
                  By using SkillSync, you agree to use the service responsibly and acknowledge that:
                </p>
                <ul className="text-xs text-slate-500 space-y-1 mb-3">
                  <li>• The service is provided "as is" without warranties</li>
                  <li>• You will not use the service for harmful or illegal purposes</li>
                  <li>• SkillSync is not liable for any damages from use of this service</li>
                </ul>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked.terms}
                      onChange={(e) => setChecked({ ...checked, terms: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-slate-700">I agree to the Terms of Service</span>
                  </label>
                  <a
                    href="/terms"
                    target="_blank"
                    className="text-xs text-indigo-600 hover:text-indigo-800 underline"
                  >
                    Read full terms →
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Privacy Policy */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-slate-800 mb-1">Privacy Policy</h3>
                <p className="text-sm text-slate-600 mb-2">
                  We respect your privacy. Here's what we collect:
                </p>
                <ul className="text-xs text-slate-500 space-y-1 mb-3">
                  <li>• YouTube URLs you analyze (stored locally in your browser)</li>
                  <li>• Your answers and scores (stored locally, not on our servers)</li>
                  <li>• Google account info only if you use Google Docs export</li>
                </ul>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked.privacy}
                      onChange={(e) => setChecked({ ...checked, privacy: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-slate-700">I agree to the Privacy Policy</span>
                  </label>
                  <a
                    href="/privacy"
                    target="_blank"
                    className="text-xs text-indigo-600 hover:text-indigo-800 underline"
                  >
                    Read full policy →
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50">
          <button
            onClick={handleAccept}
            disabled={!allChecked}
            className={`w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
              allChecked
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg hover:shadow-xl'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {allChecked ? (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Continue to SkillSync
              </>
            ) : (
              'Please accept all terms to continue'
            )}
          </button>
          <p className="text-xs text-center text-slate-500 mt-2">
            Built for Google Gemini Hackathon 2026
          </p>
        </div>
      </div>
    </div>
  );
};

export default DisclaimerModal;
