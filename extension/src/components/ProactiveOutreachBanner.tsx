import React, { useState } from 'react';

export default function ProactiveOutreachBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="bg-orange-50 border-b border-orange-200 px-4 py-3 flex items-start gap-3">
      <div className="flex-shrink-0 mt-0.5">
        <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-orange-800">Support available</p>
        <p className="text-xs text-orange-700 mt-0.5">
          Mission Control has noticed you may need some support. Here are some resources.
        </p>
        <div className="mt-2 flex gap-2">
          <a
            href="#"
            className="text-xs font-medium text-orange-600 hover:text-orange-700 underline"
            onClick={(e) => e.preventDefault()}
          >
            Talk to a Culture Champion
          </a>
          <span className="text-orange-300">·</span>
          <a
            href="#"
            className="text-xs font-medium text-orange-600 hover:text-orange-700 underline"
            onClick={(e) => e.preventDefault()}
          >
            Browse resources
          </a>
        </div>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="flex-shrink-0 text-orange-400 hover:text-orange-600 transition"
        aria-label="Dismiss"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
