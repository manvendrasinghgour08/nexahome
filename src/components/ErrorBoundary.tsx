import { Component, type ErrorInfo, type ReactNode } from 'react';
import { BRAND } from '../core/brand';
import { STORAGE_KEY } from '../core/storage';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`${BRAND.name} crashed:`, error, info.componentStack);
  }

  private resetData = () => {
    if (!window.confirm(`Erase saved ${BRAND.name} data and restart with the sample home?`)) return;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage unavailable — reload anyway */
    }
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="crash">
        <h1>Something went wrong</h1>
        <p className="muted">{this.state.error.message}</p>
        <div className="row">
          <button className="btn primary" onClick={() => window.location.reload()}>Reload</button>
          <button className="btn danger" onClick={this.resetData}>Reset saved data</button>
        </div>
      </div>
    );
  }
}
