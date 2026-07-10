import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, info) {
    console.error('widget crashed:', this.props.name, error, info)
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <section className="bg-card rounded-2xl border border-line p-4 flex flex-col gap-2">
        <h2 className="font-display font-semibold text-xs uppercase tracking-[0.12em] text-mut">
          {this.props.name || 'Widget'}
        </h2>
        <p className="text-sm text-ink">This widget encountered an error</p>
        <p className="text-xs text-mut font-mono break-all">{String(this.state.error?.message || this.state.error)}</p>
        <button
          onClick={() => this.setState({ error: null })}
          className="self-start mt-1 bg-card2 border border-line text-ink rounded-lg px-3 py-2 min-h-[44px] text-sm font-medium press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 ring-offset-bg"
        >
          Reload widget
        </button>
      </section>
    )
  }
}
