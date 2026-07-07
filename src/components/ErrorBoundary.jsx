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
      <section className="bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 shadow-lg p-4 flex flex-col gap-2">
        <h2 className="font-display font-semibold text-sm uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {this.props.name || 'Widget'}
        </h2>
        <p className="text-sm text-slate-800 dark:text-slate-200">⚠️ This widget encountered an error</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono break-all">{String(this.state.error?.message || this.state.error)}</p>
        <button
          onClick={() => this.setState({ error: null })}
          className="self-start mt-1 bg-blue-500 hover:bg-blue-400 text-white rounded-lg px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
        >
          Reload widget
        </button>
      </section>
    )
  }
}
