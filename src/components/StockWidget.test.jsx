// @vitest-environment jsdom
// StockWidget integration tests with a routing fetch mock that decodes the
// proxy-chain URLs (fetchViaProxy tries /api/proxy -> allorigins -> corsproxy)
// and branches on the requested ticker symbol.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StockWidget from './StockWidget.jsx'

const ok = (body) => ({ ok: true, status: 200, json: async () => body })
const err = (status) => ({ ok: false, status, json: async () => ({}) })

// minimal Yahoo chart payload shape
const yahooBody = (price, prev, closes) => ({
  chart: {
    result: [
      {
        meta: { regularMarketPrice: price, chartPreviousClose: prev },
        indicators: { quote: [{ close: closes }] }
      }
    ]
  }
})

// mount always also fetches the fixed index header row
const BASE_HANDLERS = {
  NVDA: () => ok(yahooBody(111.23, 100, [100, 105, 111.23])),
  '^FTSE': () => ok(yahooBody(8021.5, 7990, [7990, 8021.5])),
  '^GSPC': () => ok(yahooBody(5432.1, 5400, [5400, 5432.1])),
  default: () => err(404)
}

// handler(proxyIndex, symbol) -> Response-like (or throws to simulate a network failure)
function installFetch(extra = {}) {
  const handlers = { ...BASE_HANDLERS, ...extra }
  const mock = vi.fn(async (reqUrl) => {
    const url = String(reqUrl)
    const proxyIndex = url.startsWith('/api/proxy') ? 0 : url.includes('allorigins') ? 1 : 2
    const encoded = (url.match(/url=([^&]+)/) ?? [])[1] ?? ''
    const target = decodeURIComponent(encoded)
    const symbol = (target.match(/\/chart\/([^?]+)/) ?? [])[1] ?? ''
    const handler = handlers[symbol] ?? handlers.default
    return handler(proxyIndex, symbol)
  })
  vi.stubGlobal('fetch', mock)
  return mock
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('dashboard_stockTickers', '["NVDA"]')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('StockWidget', () => {
  it('renders a quote row for the stored ticker', async () => {
    installFetch()
    render(<StockWidget />)
    expect(await screen.findByText('NVDA')).toBeInTheDocument()
    expect(await screen.findByText('$111.23')).toBeInTheDocument()
    // +11.23 on 100 prev -> +11.23%
    expect(screen.getByText(/\+11\.23%/)).toBeInTheDocument()
  })

  it('adds a valid ticker: row appears and it is persisted', async () => {
    installFetch({ MSFT: () => ok(yahooBody(222.5, 220, [220, 221, 222.5])) })
    const user = userEvent.setup()
    render(<StockWidget />)
    await screen.findByText('NVDA')

    await user.type(screen.getByLabelText('Add ticker'), 'MSFT')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByText('MSFT')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('dashboard_stockTickers'))).toEqual(['NVDA', 'MSFT'])
  })

  it('rejects an unknown ticker (404 on every proxy) and does not persist it', async () => {
    installFetch() // default handler 404s ZZZZ on all three proxies
    const user = userEvent.setup()
    render(<StockWidget />)
    await screen.findByText('NVDA')

    await user.type(screen.getByLabelText('Add ticker'), 'ZZZZ')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByText('"ZZZZ" not found — check the symbol')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('dashboard_stockTickers'))).toEqual(['NVDA'])
  })

  it('treats an OK response with an empty chart.result as invalid, not a network error', async () => {
    installFetch({ EMPT: () => ok({ chart: { result: null } }) })
    const user = userEvent.setup()
    render(<StockWidget />)
    await screen.findByText('NVDA')

    await user.type(screen.getByLabelText('Add ticker'), 'EMPT')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByText('"EMPT" not found — check the symbol')).toBeInTheDocument()
    expect(screen.queryByText(/Network error/)).not.toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('dashboard_stockTickers'))).toEqual(['NVDA'])
  })

  it('shows the network-error copy when every proxy rejects, and does not persist', async () => {
    installFetch({
      NETF: () => {
        throw new Error('socket hang up')
      }
    })
    const user = userEvent.setup()
    render(<StockWidget />)
    await screen.findByText('NVDA')

    await user.type(screen.getByLabelText('Add ticker'), 'NETF')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByText("Network error — couldn't reach Yahoo, try again")).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('dashboard_stockTickers'))).toEqual(['NVDA'])
  })

  it('falls back along the proxy chain: first proxy 500, second OK -> add succeeds', async () => {
    installFetch({
      FBK: (proxyIndex) => (proxyIndex === 0 ? err(500) : ok(yahooBody(50.5, 49, [49, 50.5])))
    })
    const user = userEvent.setup()
    render(<StockWidget />)
    await screen.findByText('NVDA')

    await user.type(screen.getByLabelText('Add ticker'), 'FBK')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByText('FBK')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('dashboard_stockTickers'))).toEqual(['NVDA', 'FBK'])
  })

  it('rejects a duplicate add inline without any extra fetches', async () => {
    const mock = installFetch()
    const user = userEvent.setup()
    render(<StockWidget />)
    await screen.findByText('$111.23')

    const callsBefore = mock.mock.calls.length
    await user.type(screen.getByLabelText('Add ticker'), 'NVDA')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByText('NVDA is already on the list')).toBeInTheDocument()
    expect(mock.mock.calls.length).toBe(callsBefore) // zero extra fetches
    expect(JSON.parse(localStorage.getItem('dashboard_stockTickers'))).toEqual(['NVDA'])
  })
})
