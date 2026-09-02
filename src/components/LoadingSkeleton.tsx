import React from 'react';

interface LoadingSkeletonProps {
  rows?: number;
  className?: string;
}

// Reusable list-loading placeholder — replaces the several modals this
// session that showed nothing at all while `loading` was true (confirmed
// during QA screenshots: blank space, not a real loading state). Respects
// prefers-reduced-motion via the global rule in index.css (animation
// durations collapse to ~0 there, so this degrades to a static placeholder
// rather than a spinning/pulsing one).
export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({ rows = 3, className = '' }) => (
  <div className={`space-y-2 ${className}`} aria-busy="true" aria-live="polite">
    {Array.from({ length: rows }).map((_, i) => (
      <div
        key={i}
        className="rounded-xl border border-slate-100 dark:border-slate-800 p-3 animate-pulse"
      >
        <div className="h-3 w-2/5 rounded bg-slate-200 dark:bg-slate-700 mb-2" />
        <div className="h-2.5 w-3/5 rounded bg-slate-100 dark:bg-slate-800" />
      </div>
    ))}
  </div>
);
