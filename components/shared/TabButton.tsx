import React from 'react';

interface TabButtonProps {
  id: string;
  label: string;
  icon: string;
  isActive: boolean;
  onClick: () => void;
  count?: number;
  className?: string;
}

/**
 * Reusable tab button component with icon, label, and optional count badge
 */
const TabButton: React.FC<TabButtonProps> = ({
  id,
  label,
  icon,
  isActive,
  onClick,
  count,
  className = '',
}) => {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-1.5 px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium whitespace-nowrap
        border-b-2 transition-colors flex-shrink-0
        ${isActive
          ? 'border-indigo-500 text-indigo-600'
          : 'border-transparent text-slate-500 hover:text-slate-700'}
        ${className}
      `}
    >
      <span>{icon}</span>
      <span className="hidden sm:inline">{label}</span>
      {count !== undefined && (
        <span className="px-1.5 py-0.5 text-xs bg-slate-200 text-slate-600 rounded-full">
          {count}
        </span>
      )}
    </button>
  );
};

export default TabButton;
