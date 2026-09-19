import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, ArrowLeft, Sparkles } from 'lucide-react';

export const DiscoverPlaceholder = () => {
  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-lg w-full bg-white rounded-3xl p-8 sm:p-10 border border-stone-200 shadow-sm text-center space-y-6">
        <div className="w-16 h-16 rounded-3xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto border border-brand-100">
          <Compass className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Coming in Prompt 2 & 3</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight">
            Discover Local Impact Projects
          </h1>
          <p className="text-stone-600 text-sm leading-relaxed">
            The interactive problem map, cause filters, and neighborhood project feeds are being integrated in the upcoming prompts.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/"
            className="px-6 py-3 rounded-xl border border-stone-300 hover:bg-stone-50 text-stone-700 font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </Link>
          <Link
            to="/signup"
            className="px-6 py-3 rounded-xl bg-accent-500 hover:bg-accent-600 text-white font-bold text-sm transition-colors shadow-sm"
          >
            Join the Network
          </Link>
        </div>
      </div>
    </div>
  );
};

export default DiscoverPlaceholder;
