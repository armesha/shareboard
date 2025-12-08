import { Component, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  title?: string;
  retryLabel?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 gap-4 bg-white text-center">
          <div className="text-xl font-semibold text-red-600">
            {this.props.title || 'Something went wrong'}
          </div>
          {this.state.error?.message && (
            <div className="text-sm text-gray-600 max-w-lg break-words">
              {this.state.error.message}
            </div>
          )}
          <button
            onClick={this.handleReload}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            {this.props.retryLabel || 'Reload page'}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
