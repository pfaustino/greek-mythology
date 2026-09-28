import type { MythEvent, Realm } from '../data/types.ts'
import { realmDepth } from '../data/labels.ts'

const MAX_GAP = 0.02
const CRUISE_LEAD = 0.0001
const MAX_EVENTS_PER_TICK = 4

/** How long a card stays up before the next episode, when speech is not still playing. */
export const EPISODE_GAP_MS = 5_000

export type Direction = 1 | -1

export function travelMs(from: Realm, to: Realm): number {
  const delta = Math.abs(realmDepth(from) - realmDepth(to))
  if (delta === 0) return 480
  return 520 + 1500 * Math.min(1, delta / 4)
}

export function dwellMs(): number {
  return EPISODE_GAP_MS
}

export class Playback {
  events: MythEvent[] = []
  playhead = 0
  playing = true
  direction: Direction = 1
  speed = 1
  playDurationMs = 70_000
  sourceStart = 0
  sourceEnd = 1
  cursor = 0
  focusing = false
  focusRemain = 0
  focused: MythEvent | null = null
  private lookRealm: Realm = 'chaos'

  setEvents(events: MythEvent[], playDurationMs: number): void {
    this.events = [...events].sort((a, b) => a.order - b.order)
    this.playDurationMs = playDurationMs
    this.focusing = false
    this.focusRemain = 0
    this.focused = null
    this.direction = 1
    this.playing = true
    if (this.events.length === 0) {
      this.sourceStart = 0
      this.sourceEnd = 1
      this.playhead = 0
      this.cursor = 0
      return
    }
    this.sourceStart = this.events[0].order
    this.sourceEnd = Math.max(this.events[this.events.length - 1].order, this.sourceStart + 1)
    this.playhead = this.sourceStart
    this.cursor = 0
    this.lookRealm = this.events[0].realm
  }

  fraction(): number {
    return (this.playhead - this.sourceStart) / (this.sourceEnd - this.sourceStart)
  }

  seekFraction(fraction: number): MythEvent | null {
    const t = Math.min(1, Math.max(0, fraction))
    this.playhead = this.sourceStart + t * (this.sourceEnd - this.sourceStart)
    this.focusing = false
    this.focusRemain = 0
    this.syncCursor()
    this.focused = this.lastAtOrBefore(this.playhead)
    if (this.focused) this.lookRealm = this.focused.realm
    return this.focused
  }

  hold(ms: number): void {
    this.focusing = true
    this.focusRemain = ms
  }

  setDirection(direction: Direction): void {
    if (this.direction === direction) return
    this.direction = direction
    this.syncCursorFromFocused()
  }

  step(direction: Direction): MythEvent | null {
    if (this.events.length === 0) return null
    if (!this.focused && direction === 1 && this.cursor <= 0) {
      this.playing = false
      this.focusEvent(this.events[0], false)
      return this.events[0]
    }
    const current = this.focused ?? this.lastAtOrBefore(this.playhead)
    let index = current ? this.events.indexOf(current) : this.lastIndexAtOrBefore(this.playhead)
    index += direction
    if (index < 0 || index >= this.events.length) return null
    this.direction = direction
    this.playing = false
    this.focusEvent(this.events[index], false)
    return this.events[index]
  }

  tick(dtMs: number, onFocus: (event: MythEvent, travel: number) => void): boolean {
    if (!this.playing || this.events.length === 0) return false

    if (this.focusing) {
      this.focusRemain -= dtMs
      if (this.focusRemain <= 0) this.focusing = false
      return false
    }

    const span = this.sourceEnd - this.sourceStart
    const rate = (span / this.playDurationMs) * this.speed
    this.compressGap()
    this.playhead += this.direction * dtMs * rate

    let emitted = 0
    while (emitted < MAX_EVENTS_PER_TICK) {
      const next = this.peek()
      if (!next) break
      const crossed = this.direction === 1 ? this.playhead >= next.order : this.playhead <= next.order
      if (!crossed) break
      const travel = this.focusEvent(next, true)
      onFocus(next, travel)
      emitted += 1
      if (this.focusing) break
    }

    if (this.direction === 1 && this.playhead >= this.sourceEnd && this.cursor >= this.events.length) {
      this.playhead = this.sourceEnd
      this.playing = false
      return true
    }
    if (this.direction === -1 && this.playhead <= this.sourceStart && this.cursor < 0) {
      this.playhead = this.sourceStart
      this.playing = false
      return true
    }
    return false
  }

  private focusEvent(event: MythEvent, autoDwell: boolean): number {
    const travel = travelMs(this.lookRealm, event.realm)
    this.playhead = event.order
    this.focused = event
    this.lookRealm = event.realm
    this.cursor = this.events.indexOf(event) + this.direction
    if (autoDwell) {
      const dwellScale = 1 / Math.min(4, Math.max(0.5, this.speed))
      this.focusRemain = EPISODE_GAP_MS * dwellScale
      this.focusing = true
    } else {
      this.focusing = false
      this.focusRemain = 0
    }
    return travel
  }

  private peek(): MythEvent | null {
    if (this.cursor < 0 || this.cursor >= this.events.length) return null
    return this.events[this.cursor]
  }

  private compressGap(): void {
    const next = this.peek()
    if (!next) return
    const gap = (next.order - this.playhead) * this.direction
    if (gap > MAX_GAP) this.playhead = next.order - this.direction * CRUISE_LEAD
  }

  private syncCursor(): void {
    if (this.direction === 1) this.cursor = this.lastIndexAtOrBefore(this.playhead) + 1
    else this.cursor = this.lastIndexAtOrBefore(this.playhead)
  }

  private syncCursorFromFocused(): void {
    if (this.focused) {
      this.cursor = this.events.indexOf(this.focused) + this.direction
      return
    }
    this.syncCursor()
  }

  lastAtOrBefore(order: number): MythEvent | null {
    const index = this.lastIndexAtOrBefore(order)
    return index >= 0 ? this.events[index] : null
  }

  private lastIndexAtOrBefore(order: number): number {
    let lo = 0
    let hi = this.events.length - 1
    let found = -1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (this.events[mid].order <= order) {
        found = mid
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }
    return found
  }
}
