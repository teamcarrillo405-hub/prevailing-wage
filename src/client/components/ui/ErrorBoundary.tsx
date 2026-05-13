import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // No external error reporting needed
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center p-8 max-w-md">
            <AlertCircle size={40} className="text-red-500 mx-auto mb-4" />
            <h1 className="font-headline text-xl text-text-primary">
              Something went wrong
            </h1>
            <p className="text-sm text-text-secondary mb-6">
              {this.state.error?.message}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center font-semibold rounded-sm transition-all duration-150 text-sm px-4 py-2.5 bg-brand-gold text-black hover:bg-brand-gold/90 border border-transparent"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
