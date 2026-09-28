import { synthesizeEdgeTts } from './edgeTts.ts'

export type NarrationHold = 'wait' | 'spoken' | 'unread' | 'stop'

export class Narrator {
  enabled = true
  onHold: ((state: NarrationHold) => void) | null = null
  onProgress: ((fraction: number) => void) | null = null
  private readonly player = new Audio()
  private objectUrl: string | null = null
  private abort: AbortController | null = null
  private generation = 0
  private lastText = ''
  private paused = false
  private estimateRaf = 0
  private estimateStarted = 0
  private estimateMs = 0
  private pauseStarted = 0
  /** True only while the current clip is actually playing, so teardown events do not end the next line. */
  private livePlayback = false
  /** Browser speech was cancelled because recorded audio took over. */
  private handedOff = false
  private unlocked = false
  private keepAlive = 0

  constructor() {
    this.player.hidden = true
    this.player.setAttribute('playsinline', '')
    document.body.appendChild(this.player)
    this.player.addEventListener('ended', () => {
      if (!this.livePlayback) return
      this.livePlayback = false
      this.onProgress?.(1)
      this.hold('spoken')
    })
    this.player.addEventListener('timeupdate', () => {
      if (!this.livePlayback || this.paused || this.player.duration <= 0) return
      this.onProgress?.(this.player.currentTime / this.player.duration)
    })
    this.player.addEventListener('error', () => {
      if (!this.livePlayback) return
      this.livePlayback = false
      if (this.lastText) this.speakBrowser(this.lastText, this.generation)
      else this.hold('unread')
    })
    const unlock = () => {
      if (this.unlocked) return
      this.unlocked = true
      const silent = new Audio(
        'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=',
      )
      void silent.play().catch(() => {})
      if (this.enabled && this.lastText && !this.paused) this.speak(this.lastText)
    }
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (!enabled) this.cancel()
  }

  pause(): void {
    if (!this.paused) this.pauseStarted = performance.now()
    this.paused = true
    this.player.pause()
    window.speechSynthesis?.pause()
  }

  resume(): void {
    if (!this.enabled) return
    if (this.pauseStarted) {
      this.estimateStarted += performance.now() - this.pauseStarted
      this.pauseStarted = 0
    }
    this.paused = false
    if (this.player.src && !this.player.ended) {
      void this.player.play()
      this.hold('wait')
    }
    window.speechSynthesis?.resume()
  }

  speak(text: string): void {
    this.lastText = text
    this.paused = false
    this.stopPlayback()
    if (!this.enabled || !text) {
      this.hold('unread')
      return
    }
    const generation = (this.generation += 1)
    this.handedOff = false
    this.hold('wait')
    // Speak at once. The recorded voice replaces this only if it arrives quickly.
    this.speakBrowser(text, generation)
    void this.upgradeToEdge(text, generation)
  }

  cancel(): void {
    this.generation += 1
    this.stopPlayback()
    this.onProgress?.(0)
    this.hold('stop')
  }

