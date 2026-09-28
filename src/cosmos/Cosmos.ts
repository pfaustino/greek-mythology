import { realmFamily, realmLabel } from '../data/labels.ts'
import type { Family, MythEvent, Realm } from '../data/types.ts'

type RGB = [number, number, number]

type Look = {
  skyTop: RGB
  skyMid: RGB
  horizon: RGB
  sea: RGB
  seaDeep: RGB
  under: RGB
  ridge: RGB
  horizonY: number
  mountain: number
  seaAmp: number
  star: number
  below: number
  gold: number
}

type Star = { x: number; y: number; r: number; phase: number; speed: number }
type Mark = { event: MythEvent; x: number; y: number }

const FAMILY_LOOK: Record<Family, Look> = {
  void: {
    skyTop: [4, 6, 14],
    skyMid: [18, 22, 48],
    horizon: [92, 32, 44],
    sea: [16, 36, 62],
    seaDeep: [6, 14, 28],
    under: [12, 6, 12],
    ridge: [18, 14, 22],
    horizonY: 0.72,
    mountain: 0.55,
    seaAmp: 8,
    star: 0.7,
    below: 0.05,
    gold: 0.4,
  },
  sky: {
    skyTop: [3, 8, 20],
    skyMid: [14, 32, 64],
    horizon: [120, 42, 48],
    sea: [12, 48, 74],
    seaDeep: [5, 16, 36],
    under: [10, 8, 16],
    ridge: [28, 22, 32],
    horizonY: 0.7,
    mountain: 1,
    seaAmp: 8,
    star: 1,
    below: 0,
    gold: 1,
  },
  land: {
    skyTop: [5, 10, 24],
    skyMid: [18, 34, 58],
    horizon: [98, 38, 42],
    sea: [10, 42, 66],
    seaDeep: [5, 16, 32],
    under: [10, 8, 14],
    ridge: [30, 24, 28],
    horizonY: 0.68,
    mountain: 0.72,
    seaAmp: 10,
    star: 0.88,
    below: 0.02,
    gold: 0.72,
  },
  sea: {
    skyTop: [3, 10, 24],
    skyMid: [8, 36, 66],
    horizon: [64, 28, 52],
    sea: [14, 58, 88],
    seaDeep: [4, 20, 46],
    under: [8, 10, 20],
    ridge: [14, 22, 36],
    horizonY: 0.5,
    mountain: 0.34,
    seaAmp: 16,
    star: 0.9,
    below: 0,
    gold: 0.5,
  },
  below: {
    skyTop: [12, 5, 10],
    skyMid: [46, 14, 18],
    horizon: [82, 24, 26],
    sea: [36, 12, 16],
    seaDeep: [12, 4, 8],
    under: [52, 14, 12],
    ridge: [16, 10, 12],
    horizonY: 0.42,
    mountain: 0.16,
    seaAmp: 4,
    star: 0.3,
    below: 1,
    gold: 0.6,
  },
}

