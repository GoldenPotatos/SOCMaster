import React from 'react';

export default function IntelDrillsPage() {
  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-6 text-neutral-200">
      <div className="border border-neutral-800 rounded-3xl bg-neutral-900/40 backdrop-blur-xl p-12 flex flex-col items-center justify-center shadow-2xl max-w-lg text-center">
        <svg className="w-12 h-12 text-orange-500 mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
        <h1 className="text-xl font-bold tracking-wide">In-the-Wild Module Initializing...</h1>
        <p className="text-sm text-neutral-500 mt-4">Aggregating threat intelligence feeds and preparing sandbox.</p>
      </div>
    </div>
  );
}
