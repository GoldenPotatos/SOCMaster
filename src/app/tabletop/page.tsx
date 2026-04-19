import React from 'react';

export default function TabletopPage() {
  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-6 text-neutral-200">
      <div className="border border-neutral-800 rounded-3xl bg-neutral-900/40 backdrop-blur-xl p-12 flex flex-col items-center justify-center shadow-2xl max-w-lg text-center">
        <svg className="w-12 h-12 text-purple-500 mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <h1 className="text-xl font-bold tracking-wide">Internal Tabletop Module Initializing...</h1>
        <p className="text-sm text-neutral-500 mt-4">Establishing environment constraints and fetching playbooks.</p>
      </div>
    </div>
  );
}
