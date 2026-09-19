import React, { useState } from 'react';

export const SkillsChipInput = ({ label, value = [], onChange, placeholder = 'Add a skill' }) => {
  const [input, setInput] = useState('');

  const addTag = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const next = [...value, trimmed];
    onChange(next);
    setInput('');
  };

  const removeTag = (tagToRemove) => {
    onChange(value.filter((tag) => tag !== tagToRemove));
  };

  return (
    <div className="space-y-2">
      {label && <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">{label}</label>}
      <div className="flex flex-wrap gap-2 rounded-xl border border-stone-300 bg-stone-50 px-2 py-2">
        {value.map((item) => (
          <button
            type="button"
            key={item}
            onClick={() => removeTag(item)}
            className="rounded-full bg-brand-100 px-2.5 py-1 text-xs font-semibold text-brand-800 border border-brand-200"
          >
            {item} ×
          </button>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              addTag();
            }
          }}
          placeholder={placeholder}
          className="min-w-[120px] flex-1 border-0 bg-transparent px-2 py-1 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none"
        />
      </div>
    </div>
  );
};

export default SkillsChipInput;
