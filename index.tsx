import React, { Component, ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class AppErrorBoundary extends Component<Props, State> {
  props: Readonly<Props>;
  state: Readonly<State>;

  constructor(props: Props) {
    super(props);
    this.props = props;
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught application startup error:", error, errorInfo);
  }

  handleReset = async () => {
    try {
      // Non-destructive soft reload that preserves user chats, personas, and settings
      sessionStorage.clear();
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.update();
        }
      }
    } catch (e) {
      console.error("Session clear warning:", e);
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-[#111b21] text-white p-6 text-center select-none font-sans">
          <div className="w-16 h-16 rounded-full bg-[#25d366]/20 flex items-center justify-center mb-4 text-[#25d366]">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
          <p className="text-sm text-gray-400 max-w-sm mb-6 leading-relaxed">
            Wassap encountered a temporary error. Your chats and data are safely saved. Click below to reload.
          </p>
          <div className="flex gap-3">
            <button
              onClick={this.handleReset}
              className="px-6 py-2.5 bg-[#00a884] hover:bg-[#008f6f] text-white font-semibold rounded-lg shadow-lg transition-colors cursor-pointer"
            >
              Reload App Cleanly
            </button>
          </div>
          {this.state.error && (
            <details className="mt-6 text-left max-w-md w-full bg-black/30 rounded-lg p-3 text-xs text-red-400 font-mono overflow-auto max-h-40 border border-white/10 select-text">
              <summary className="cursor-pointer text-gray-400 font-sans text-xs mb-1 hover:text-white">Error Details</summary>
              <div>{this.state.error.name}: {this.state.error.message}</div>
              {this.state.error.stack && <pre className="mt-1 text-[10px] text-gray-500 whitespace-pre-wrap">{this.state.error.stack}</pre>}
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

// Global safety net for unhandled async rejections and background errors
window.addEventListener('unhandledrejection', (event) => {
  console.warn('Global unhandled promise rejection caught safely:', event.reason);
});

window.addEventListener('error', (event) => {
  console.warn('Global uncaught exception caught safely:', event.error);
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
);

// Register Service Worker for PWA / Mobile Notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        console.log('SW registered:', reg);
        reg.update(); // Keep service worker updated cleanly
      })
      .catch(err => console.error('SW registration failed:', err));
  });
}

