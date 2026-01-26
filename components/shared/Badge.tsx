import React from 'react';

interface BadgeProps {
  text: string;
  color?: 'indigo' | 'emerald' | 'amber' | 'red' | 'green' | 'slate' | 'purple' | 'blue';
  size?: 'sm' | 'md';
  uppercase?: boolean;
  className?: string;
}

const colorMap = {
  indigo: 'text-indigo-600 bg-indigo-100',
  emerald: 'text-emerald-600 bg-emerald-100',
  amber: 'text-amber-700 bg-amber-100',
  red: 'text-red-700 bg-red-100',
  green: 'text-green-700 bg-green-100',
  slate: 'text-slate-600 bg-slate-200',
  purple: 'text-purple-700 bg-purple-100',
  blue: 'text-blue-700 bg-blue-100',
};

/**
 * Reusable badge component for labels and tags
 */
const Badge: React.FC<BadgeProps> = ({
  text,
  color = 'indigo',
  size = 'sm',
  uppercase = true,
  className = '',
}) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2 py-1 text-xs';
  
  return (
    <span
      className={`
        ${sizeClasses}
        font-bold rounded-md
        ${uppercase ? 'uppercase tracking-wide' : ''}
        ${colorMap[color]}
        ${className}
      `}
    >
      {text}
    </span>
  );
};

export default Badge;
