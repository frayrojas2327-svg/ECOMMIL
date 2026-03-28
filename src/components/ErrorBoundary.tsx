import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      let errorMessage = "Ha ocurrido un error inesperado.";
      let isFirebaseError = false;

      try {
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed.error && parsed.authInfo) {
            errorMessage = `Error de base de datos: ${parsed.error}`;
            isFirebaseError = true;
          }
        }
      } catch (e) {
        // Not a JSON error
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center space-y-6 shadow-2xl shadow-neon/5">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border border-red-500/20">
              <AlertTriangle className="text-red-500" size={32} />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-display font-bold text-white tracking-tight">
                Oops! Algo salió mal
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                {errorMessage}
              </p>
              {isFirebaseError && (
                <p className="text-[10px] text-slate-500 font-mono mt-2">
                  Por favor, contacta a soporte si el problema persiste.
                </p>
              )}
            </div>

            <button
              onClick={this.handleReset}
              className="w-full flex items-center justify-center gap-2 bg-neon text-background font-bold py-3 rounded-xl hover:opacity-90 transition-all active:scale-95"
            >
              <RefreshCcw size={18} />
              Reiniciar Aplicación
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
