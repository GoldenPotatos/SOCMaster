import React from 'react';
import RapidFireDrill from '@/components/RapidFireDrill';

export default function RapidResponsePage() {
  return (
    <div className="min-h-screen bg-[#080010] flex flex-col items-center justify-center p-6 text-neutral-200">
      <div className="w-full max-w-4xl">
        <h1 className="text-2xl font-bold mb-8 text-center hm-logo-text tracking-[0.2em] uppercase">
          Rapid-Fire Drill Module
        </h1>
        <RapidFireDrill />
      </div>
    </div>
  );
}
