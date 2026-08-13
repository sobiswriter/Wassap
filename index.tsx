import React, { Component, ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
}

class AppErrorBoundary extends Component<Props, State> {
  props: Readonly<Props>;
  state: Readonly<State>;

  constructor(props: Props) {
    super(props);
    this.props = props;
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught application startup error:", error, errorInfo);
  }

  handleReset = () => {
    try {
      // Non-destructive soft reload that preserves user chats, personas, and settings
      sessionStorage.clear();
    } catch (e) {
      console.error("Session clear warning:", e);
    }
    window.location.href = window.location.origin + window.location.pathname;
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
          <button
            onClick={this.handleReset}
            className="px-6 py-2.5 bg-[#00a884] hover:bg-[#008f6f] text-white font-semibold rounded-lg shadow-lg transition-colors cursor-pointer"
          >
            Reload App Cleanly
          </button>
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