  private stopPlayback(): void {
    this.livePlayback = false
    this.handedOff = false
    this.abort?.abort()
    this.abort = null
    this.stopEstimate()
    window.speechSynthesis?.cancel()
    this.player.pause()
    this.player.removeAttribute('src')
    this.player.load()
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl)
      this.objectUrl = null
    }
  }

  private startEstimate(text: string): void {
    this.stopEstimate()
    const words = text.trim().split(/\s+/).filter(Boolean).length
    this.estimateMs = Math.max(3000, (words / 2.2) * 1000 / 0.92)
    this.estimateStarted = performance.now()
    const tick = () => {
      if (!this.paused) {
        const fraction = Math.min(1, (performance.now() - this.estimateStarted) / this.estimateMs)
        this.onProgress?.(fraction)
        if (fraction >= 1) return
      }
      this.estimateRaf = requestAnimationFrame(tick)
    }
    this.estimateRaf = requestAnimationFrame(tick)
  }

  private stopEstimate(): void {
    if (this.estimateRaf) cancelAnimationFrame(this.estimateRaf)
    this.estimateRaf = 0
    this.pauseStarted = 0
  }

  private hold(state: NarrationHold): void {
    this.onHold?.(state)
  }

  private async upgradeToEdge(text: string, generation: number): Promise<void> {
    this.abort = new AbortController()
    try {
      const blob = await fetchEdgeAudio(text, this.abort.signal)
      if (generation !== this.generation || this.paused) return
      this.handedOff = true
      window.speechSynthesis?.cancel()
      const url = URL.createObjectURL(blob)
      this.objectUrl = url
      this.player.src = url
      if (generation !== this.generation || this.paused) return
      await this.player.play()
      if (generation !== this.generation) return
      this.livePlayback = true
    } catch (error) {
      if (generation !== this.generation) return
      if (error instanceof DOMException && error.name === 'AbortError') return
      if (!this.handedOff || this.livePlayback) return
      this.handedOff = false
      this.speakBrowser(text, generation)
    }
  }

  private speakBrowser(text: string, generation: number): void {
    const synth = window.speechSynthesis
    if (!synth || this.paused) {
      this.hold('unread')
      return
    }
    // Chrome drops an utterance spoken in the same turn as cancel().
    window.setTimeout(() => {
      if (generation !== this.generation || this.paused) return
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'en-GB'
      utterance.rate = 0.92
      utterance.pitch = 0.9
      const voice = pickUkMaleVoice(synth.getVoices())
      if (voice) utterance.voice = voice
      utterance.onboundary = (event) => {
        if (generation !== this.generation || text.length === 0) return
        const fraction = Math.min(1, event.charIndex / text.length)
        this.estimateStarted = performance.now() - fraction * this.estimateMs
        this.onProgress?.(fraction)
      }
      utterance.onend = () => {
        if (generation !== this.generation || this.handedOff || this.livePlayback) return
        this.stopEstimate()
        this.onProgress?.(1)
        this.hold('spoken')
      }
      utterance.onerror = (event) => {
        if (generation !== this.generation) return
        if (event.error === 'interrupted' || event.error === 'canceled') return
        this.stopEstimate()
        this.hold('unread')
      }
      synth.resume()
      synth.speak(utterance)
      this.startEstimate(text)
      this.armKeepAlive()
    }, 60)
  }

  private armKeepAlive(): void {
    if (this.keepAlive) return
    this.keepAlive = window.setInterval(() => {
      const synth = window.speechSynthesis
      if (!synth?.speaking || synth.paused || this.paused) return
      synth.pause()
      synth.resume()
    }, 10_000)
  }
}

async function fetchEdgeAudio(text: string, signal: AbortSignal): Promise<Blob> {
  if (import.meta.env.DEV) {
    const timeout = new AbortController()
    const timer = setTimeout(() => timeout.abort(), 2_000)
    const onAbort = () => timeout.abort()
    signal.addEventListener('abort', onAbort, { once: true })
    try {
      const response = await fetch('/api/tts', { method: 'POST', body: text, signal: timeout.signal })
      if (signal.aborted) throw new DOMException('Narration cancelled', 'AbortError')
      if (response.ok) return response.blob()
      throw new Error('Dev TTS failed')
    } catch (error) {
      if (signal.aborted) throw new DOMException('Narration cancelled', 'AbortError')
      if (error instanceof DOMException && error.name === 'AbortError') throw new Error('Dev TTS timed out')
      throw error
    } finally {
      clearTimeout(timer)
      signal.removeEventListener('abort', onAbort)
    }
  }
  return synthesizeEdgeTts(text, signal)
}

export function pickUkMaleVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  let best: SpeechSynthesisVoice | null = null
  let bestScore = 0
  for (const voice of voices) {
    const label = `${voice.name} ${voice.lang}`.toLowerCase()
    let score = 0
    if (label.includes('ryan') && isUk(label, voice.lang)) score = 100
    else if (label.includes('thomas') && isUk(label, voice.lang)) score = 80
    else if (label.includes('george') && isUk(label, voice.lang)) score = 70
    else if (label.includes('uk english male')) score = 60
    else if (voice.lang.toLowerCase().startsWith('en-gb') && label.includes('male')) score = 50
    else if (voice.lang.toLowerCase().startsWith('en-gb') && !isUkFemale(label)) score = 30
    if (score > bestScore) {
      best = voice
      bestScore = score
    }
  }
  return best
}

function isUk(label: string, lang: string): boolean {
  return label.includes('uk') || label.includes('gb') || label.includes('united kingdom') || lang.toLowerCase().startsWith('en-gb')
}

function isUkFemale(label: string): boolean {
  return label.includes('female') || label.includes('sonia') || label.includes('libby') || label.includes('maisie')
}
