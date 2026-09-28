import './style.css'
import { Narrator } from './audio/Narrator.ts'
import { events as catalog } from './data/catalog.ts'
import { eraLabel, realmLabel, spokenScript } from './data/labels.ts'
import type { Era, MythEvent, Tag } from './data/types.ts'
import { Cosmos } from './cosmos/Cosmos.ts'
import { dwellMs, Playback, travelMs } from './timeline/Playback.ts'
import { Hud } from './ui/Hud.ts'

const PLAY_DURATION_MS = 72_000

const canvas = document.querySelector<HTMLCanvasElement>('#cosmos')
const cardRoot = document.querySelector<HTMLElement>('#details-card')
const railRoot = document.querySelector<HTMLElement>('#rail')
if (!canvas || !cardRoot || !railRoot) throw new Error('Missing chronicle layout')

const playback = new Playback()
const cosmos = new Cosmos(canvas)
const narrator = new Narrator()

let era: Era | 'all' = 'all'
let tag: Tag | 'all' = 'all'
let catalogStatus = ''

narrator.onHold = (state) => {
  if (state === 'stop') return
  if (state === 'wait') {
    playback.hold(90_000)
    return
  }
  // After the line is spoken, leave the card up for five seconds. If speech never started, use that same pause.
  playback.hold(dwellMs())
}

const hud = new Hud(cardRoot, railRoot, {
  onSpeed: (speed) => {
    playback.speed = speed
  },
  onPlayToggle: () => {
    playback.playing = !playback.playing
    hud.setPlaying(playback.playing)
    if (playback.playing) {
      hud.setStatus(catalogStatus)
      narrator.resume()
    } else narrator.pause()
  },
  onDirection: (direction) => {
    playback.setDirection(direction)
    playback.playing = true
    hud.setDirection(direction)
    hud.setPlaying(true)
    hud.setStatus(catalogStatus)
    narrator.resume()
  },
  onStep: (direction) => stepEvent(direction),
  onSeek: (fraction) => {
    const from = playback.focused?.realm ?? 'chaos'
    const event = playback.seekFraction(fraction)
    present(event, event ? travelMs(from, event.realm) : 600, false)
  },
  onEra: (next) => {
    era = next
    hud.setFilterLabel(era, tag)
    applyCatalog()
  },
  onTag: (next) => {
    tag = next
    hud.setFilterLabel(era, tag)
    applyCatalog()
  },
  onNarration: (enabled) => {
    narrator.setEnabled(enabled)
    if (enabled && playback.focused) narrator.speak(spokenScript(playback.focused.title, playback.focused.narration))
  },
  onInspect: (active) => {
    playback.setInspecting(active)
  },
})

narrator.onProgress = (fraction) => {
  hud.setSpeakProgress(fraction)
  hud.scrollNarration(fraction)
}

cosmos.onPick = (event) => {
  const start = playback.sourceStart
  const span = playback.sourceEnd - playback.sourceStart
  const fraction = span <= 0 ? 0 : (event.order - start) / span
  playback.seekFraction(fraction)
  playback.playing = false
  hud.setPlaying(false)
  present(event, 700, true)
}

function applyCatalog(): void {
  const filtered = catalog.filter((event) => {
    if (era !== 'all' && event.era !== era) return false
    if (tag !== 'all' && !event.tags.includes(tag)) return false
    return true
  })
  playback.setEvents(filtered, PLAY_DURATION_MS)
  cosmos.setEvents(filtered)
  hud.clearEvent()
  narrator.cancel()
  hud.setPlaying(playback.playing)
  hud.setDirection(playback.direction)
  hud.setTicks(filtered)
  hud.setFraction(playback.fraction())
  catalogStatus =
    filtered.length === 0 ? 'No episodes match these filters.' : `${filtered.length} episodes in this telling`
  hud.setStatus(catalogStatus)
  hud.setClock(filtered[0] ? `${eraLabel(filtered[0].era)} · ${filtered[0].title}` : 'The chronicle')
}

function present(event: MythEvent | null, travel: number, dwell: boolean): void {
  if (!event) {
    hud.clearEvent()
    narrator.cancel()
    syncChrome()
    return
  }
  if (dwell) playback.hold(dwellMs())
  cosmos.focus(event, travel)
  hud.showEvent(event)
  narrator.speak(spokenScript(event.title, event.narration))
  syncChrome()
}

function onFocus(event: MythEvent, travel: number): void {
  cosmos.focus(event, travel)
  hud.showEvent(event)
  narrator.speak(spokenScript(event.title, event.narration))
  syncChrome()
}

function stepEvent(direction: -1 | 1): void {
  const from = playback.focused
  const event = playback.step(direction)
  hud.setPlaying(false)
  hud.setDirection(playback.direction)
  if (!event) return
  const travel = from ? travelMs(from.realm, event.realm) : 800
  cosmos.focus(event, travel)
  hud.showEvent(event)
  narrator.speak(spokenScript(event.title, event.narration))
  syncChrome()
}

function syncChrome(): void {
  const event = playback.focused
  const index = event ? playback.events.indexOf(event) + 1 : 0
  hud.setClock(event ? `${eraLabel(event.era)} · ${event.title}` : 'The chronicle')
  hud.setFraction(playback.fraction())
  if (playback.events.length === 0) return
  const place = event ? realmLabel(event.realm) : ''
  hud.setStatus(event ? `Episode ${index} of ${playback.events.length} · ${place}` : catalogStatus)
}

let last = performance.now()
function frame(now: number): void {
  const dt = Math.min(100, now - last)
  last = now
  const ended = playback.tick(dt, onFocus)
  cosmos.setPlayhead(playback.playhead, playback.sourceStart, playback.sourceEnd)
  cosmos.update(dt)
  cosmos.draw()
  hud.setFraction(playback.fraction())
  if (playback.focused) {
    hud.setClock(`${eraLabel(playback.focused.era)} · ${playback.focused.title}`)
  }
  if (ended) {
    hud.setPlaying(false)
    hud.setStatus(
      playback.direction === 1
        ? 'End of the chronicle. Reverse, or scrub back along the arc.'
        : 'Start of the chronicle. Play forward to continue.',
    )
  }
  requestAnimationFrame(frame)
}

applyCatalog()
requestAnimationFrame(frame)
