import React from 'react';
import { SkillMode } from '../types';
import { 
  SKILL_MODES, 
  SOFT_SKILL_PRESETS, 
  TECHNICAL_PROJECT_TYPES 
} from '../constants';

interface ModeSelectorProps {
  skillMode: SkillMode;
  onModeChange: (mode: SkillMode) => void;
  selectedPreset: string;
  onPresetChange: (preset: string) => void;
  disabled?: boolean;
}

const ModeSelector: React.FC<ModeSelectorProps> = ({
  skillMode,
  onModeChange,
  selectedPreset,
  onPresetChange,
  disabled = false,
}) => {
  const presets = skillMode === 'soft' ? SOFT_SKILL_PRESETS : skillMode === 'technical' ? TECHNICAL_PROJECT_TYPES : [];

  return (
    <div className="space-y-3">
      {/* Mode Toggle */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-slate-700">Learning Mode:</span>
        <div className="flex flex-wrap gap-1 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => onModeChange('soft')}
            disabled={disabled}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              skillMode === 'soft'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-200'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            💬 Soft Skills
          </button>
          <button
            onClick={() => onModeChange('technical')}
            disabled={disabled}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              skillMode === 'technical'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-200'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            🔧 Technical
          </button>
          <button
            onClick={() => onModeChange('others')}
            disabled={disabled}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              skillMode === 'others'
                ? 'bg-slate-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-200'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            📺 General
          </button>
        </div>
      </div>

      {/* Preset Dropdown - hide for 'others' mode */}
      {skillMode !== 'others' && (
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-600">
            {skillMode === 'soft' ? 'Scenario:' : 'Project:'}
          </label>
          <select
            value={selectedPreset}
            onChange={(e) => onPresetChange(e.target.value)}
            disabled={disabled}
            className={`
              flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm
              focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none
              ${disabled ? 'cursor-not-allowed opacity-50 bg-slate-50' : ''}
            `}
          >
            <option value="">Select a {skillMode === 'soft' ? 'scenario' : 'project type'}...</option>
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.icon} {preset.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Mode Description */}
      <p className="text-xs text-slate-500 mt-1">
        {SKILL_MODES[skillMode].description}
        {skillMode === 'technical' && (
          <span className="ml-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-medium">
            BETA
          </span>
        )}
      </p>
    </div>
  );
};

export default ModeSelector;
