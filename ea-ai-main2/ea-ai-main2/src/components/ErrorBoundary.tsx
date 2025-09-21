import * as React from 'react';
import { toast } from 'sonner';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorId: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { 
      hasError: false,
      errorId: Date.now().toString()
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { 
      hasError: true, 
      error,
      errorId: Date.now().toString()
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Attempt to clear corrupted state from localStorage
    this.clearCorruptedState();
    
    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
    
    // Show user-friendly error notification
    toast.error('Application error detected. Attempting to recover...');
  }

  clearCorruptedState = () => {
    try {
      // Clear session-related localStorage that might be corrupted
      const keysToCheck = ['taskai_current_session_id'];
      
      keysToCheck.forEach(key => {
        try {
          const value = localStorage.getItem(key);
          if (value) {
            console.log(`🧹 Clearing potentially corrupted state: ${key}`);
            localStorage.removeItem(key);
          }
        } catch (error) {
          console.warn(`Failed to clear localStorage key ${key}:`, error);
        }
      });
    } catch (error) {
      console.warn('Failed to clear corrupted state:', error);
    }
  }

  resetError = () => {
    console.log('🔄 Resetting error boundary state');
    
    // Clear any remaining corrupted state
    this.clearCorruptedState();
    
    // Reset component state
    this.setState({ 
      hasError: false, 
      error: undefined,
      errorId: Date.now().toString()
    });
    
    // Show recovery notification
    toast.success('Application recovered. Please try your action again.');
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default enhanced error UI
      return (
        <div className="min-h-screen flex items-center justify-center p-8">
          <div className="text-center space-y-4 max-w-md">
            <div className="w-16 h-16 mx-auto bg-destructive/10 rounded-full flex items-center justify-center">
              <span className="text-2xl">⚠️</span>
            </div>
            <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
            <p className="text-muted-foreground">
              An unexpected error occurred. We've attempted to recover your session automatically.
            </p>
            <div className="space-y-2">
              <button
                onClick={this.resetError}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                Continue
              </button>
              <button
                onClick={() => window.location.reload()}
                className="block mx-auto px-4 py-2 bg-muted text-muted-foreground rounded-md hover:bg-muted/80 transition-colors text-sm"
              >
                Reload Page
              </button>
            </div>
            <div className="mt-4 p-3 bg-muted rounded text-xs text-left">
              <details>
                <summary className="cursor-pointer font-medium">Error Details</summary>
                <pre className="mt-2 whitespace-pre-wrap break-words">
                  {this.state.error?.message}
                  {'\n\nError ID: ' + this.state.errorId}
                </pre>
              </details>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}