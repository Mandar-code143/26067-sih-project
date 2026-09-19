import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[INCOIS ErrorBoundary] Uncaught rendering error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100vw',
            height: '100vh',
            background: '#020610',
            color: '#f8fafc',
            fontFamily: 'system-ui, sans-serif',
            gap: '1.5rem',
            padding: '2rem',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(244, 63, 94, 0.1)',
              border: '1px solid rgba(244, 63, 94, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AlertTriangle style={{ width: '32px', height: '32px', color: '#f43f5e' }} />
          </div>

          <div>
            <h1
              style={{
                fontSize: '1.25rem',
                fontWeight: '900',
                letterSpacing: '0.1em',
                color: '#f8fafc',
                marginBottom: '0.5rem',
                textTransform: 'uppercase',
              }}
            >
              Rendering Engine Error
            </h1>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', maxWidth: '480px', lineHeight: '1.6' }}>
              The 3D ocean visualization encountered a critical WebGL or component error.
              This is usually caused by an unsupported GPU driver or an expired Cesium ion session token.
            </p>
            {this.state.errorMessage && (
              <p
                style={{
                  marginTop: '0.75rem',
                  fontSize: '0.7rem',
                  fontFamily: 'monospace',
                  color: '#f43f5e',
                  background: 'rgba(244, 63, 94, 0.08)',
                  border: '1px solid rgba(244, 63, 94, 0.2)',
                  borderRadius: '0.5rem',
                  padding: '0.5rem 1rem',
                  maxWidth: '540px',
                  wordBreak: 'break-all',
                }}
              >
                {this.state.errorMessage}
              </p>
            )}
          </div>

          <button
            onClick={() => window.location.reload()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.6rem 1.5rem',
              background: '#0284c7',
              color: 'white',
              fontWeight: '700',
              fontSize: '0.8rem',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              boxShadow: '0 0 20px rgba(2, 132, 199, 0.4)',
            }}
          >
            <RotateCcw style={{ width: '14px', height: '14px' }} />
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
