/**
 * 从 vehicle-list 下的 fisheye_pts_0.25.txt / fisheye_pts_0.5.txt 生成
 * src/modules/parallel-driving-manager-ui/components/side-fisheye-pts.generated.ts
 */
const fs = require('fs')
const path = require('path')

const W = 960
const H = 768
const base = path.join(
  __dirname,
  '../src/modules/parallel-driving-manager-ui'
)
const outFile = path.join(base, 'components/side-fisheye-pts.generated.ts')

function parseTxt(filePath) {
  const t = fs.readFileSync(filePath, 'utf8').trim()
  const out = []
  let prev = null
  for (const line of t.split(/\r?\n/)) {
    if (!line.trim()) continue
    const parts = line.trim().split(/\s+/)
    const px = +parts[0]
    const py = +parts[1]
    const x = px / W
    const y = py / H
    const k = `${x.toFixed(8)},${y.toFixed(8)}`
    if (k !== prev) {
      out.push({ x, y })
      prev = k
    }
  }
  return out
}

function fmt(pts) {
  return pts
    .map((p) => `{ x: ${p.x.toFixed(9)}, y: ${p.y.toFixed(9)} }`)
    .join(',\n  ')
}

const p25 = parseTxt(path.join(base, 'views/vehicle-list/fisheye_pts_0.25.txt'))
const p5 = parseTxt(path.join(base, 'views/vehicle-list/fisheye_pts_0.5.txt'))

const header = `/**
 * 由标定文本生成，请勿手改。更新源文件后执行：
 *   node scripts/gen-side-fisheye-pts.cjs
 *
 * 源：views/vehicle-list/fisheye_pts_0.25.txt、fisheye_pts_0.5.txt（每行像素 x y）
 * 归一化：nx=x/${W}, ny=y/${H}；连续重复点已去重。
 */

`

const body = `export const SIDE_FISHEYE_025M_NORM = [
  ${fmt(p25)}
] as const

export const SIDE_FISHEYE_05M_NORM = [
  ${fmt(p5)}
] as const
`

fs.writeFileSync(outFile, header + body, 'utf8')
console.log('Wrote', outFile, '| 0.25m', p25.length, 'pts | 0.5m', p5.length, 'pts')
