import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    if (import.meta.env.DEV) {
      console.error('NiaCare ErrorBoundary caught an error:', error, errorInfo);
    }
    // In production this could be sent to an observability service.
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="min-h-screen flex items-center justify-center nc-bg nc-text p-6">
          <div className="max-w-sm w-full text-center space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
              </svg>
            </div>
            <h1 className="text-lg font-black text-slate-900 dark:text-white">Something went wrong</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              NiaCare ran into an unexpected issue. Please refresh the page or try again.
            </p>
            {this.state.error && import.meta.env.DEV && (
              <pre className="text-[10px] text-left bg-slate-100 dark:bg-slate-900 p-3 rounded-xl overflow-auto max-h-40 text-slate-600 dark:text-slate-400">
                {this.state.error.message}
              </pre>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-2 px-5 py-2.5 rounded-xl nc-btn-primary"
            >
              Reload NiaCare
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
