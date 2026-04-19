'use client';

import { useTheme } from './ThemeProvider';

// Fully static — zero JS effects, zero backdropfilter, zero animation
export function ThemeBackgrounds() {
  const { isCyberpunk } = useTheme();
  if (!isCyberpunk) return null;

  return (
    <>
      {/* Deep space sky */}
      <div className="hm-sky" aria-hidden="true" />
      {/* Horizon line */}
      <div className="hm-horizon" aria-hidden="true" />
      {/* Static SVG perspective grid floor */}
      <div className="hm-floor-wrap" aria-hidden="true">
        <div className="hm-floor" />
      </div>
    </>
  );
}
