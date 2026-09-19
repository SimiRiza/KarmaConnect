import React, { useRef } from 'react';
import { UploadCloud, X } from 'lucide-react';

export const PhotoUploadPreview = ({ files = [], onFilesChange, maxFiles = 6 }) => {
  const inputRef = useRef(null);

  const handleFileChange = (event) => {
    const selected = Array.from(event.target.files || []);
    const nextFiles = [...files, ...selected].slice(0, maxFiles);
    onFilesChange(nextFiles);
    event.target.value = '';
  };

  const removeFile = (index) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">Photos</label>
        <span className="text-[11px] text-stone-500">{files.length}/{maxFiles}</span>
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex w-full cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-4 py-6 text-stone-600 transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
      >
        <UploadCloud className="h-6 w-6" />
        <span className="mt-2 text-sm font-medium">Upload images</span>
        <span className="text-[11px] text-stone-500">PNG, JPG, or WEBP</span>
      </button>

      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />

      {files.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {files.map((file, index) => {
            const previewUrl = typeof file === 'string' ? file : URL.createObjectURL(file);
            return (
              <div key={`${previewUrl}-${index}`} className="relative overflow-hidden rounded-2xl border border-stone-200 bg-white">
                <img src={previewUrl} alt="Upload preview" className="h-24 w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/80 text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PhotoUploadPreview;
