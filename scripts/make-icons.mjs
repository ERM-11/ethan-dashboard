// Generates PWA icons: dark rounded square with a 2x3 grid of blue "dashboard tiles".
import { PNG } from 'pngjs'
import fs from 'node:fs'
import path from 'node:path'

const BG = [15, 23, 42] // #0f172a
const BLUE = [59, 130, 246] // #3b82f6

function inRoundedRect(x, y, x0, y0, w, h, r) {
  if (x < x0 || y < y0 || x >= x0 + w || y >= y0 + h) return false
  const cx = Math.max(x0 + r, Math.min(x, x0 + w - r))
  const cy = Math.max(y0 + r, Math.min(y, y0 + h - r))
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r || (x >= x0 + r && x < x0 + w - r) || (y >= y0 + r && y < y0 + h - r)
}

function makeIcon(size, { maskable = false } = {}) {
  const png = new PNG({ width: size, height: size })
  // maskable: background fills to edge; content confined to centre 80%
  const pad = maskable ? 0 : Math.round(size * 0.04)
  const bgR = maskable ? 0 : Math.round(size * 0.18)
  const content = maskable ? 0.8 : 0.92
  const cSize = size * content
  const cOff = (size - cSize) / 2
  // tile grid: 2 cols x 3 rows inside content area
  const gap = cSize * 0.07
  const tw = (cSize - 3 * gap) / 2
  const th = (cSize - 4 * gap) / 3
  const tiles = []
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 2; c++)
      tiles.push([cOff + gap + c * (tw + gap), cOff + gap + r * (th + gap), tw, th])
  const tileR = tw * 0.18

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (size * y + x) << 2
      let rgb = null
      let alpha = 255
      if (maskable || inRoundedRect(x, y, pad, pad, size - 2 * pad, size - 2 * pad, bgR)) {
        rgb = BG
        for (const [tx, ty, w, h] of tiles) {
          if (inRoundedRect(x, y, tx, ty, w, h, tileR)) { rgb = BLUE; break }
        }
      } else {
        alpha = 0
        rgb = [0, 0, 0]
      }
      png.data[i] = rgb[0]; png.data[i + 1] = rgb[1]; png.data[i + 2] = rgb[2]; png.data[i + 3] = alpha
    }
  }
  return PNG.sync.write(png)
}

const out = path.resolve('public/icons')
fs.mkdirSync(out, { recursive: true })
fs.writeFileSync(path.join(out, 'icon-192.png'), makeIcon(192))
fs.writeFileSync(path.join(out, 'icon-512.png'), makeIcon(512))
fs.writeFileSync(path.join(out, 'icon-maskable-512.png'), makeIcon(512, { maskable: true }))
console.log('icons written to', out)
