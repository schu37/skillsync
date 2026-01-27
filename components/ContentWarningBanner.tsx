import React from 'react';
import { ContentWarning } from '../types';

interface ContentWarningBannerProps {
  warning: ContentWarning;
  compact?: boolean;
}

/**
 * Displays a warning banner when AI detects suspicious, misleading, or unsafe content
 */
const ContentWarningBanner: React.FC<ContentWarningBannerProps> = ({ warning, compact = false }) => {
  if (!warning.hasConcerns) {
    return null;
  }

  const getWarningIcon = () => {
    if (warning.isMisinformation) return '🚫';
    if (warning.isUnsafe) return '⚠️';
    if (warning.isSuspicious) return '🔍';
    return '⚠️';
  };

  const getWarningColor = () => {
    if (warning.isMisinformation) return 'bg-red-50 border-red-200 text-red-800';
    if (warning.isUnsafe) return 'bg-orange-50 border-orange-200 text-orange-800';
    if (warning.isSuspicious) return 'bg-amber-50 border-amber-200 text-amber-800';
    return 'bg-amber-50 border-amber-200 text-amber-800';
  };

  const getWarningType = () => {
    const types: string[] = [];
    if (warning.isMisinformation) types.push('Potential Misinformation');
    if (warning.isUnsafe) types.push('Safety Concerns');
    if (warning.isSuspicious) types.push('Suspicious Content');
    return types.join(' • ') || 'Content Warning';
  };

  if (compact) {
    return (
      <div className={`px-3 py-2 rounded-lg border flex items-center gap-2 text-sm ${getWarningColor()}`}>
        <span className="text-lg">{getWarningIcon()}</span>
        <span className="font-medium">{getWarningType()}</span>
      </div>
    );
  }

  return (
    <div className={`p-4 rounded-xl border-2 ${getWarningColor()}`}>
      <div className="flex items-start gap-3">
        <div className="text-2xl flex-shrink-0">{getWarningIcon()}</div>
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-base">{getWarningType()}</h3>
            <span className="text-xs px-2 py-0.5 bg-white/50 rounded-full font-medium">
              AI-detected concerns
            </span>
          </div>
          
          {warning.concerns.length > 0 && (
            <ul className="text-sm space-y-1">
              {warning.concerns.map((concern, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-current opacity-50">•</span>
                  <span>{concern}</span>
                </li>
              ))}
            </ul>
          )}
          
          {warning.recommendation && (
            <div className="flex items-start gap-2 mt-2 pt-2 border-t border-current/20">
              <span className="text-sm">💡</span>
              <p className="text-sm font-medium">{warning.recommendation}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContentWarningBanner;
