import { Component } from 'react'
import { Link } from 'react-router-dom'

export default class GameErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[error-boundary]', error, info)
  }

  componentDidUpdate(prevProps) {
    // Reset error state when the route key changes
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null })
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="scanlines relative flex min-h-screen flex-col items-center justify-center gap-4 bg-arcadia-bg px-6 text-center text-white">
          <p className="font-arcade text-2xl text-neon-pink drop-shadow-[0_0_12px_rgba(255,0,110,0.55)]">
            ⚠ GAME CRASHED
          </p>
          <p className="max-w-sm text-sm text-white/60">
            Something broke. The error has been logged. Pop back to the lobby
            and try again.
          </p>
          {this.state.error?.message && (
            <p className="max-w-md break-words text-[10px] text-white/30">
              {String(this.state.error.message)}
            </p>
          )}
          <Link
            to="/"
            className="rounded-md border border-neon-green/70 bg-neon-green/10 px-5 py-2.5 font-arcade text-[11px] text-neon-green transition hover:bg-neon-green/20 hover:shadow-neon-green"
          >
            ▶ BACK TO LOBBY
          </Link>
        </div>
      )
    }
    return this.props.children
  }
}