function lookFor(realm: Realm): Look {
  const base = FAMILY_LOOK[realmFamily(realm)]
  if (realm === 'tartarus') {
    return {
      ...base,
      skyTop: [6, 3, 8],
      skyMid: [28, 6, 12],
      horizon: [64, 12, 16],
      under: [36, 6, 8],
      below: 1,
      star: 0.16,
      gold: 0.4,
    }
  }
  return { ...base }
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

function mixLook(a: Look, b: Look, t: number): Look {
  return {
    skyTop: mix(a.skyTop, b.skyTop, t),
    skyMid: mix(a.skyMid, b.skyMid, t),
    horizon: mix(a.horizon, b.horizon, t),
    sea: mix(a.sea, b.sea, t),
    seaDeep: mix(a.seaDeep, b.seaDeep, t),
    under: mix(a.under, b.under, t),
    ridge: mix(a.ridge, b.ridge, t),
    horizonY: a.horizonY + (b.horizonY - a.horizonY) * t,
    mountain: a.mountain + (b.mountain - a.mountain) * t,
    seaAmp: a.seaAmp + (b.seaAmp - a.seaAmp) * t,
    star: a.star + (b.star - a.star) * t,
    below: a.below + (b.below - a.below) * t,
    gold: a.gold + (b.gold - a.gold) * t,
  }
}

function css(c: RGB, alpha = 1): string {
  return `rgba(${c[0] | 0}, ${c[1] | 0}, ${c[2] | 0}, ${alpha})`
}

function mulberry32(seed: number): () => number {
  let state = seed
  return () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const MAX_STARS = 220

export class Cosmos {
  private readonly ctx: CanvasRenderingContext2D
  private readonly stars: Star[] = []
  private readonly marks: Mark[] = []
  private events: MythEvent[] = []
  private width = 1
  private height = 1
  private dpr = 1
  private time = 0
  private playFraction = 0
  private fromLook: Look = FAMILY_LOOK.void
  private toLook: Look = FAMILY_LOOK.void
  private blend = 1
  private blendMs = 800
  private fromFamily: Family = 'void'
  private toFamily: Family = 'void'
  private fromRealm: Realm = 'chaos'
  private toRealm: Realm = 'chaos'
  private focusedId = ''
  private noise: HTMLCanvasElement
  private readonly reduceMotion: boolean
  private readonly canvas: HTMLCanvasElement

  onPick: ((event: MythEvent) => void) | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas unavailable')
    this.ctx = ctx
    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    this.noise = makeNoise()
    this.seedStars()
    this.resize()
    window.addEventListener('resize', () => this.resize())
    canvas.addEventListener('click', (event) => this.onClick(event))
  }

  setEvents(events: MythEvent[]): void {
    this.events = events
    const first = events[0]
    if (!first) return
    const look = lookFor(first.realm)
    this.fromLook = look
    this.toLook = look
    this.fromFamily = realmFamily(first.realm)
    this.toFamily = this.fromFamily
    this.fromRealm = first.realm
    this.toRealm = first.realm
    this.blend = 1
  }

  focus(event: MythEvent, travelMs: number): void {
    this.fromLook = this.currentLook()
    this.toLook = lookFor(event.realm)
    this.fromFamily = this.blend < 0.5 ? this.fromFamily : this.toFamily
    this.fromRealm = this.blend < 0.5 ? this.fromRealm : this.toRealm
    this.toFamily = realmFamily(event.realm)
    this.toRealm = event.realm
    this.blend = 0
    this.blendMs = Math.max(420, travelMs)
    this.focusedId = event.id
  }

  setPlayhead(order: number, start: number, end: number): void {
    const span = end - start
    this.playFraction = span <= 0 ? 0 : Math.min(1, Math.max(0, (order - start) / span))
  }

  update(dtMs: number): void {
    const step = this.reduceMotion ? dtMs * 0.35 : dtMs
    this.time += step / 1000
    if (this.blend < 1) {
      const rate = this.reduceMotion ? 2.4 : 1
      this.blend = Math.min(1, this.blend + (dtMs * rate) / this.blendMs)
    }
  }

  draw(): void {
    const ctx = this.ctx
    const look = this.currentLook()
    const w = this.width
    const h = this.height
    const horizon = this.horizonLine(look)
    const amp = this.reduceMotion ? look.seaAmp * 0.35 : look.seaAmp

    ctx.clearRect(0, 0, w, h)
    this.drawSky(look, horizon)
    this.drawMilkyWay(look)
    this.drawStars(look, horizon)
    this.drawSign(look)
    if (look.mountain > 0.04) this.drawRidge(look, horizon)
    this.drawLandmark(look, horizon)
    this.drawSea(look, horizon, amp)
    if (look.below > 0.04) this.drawBelow(look, horizon)
    this.drawArc(look)
    this.drawMarks(look)
    this.drawTraveler(look)
    this.drawInscription(look, horizon)
    this.drawVignette()
    ctx.save()
    ctx.globalAlpha = 0.14
    const pattern = ctx.createPattern(this.noise, 'repeat')
    if (pattern) {
      ctx.fillStyle = pattern
      ctx.fillRect(0, 0, w, h)
    }
    ctx.restore()
  }

  private currentLook(): Look {
    return mixLook(this.fromLook, this.toLook, ease(this.blend))
  }

  /** Shoreline stays above the control rail. Lower realms pull that line upward. */
  private horizonLine(look: Look): number {
    const t = Math.min(1, Math.max(0, (look.horizonY - 0.42) / 0.3))
    return this.height * (0.36 + t * 0.22)
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect()
    this.dpr = Math.min(2, window.devicePixelRatio || 1)
    this.width = Math.max(1, rect.width)
    this.height = Math.max(1, rect.height)
    this.canvas.width = Math.floor(this.width * this.dpr)
    this.canvas.height = Math.floor(this.height * this.dpr)
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
  }

  private seedStars(): void {
    const rand = mulberry32(47)
    this.stars.length = 0
    for (let i = 0; i < MAX_STARS; i += 1) {
      this.stars.push({
        x: rand(),
        y: Math.pow(rand(), 0.72) * 0.78,
        r: rand() < 0.08 ? 1.7 + rand() * 0.8 : 0.4 + rand() * 1.1,
        phase: rand() * Math.PI * 2,
        speed: 0.4 + rand() * 1.6,
      })
    }
  }

  private drawSky(look: Look, horizon: number): void {
    const ctx = this.ctx
    const sky = ctx.createLinearGradient(0, 0, 0, this.height)
    sky.addColorStop(0, css(look.skyTop))
    sky.addColorStop(0.45, css(look.skyMid))
    sky.addColorStop(Math.min(0.92, horizon / this.height), css(look.horizon))
    sky.addColorStop(1, css(look.seaDeep))
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, this.width, this.height)
  }

  private drawMilkyWay(look: Look): void {
    const ctx = this.ctx
    ctx.save()
    ctx.translate(this.width * 0.58, this.height * 0.22)
    ctx.rotate(-0.5)
    const band = ctx.createRadialGradient(0, 0, 10, 0, 0, this.width * 0.46)
    band.addColorStop(0, `rgba(243, 230, 196, ${0.07 * look.star})`)
    band.addColorStop(0.45, `rgba(180, 150, 190, ${0.035 * look.star})`)
    band.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = band
    ctx.fillRect(-this.width, -this.height, this.width * 2, this.height * 2)
    ctx.restore()
  }

  private drawStars(look: Look, horizon: number): void {
    const ctx = this.ctx
    const drift = this.time * 1.6
    for (let i = 0; i < this.stars.length; i += 1) {
      const star = this.stars[i]
      const y = star.y * horizon
      if (y > horizon - 8) continue
      const twinkle = this.reduceMotion ? 0.75 : 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(this.time * star.speed + star.phase))
      const x = ((star.x * this.width + drift * (0.15 + star.r * 0.05)) % this.width + this.width) % this.width
      ctx.globalAlpha = twinkle * look.star
      ctx.fillStyle = star.r > 1.6 ? '#f6e7c1' : '#d5def2'
      ctx.beginPath()
      ctx.arc(x, y, star.r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  private drawSign(look: Look): void {
    const family = this.blend < 0.5 ? this.fromFamily : this.toFamily
    const alpha = (this.blend < 0.5 ? 1 - this.blend * 2 : (this.blend - 0.5) * 2) * 0.55 * look.gold
    const ctx = this.ctx
    ctx.save()
    ctx.translate(this.width * 0.5, this.height * 0.2)
    ctx.strokeStyle = `rgba(228, 197, 106, ${alpha})`
    ctx.fillStyle = `rgba(243, 230, 196, ${alpha})`
    ctx.lineWidth = 1.2
    if (family === 'sky' || family === 'void') this.strokeBolt()
    else if (family === 'sea') this.strokeTrident()
    else if (family === 'below') this.strokePomegranate()
    else this.strokeLaurel()
    ctx.restore()
  }

  private strokeBolt(): void {
    const ctx = this.ctx
    ctx.beginPath()
    ctx.moveTo(-8, -36)
    ctx.lineTo(10, -6)
    ctx.lineTo(-2, -6)
    ctx.lineTo(12, 36)
    ctx.lineTo(-14, 2)
    ctx.lineTo(0, 2)
    ctx.closePath()
    ctx.stroke()
  }

  private strokeTrident(): void {
    const ctx = this.ctx
    ctx.beginPath()
    ctx.moveTo(0, -34)
    ctx.lineTo(0, 28)
    ctx.moveTo(-22, -16)
    ctx.quadraticCurveTo(-16, -34, 0, -34)
    ctx.quadraticCurveTo(16, -34, 22, -16)
    ctx.moveTo(-16, -28)
    ctx.lineTo(-16, -8)
    ctx.moveTo(16, -28)
    ctx.lineTo(16, -8)
    ctx.stroke()
  }

  private strokePomegranate(): void {
    const ctx = this.ctx
    ctx.beginPath()
    ctx.arc(0, 4, 16, 0, Math.PI * 2)
    ctx.moveTo(0, -12)
    ctx.lineTo(-6, -24)
    ctx.moveTo(0, -12)
    ctx.lineTo(6, -22)
    ctx.stroke()
  }

  private strokeLaurel(): void {
    const ctx = this.ctx
    ctx.beginPath()
    ctx.arc(-10, 8, 22, -0.4, 1.3)
    ctx.arc(10, 8, 22, Math.PI - 1.3, Math.PI + 0.4)
    ctx.stroke()
  }

  private drawRidge(look: Look, horizon: number): void {
    const ctx = this.ctx
    const base = horizon + 8
    const lift = this.height * 0.24 * look.mountain
    ctx.beginPath()
    ctx.moveTo(0, this.height)
    const steps = 90
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps
      ctx.lineTo(t * this.width, base - ridgeAt(t) * lift)
    }
    ctx.lineTo(this.width, this.height)
    ctx.closePath()
    ctx.fillStyle = css(look.ridge, 0.95)
    ctx.fill()

    ctx.beginPath()
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps
      const x = t * this.width
      const y = base - ridgeAt(t) * lift
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = `rgba(243, 220, 160, ${0.55 * look.gold})`
    ctx.lineWidth = 1.4
    ctx.stroke()
  }

  private drawLandmark(look: Look, horizon: number): void {
    const realm = this.blend < 0.5 ? this.fromRealm : this.toRealm
    const alpha = this.blend < 0.5 ? 1 - this.blend * 2 : (this.blend - 0.5) * 2
    if (alpha < 0.05) return
    const ctx = this.ctx
    ctx.save()
    ctx.globalAlpha = alpha
    const y = horizon - 6
    if (realm === 'troy') this.drawWalls(this.width * 0.62, y)
    else if (realm === 'athens') this.drawTemple(this.width * 0.3, y)
    else if (realm === 'crete') this.drawMaze(this.width * 0.68, y - 18)
    else if (realm === 'thebes') this.drawGates(this.width * 0.34, y)
    else if (realm === 'colchis') this.drawFleece(this.width * 0.72, y - 28, look)
    else if (realm === 'delphi') this.drawCleft(this.width * 0.5, y, look)
    else if (realm === 'ithaca') this.drawHall(this.width * 0.28, y)
    else if (realmFamily(realm) === 'sea') this.drawShip(horizon, look)
    ctx.restore()
  }

  private drawWalls(x: number, y: number): void {
    const ctx = this.ctx
    ctx.fillStyle = '#1a120f'
    ctx.fillRect(x, y - 36, 120, 40)
    ctx.beginPath()
    for (let i = 0; i < 6; i += 1) {
      ctx.rect(x + i * 20, y - 48, 12, 14)
    }
    ctx.fill()
    ctx.fillStyle = 'rgba(228, 197, 106, 0.85)'
    ctx.fillRect(x + 18, y - 30, 4, 4)
    ctx.fillRect(x + 78, y - 26, 4, 4)
  }

  private drawTemple(x: number, y: number): void {
    const ctx = this.ctx
    ctx.strokeStyle = 'rgba(232, 214, 176, 0.8)'
    ctx.fillStyle = '#16120f'
    ctx.lineWidth = 1.3
    ctx.beginPath()
    ctx.moveTo(x, y - 28)
    ctx.lineTo(x + 54, y - 28)
    ctx.lineTo(x + 64, y - 14)
    ctx.lineTo(x - 10, y - 14)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    for (let i = 0; i < 5; i += 1) {
      ctx.fillRect(x + i * 12, y - 14, 3, 16)
    }
  }

  private drawMaze(x: number, y: number): void {
    const ctx = this.ctx
    ctx.strokeStyle = 'rgba(196, 148, 74, 0.9)'
    ctx.lineWidth = 1.4
    for (let i = 0; i < 4; i += 1) {
      const inset = i * 7
      ctx.strokeRect(x + inset, y + inset, 56 - inset * 2, 46 - inset * 2)
    }
  }

  private drawGates(x: number, y: number): void {
    const ctx = this.ctx
    ctx.fillStyle = '#140e0c'
    ctx.fillRect(x, y - 28, 150, 32)
    ctx.fillStyle = '#070504'
    for (let i = 0; i < 7; i += 1) ctx.fillRect(x + 8 + i * 20, y - 22, 8, 18)
  }

  private drawFleece(x: number, y: number, look: Look): void {
    const ctx = this.ctx
    const glow = ctx.createRadialGradient(x, y, 2, x, y, 36)
    glow.addColorStop(0, `rgba(255, 226, 140, ${0.9 * look.gold})`)
    glow.addColorStop(1, 'rgba(255, 200, 80, 0)')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(x, y, 36, 0, Math.PI * 2)
    ctx.fill()
  }

  private drawCleft(x: number, y: number, look: Look): void {
    const ctx = this.ctx
    const vapor = ctx.createLinearGradient(x, y - 70, x, y)
    vapor.addColorStop(0, 'rgba(220, 210, 190, 0)')
    vapor.addColorStop(1, `rgba(220, 210, 190, ${0.35 * look.gold})`)
    ctx.fillStyle = vapor
    ctx.beginPath()
    ctx.moveTo(x - 18, y)
    ctx.quadraticCurveTo(x, y - 80, x + 18, y)
    ctx.fill()
  }

  private drawHall(x: number, y: number): void {
    const ctx = this.ctx
    ctx.fillStyle = '#16110e'
    ctx.fillRect(x, y - 22, 70, 24)
    ctx.beginPath()
    ctx.moveTo(x - 6, y - 22)
    ctx.lineTo(x + 35, y - 40)
    ctx.lineTo(x + 76, y - 22)
    ctx.fill()
  }

  private drawShip(horizon: number, look: Look): void {
    const ctx = this.ctx
    const x = ((this.time * 18) % (this.width + 140)) - 70
    const y = horizon + 28 + Math.sin(this.time * 0.8) * 3
    ctx.fillStyle = `rgba(8, 14, 22, ${0.85})`
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + 54, y)
    ctx.lineTo(x + 42, y + 12)
    ctx.lineTo(x + 12, y + 12)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = `rgba(228, 197, 106, ${0.45 * look.gold})`
    ctx.beginPath()
    ctx.moveTo(x + 28, y)
    ctx.lineTo(x + 28, y - 28)
    ctx.lineTo(x + 48, y - 4)
    ctx.lineTo(x + 28, y - 4)
    ctx.stroke()
  }

  private drawSea(look: Look, horizon: number, amp: number): void {
    const ctx = this.ctx
    const bands = 5
    for (let layer = 0; layer < bands; layer += 1) {
      const depth = layer / (bands - 1)
      const color = mix(look.sea, look.seaDeep, depth)
      const y0 = horizon + layer * 14
      ctx.beginPath()
      ctx.moveTo(0, this.height)
      const step = 12
      for (let x = 0; x <= this.width; x += step) {
        const wave =
          Math.sin(x * 0.01 + this.time * (0.7 + layer * 0.15) + layer) * amp * (1 - depth * 0.45) +
          Math.sin(x * 0.02 - this.time * 0.45 + layer * 2) * amp * 0.35
        ctx.lineTo(x, y0 + wave)
      }
      ctx.lineTo(this.width, this.height)
      ctx.closePath()
      ctx.fillStyle = css(color, 0.92)
      ctx.fill()
    }
    ctx.strokeStyle = `rgba(232, 206, 160, ${0.18 + look.gold * 0.12})`
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, horizon + 2)
    ctx.lineTo(this.width, horizon + 2)
    ctx.stroke()
  }

  private drawBelow(look: Look, horizon: number): void {
    const ctx = this.ctx
    const veil = ctx.createLinearGradient(0, horizon - 20, 0, this.height)
    veil.addColorStop(0, 'rgba(0, 0, 0, 0)')
    veil.addColorStop(0.35, css(look.under, 0.25 * look.below))
    veil.addColorStop(1, css(look.under, 0.92 * look.below))
    ctx.fillStyle = veil
    ctx.fillRect(0, horizon - 30, this.width, this.height)
    const riverY = this.height * 0.86
    ctx.strokeStyle = `rgba(212, 120, 64, ${0.45 * look.below})`
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let x = 0; x <= this.width; x += 10) {
      const y = riverY + Math.sin(x * 0.02 + this.time) * 6
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
    if ((this.toRealm === 'tartarus' || this.fromRealm === 'tartarus') && look.below > 0.45) {
      ctx.strokeStyle = `rgba(176, 140, 82, ${0.28 * look.below})`
      ctx.lineWidth = 1.1
      const y0 = horizon + 18
      for (let i = 0; i < 4; i += 1) {
        const x = this.width * (0.18 + i * 0.2)
        ctx.beginPath()
        ctx.moveTo(x, y0)
        ctx.bezierCurveTo(x + 12, y0 + 36, x - 16, y0 + 78, x + 4, y0 + 120)
        ctx.stroke()
      }
    }
  }

  private arcPoint(t: number, look: Look): { x: number; y: number } {
    const rightPad = this.width > 860 ? Math.min(430, this.width * 0.32) : this.width * 0.08
    const leftPad = this.width * 0.07
    const x = leftPad + t * (this.width - leftPad - rightPad)
    const crest = Math.sin(Math.PI * t) * this.height * -0.06
    const y = this.height * (0.24 + look.below * 0.08) + crest
    return { x, y }
  }

  private drawArc(look: Look): void {
    const ctx = this.ctx
    ctx.beginPath()
    for (let i = 0; i <= 60; i += 1) {
      const point = this.arcPoint(i / 60, look)
      if (i === 0) ctx.moveTo(point.x, point.y)
      else ctx.lineTo(point.x, point.y)
    }
    ctx.strokeStyle = `rgba(228, 197, 106, ${0.18 + look.gold * 0.12})`
    ctx.lineWidth = 1
    ctx.stroke()
  }

  private drawMarks(look: Look): void {
    this.marks.length = 0
    if (this.events.length === 0) return
    const start = this.events[0].order
    const end = this.events[this.events.length - 1].order
    const span = Math.max(1, end - start)
    const ctx = this.ctx
    for (let i = 0; i < this.events.length; i += 1) {
      const event = this.events[i]
      const point = this.arcPoint((event.order - start) / span, look)
      this.marks.push({ event, x: point.x, y: point.y })
      const active = event.id === this.focusedId
      ctx.fillStyle = active ? '#f6e2a8' : 'rgba(232, 214, 176, 0.75)'
      ctx.beginPath()
      ctx.arc(point.x, point.y, active ? 3.2 : 1.7, 0, Math.PI * 2)
      ctx.fill()
      if (active) {
        const pulse = this.reduceMotion ? 0.6 : 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(this.time * 3))
        ctx.strokeStyle = `rgba(228, 197, 106, ${0.35 + 0.45 * pulse})`
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.arc(point.x, point.y, 9 + pulse * 7, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
  }

  private drawTraveler(look: Look): void {
    const point = this.arcPoint(this.playFraction, look)
    const ctx = this.ctx
    const glow = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, 18)
    glow.addColorStop(0, `rgba(255, 236, 190, ${0.85 * look.gold})`)
    glow.addColorStop(1, 'rgba(255, 220, 140, 0)')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(point.x, point.y, 18, 0, Math.PI * 2)
    ctx.fill()
  }

  private drawInscription(look: Look, horizon: number): void {
    const realm = this.blend < 0.55 ? this.fromRealm : this.toRealm
    const ctx = this.ctx
    ctx.save()
    ctx.font = '500 13px Cinzel, Palatino, "Palatino Linotype", serif'
    ctx.textAlign = 'center'
    ctx.fillStyle = `rgba(243, 230, 196, ${0.42 + look.gold * 0.35})`
    ctx.fillText(realmLabel(realm).toUpperCase(), this.width / 2, Math.max(36, horizon - 22))
    ctx.restore()
  }

  private drawVignette(): void {
    const ctx = this.ctx
    const vignette = ctx.createRadialGradient(
      this.width / 2,
      this.height * 0.45,
      this.width * 0.2,
      this.width / 2,
      this.height * 0.45,
      this.width * 0.72,
    )
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)')
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.48)')
    ctx.fillStyle = vignette
    ctx.fillRect(0, 0, this.width, this.height)
  }

  private onClick(event: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    let best: Mark | null = null
    let bestDist = 18
    for (let i = 0; i < this.marks.length; i += 1) {
      const mark = this.marks[i]
      const dist = Math.hypot(mark.x - x, mark.y - y)
      if (dist < bestDist) {
        best = mark
        bestDist = dist
      }
    }
    if (best) this.onPick?.(best.event)
  }
}

function ridgeAt(t: number): number {
  const peaks: Array<[number, number, number]> = [
    [0.5, 1, 5.4],
    [0.4, 0.72, 11],
    [0.61, 0.78, 12],
    [0.3, 0.48, 14],
    [0.73, 0.5, 13],
    [0.2, 0.28, 16],
    [0.84, 0.3, 15],
  ]
  let height = 0
  for (let i = 0; i < peaks.length; i += 1) {
    const center = peaks[i][0]
    const amp = peaks[i][1]
    const sharp = peaks[i][2]
    const delta = (t - center) * sharp
    height += Math.exp(-(delta * delta)) * amp
  }
  return height
}

function ease(t: number): number {
  return t * t * (3 - 2 * t)
}

function makeNoise(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 160
  canvas.height = 160
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  const image = ctx.createImageData(160, 160)
  const rand = mulberry32(99)
  for (let i = 0; i < image.data.length; i += 4) {
    const shade = 200 + rand() * 55
    image.data[i] = shade
    image.data[i + 1] = shade
    image.data[i + 2] = shade
    image.data[i + 3] = 46
  }
  ctx.putImageData(image, 0, 0)
  return canvas
}
