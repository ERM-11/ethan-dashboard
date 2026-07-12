import '@testing-library/jest-dom/vitest'

// Node >= 23 ships a built-in globalThis.localStorage that is method-less
// unless --localstorage-file is set. When vitest populates the jsdom globals
// it skips keys already present on globalThis, so the broken Node stub
// shadows jsdom's real Storage. Replace it with an actual jsdom Storage so
// component tests exercise the same API the browser provides.
if (typeof window !== 'undefined' && typeof window.localStorage?.clear !== 'function') {
  const { JSDOM } = await import('jsdom')
  const win = new JSDOM('', { url: 'http://localhost/' }).window
  for (const key of ['localStorage', 'sessionStorage']) {
    Object.defineProperty(globalThis, key, { value: win[key], configurable: true, writable: true })
  }
}
