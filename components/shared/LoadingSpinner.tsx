import React from 'react';

interface LoadingSpinnerProps {
  message?: string;
  subMessage?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Reusable loading spinner with optional message
 */
const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message = 'Loading...',
  subMessage,
  size = 'md',
}) => {
  const sizeClasses = {
    sm: 'w-6 h-6 border-2',
    md: 'w-8 h-8 border-4',
    lg: 'w-12 h-12 border-4',
  };

  return (
    <div className="flex flex-col items-center justify-center gap-3 p-8">
      <div
        className={`${sizeClasses[size]} border-indigo-500 border-t-transparent rounded-full animate-spin`}
      />
      {message && (
        <p className="font-medium text-lg text-slate-700">{message}</p>
      )}
      {subMessage && (
        <p className="text-sm text-slate-500">{subMessage}</p>
      )}
    </div>
  );
};

export default LoadingSpinner;
