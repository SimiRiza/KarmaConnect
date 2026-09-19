import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

/**
 * RepeatableFieldList — manages a list of string-value rows.
 * Props:
 *   items: string[]
 *   onChange: (newItems: string[]) => void
 *   placeholder: string
 *   addLabel: string
 *   maxItems: number (default 20)
 */
const RepeatableFieldList = ({
  items = [],
  onChange,
  placeholder = 'Enter value',
  addLabel = 'Add Item',
  maxItems = 20,
}) => {
  const handleChange = (idx, value) => {
    const updated = [...items];
    updated[idx] = value;
    onChange(updated);
  };

  const handleAdd = () => {
    if (items.length >= maxItems) return;
    onChange([...items, '']);
  };

  const handleRemove = (idx) => {
    const updated = items.filter((_, i) => i !== idx);
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      {items.map((item, idx) => (
        <div key={idx} className="flex gap-2 items-center">
          <input
            type="text"
            value={item}
            onChange={(e) => handleChange(idx, e.target.value)}
            placeholder={placeholder}
            className="flex-1 border border-stone-200 rounded-xl px-3 py-2 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition"
          />
          <button
            type="button"
            onClick={() => handleRemove(idx)}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-red-100 text-red-400 hover:bg-red-50 hover:text-red-600 transition"
            title="Remove"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

      {items.length < maxItems && (
        <button
          type="button"
          onClick={handleAdd}
          className="flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-800 transition"
        >
          <Plus className="w-4 h-4" />
          {addLabel}
        </button>
      )}
    </div>
  );
};

export default RepeatableFieldList;
