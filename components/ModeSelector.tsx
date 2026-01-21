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
  const presets = skillMode === 'soft' ? SOFT_SKILL_PRESETS : TECHNICAL_PROJECT_TYPES;

  return (
    <div className="flex flex-col gap-3">
      {/* Mode Toggle */}
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-slate-600">Mode:</label>
        <div className="flex bg-slate-100 rounded-lg p-1">
          {(Object.keys(SKILL_MODES) as SkillMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => !disabled && onModeChange(mode)}
              disabled={disabled}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all
                ${skillMode === mode 
                  ? 'bg-white text-slate-900 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'}
                ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
              `}
            >
              <span>{SKILL_MODES[mode].icon}</span>
              <span className="hidden sm:inline">{SKILL_MODES[mode].label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Preset Dropdown */}
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
          <option value="">Auto-detect from video</option>
          {presets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.icon} {preset.label}
            </option>
          ))}
        </select>
      </div>

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
