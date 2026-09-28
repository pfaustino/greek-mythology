import { eraLabel, realmLabel, tagLabel } from '../data/labels.ts'
import type { Era, MythEvent, Tag } from '../data/types.ts'
import { ERAS, TAGS } from '../data/types.ts'
import { loadWikiGallery } from '../images/wikiImage.ts'
import type { WikiImage } from '../images/wikiImage.ts'

export type HudHandlers = {
  onSpeed: (speed: number) => void
  onPlayToggle: () => void
  onDirection: (direction: 1 | -1) => void
  onStep: (direction: -1 | 1) => void
  onSeek: (fraction: number) => void
  onEra: (era: Era | 'all') => void
  onTag: (tag: Tag | 'all') => void
  onNarration: (enabled: boolean) => void
  onInspect: (active: boolean) => void
}

export class Hud {
  private readonly clockEl: HTMLElement
  private readonly statusEl: HTMLElement
  private readonly cardEl: HTMLElement
  private readonly cardBody: HTMLElement
  private readonly cardTitle: HTMLElement
  private readonly scrubber: HTMLInputElement
  private readonly playBtn: HTMLButtonElement
  private readonly speakBtn: HTMLButtonElement
  private readonly speakBar: HTMLElement
  private readonly ticksEl: HTMLElement
  private readonly filterSummary: HTMLElement
  private readonly zoomEl: HTMLElement
  private readonly zoomImg: HTMLImageElement
  private readonly zoomCaption: HTMLElement
  private seeking = false
  private bodyHidden = false
  private imageToken = 0
  private pinnedZoom = false
  private readonly onInspect: (active: boolean) => void

  constructor(cardRoot: HTMLElement, railRoot: HTMLElement, handlers: HudHandlers) {
    const eraButtons = ERAS.map((era) => `<button type="button" data-era="${era}">${eraLabel(era)}</button>`).join('')
    const tagButtons = TAGS.map((tag) => `<button type="button" data-tag="${tag}">${tagLabel(tag)}</button>`).join('')

    cardRoot.innerHTML = `
      <div class="speak-bar" aria-hidden="true"><span id="speak-progress"></span></div>
      <header class="card-head">
        <div>
          <p class="card-kicker" id="card-kicker">Episode</p>
          <h2 id="card-title">The chronicle</h2>
        </div>
        <button type="button" id="card-toggle" aria-expanded="true">Hide</button>
      </header>
      <div class="card-body" id="event-card">
        <p class="muted">The arc is about to begin.</p>
      </div>
    `

    railRoot.innerHTML = `
      <div class="meander" aria-hidden="true"></div>
      <div class="transport">
        <div class="row" role="group" aria-label="Playback">
          <button type="button" id="dir-reverse">Reverse</button>
          <button type="button" id="step-prev" aria-keyshortcuts="ArrowLeft">Previous</button>
          <button type="button" id="play-toggle" aria-keyshortcuts="Space">Pause</button>
          <button type="button" id="step-next" aria-keyshortcuts="ArrowRight">Next</button>
          <button type="button" id="dir-forward" class="active">Forward</button>
        </div>
        <div class="row" role="group" aria-label="Speed and narration">
          <button type="button" data-speed="1" class="active">1×</button>
          <button type="button" data-speed="2">2×</button>
          <button type="button" data-speed="4">4×</button>
          <button type="button" id="narrate" aria-pressed="true">Speak</button>
        </div>
        <p id="clock" class="clock">Cosmogony</p>
      </div>
      <div class="era-ticks" id="era-ticks"></div>
      <input id="scrubber" type="range" min="0" max="1000" value="0" aria-label="Position in the chronicle" />
      <p class="status" id="status">Opening the chronicle…</p>
      <p class="keys">Space pauses. Arrows step. Click a star on the arc.</p>
      <details class="filters">
        <summary id="filter-summary">Filter the chronicle</summary>
        <div class="filters-body">
          <div class="row" role="group" aria-label="Era">
            <button type="button" data-era="all" class="active">All eras</button>
            ${eraButtons}
          </div>
          <div class="row" role="group" aria-label="Kind">
            <button type="button" data-tag="${'all'}" class="active">All kinds</button>
            ${tagButtons}
          </div>
          <p class="attr">Educational chronology in original words. Greek names, Roman equivalents on the tablet. Wikipedia links are further reading, not the script. Pictures on a tablet are that article’s images. No modern franchise imagery. Speech uses a UK voice.</p>
        </div>
      </details>
    `

    this.clockEl = railRoot.querySelector('#clock') as HTMLElement
    this.statusEl = railRoot.querySelector('#status') as HTMLElement
    this.cardEl = cardRoot
    this.cardBody = cardRoot.querySelector('#event-card') as HTMLElement
    this.cardTitle = cardRoot.querySelector('#card-title') as HTMLElement
    this.scrubber = railRoot.querySelector('#scrubber') as HTMLInputElement
    this.playBtn = railRoot.querySelector('#play-toggle') as HTMLButtonElement
    this.speakBtn = railRoot.querySelector('#narrate') as HTMLButtonElement
    this.speakBar = cardRoot.querySelector('#speak-progress') as HTMLElement
    this.ticksEl = railRoot.querySelector('#era-ticks') as HTMLElement
    this.filterSummary = railRoot.querySelector('#filter-summary') as HTMLElement

    const zoom = document.createElement('div')
    zoom.className = 'wiki-zoom'
    zoom.setAttribute('aria-hidden', 'true')
    const zoomImg = document.createElement('img')
    zoomImg.alt = ''
    const zoomCaption = document.createElement('p')
    zoomCaption.className = 'wiki-zoom-caption'
    zoomCaption.hidden = true
    zoom.append(zoomImg, zoomCaption)
    document.body.append(zoom)
    this.zoomEl = zoom
    this.zoomImg = zoomImg
    this.zoomCaption = zoomCaption
    this.onInspect = handlers.onInspect
    this.cardBody.addEventListener('pointerover', (event) => {
      this.onThumbOver(event)
      this.onImageInspect(event, true)
    })
    this.cardBody.addEventListener('pointerout', (event) => {
      this.onThumbOut(event)
      this.onImageInspect(event, false)
    })
    this.cardBody.addEventListener('click', (event) => {
      this.onMoreClick(event)
      this.onImageInspect(event, true)
    })
    window.addEventListener('click', (event) => this.onOutsideZoomClick(event), true)

    const cardToggle = cardRoot.querySelector('#card-toggle') as HTMLButtonElement
    cardToggle.addEventListener('click', () => {
      this.bodyHidden = !this.bodyHidden
      this.cardBody.hidden = this.bodyHidden
      cardToggle.textContent = this.bodyHidden ? 'Show' : 'Hide'
      cardToggle.setAttribute('aria-expanded', this.bodyHidden ? 'false' : 'true')
    })

    railRoot.querySelector('#dir-reverse')?.addEventListener('click', () => handlers.onDirection(-1))
    railRoot.querySelector('#dir-forward')?.addEventListener('click', () => handlers.onDirection(1))
    railRoot.querySelector('#step-prev')?.addEventListener('click', () => handlers.onStep(-1))
    railRoot.querySelector('#step-next')?.addEventListener('click', () => handlers.onStep(1))
    this.playBtn.addEventListener('click', () => handlers.onPlayToggle())
    this.speakBtn.addEventListener('click', () => {
      const enabled = this.speakBtn.getAttribute('aria-pressed') !== 'true'
      this.setNarration(enabled)
      handlers.onNarration(enabled)
    })

    railRoot.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach((button) => {
      button.addEventListener('click', () => {
        this.setToggleGroup('[data-speed]', button)
        handlers.onSpeed(Number(button.dataset.speed))
      })
    })
    railRoot.querySelectorAll<HTMLButtonElement>('[data-era]').forEach((button) => {
      button.addEventListener('click', () => {
        this.setToggleGroup('[data-era]', button)
        handlers.onEra((button.dataset.era ?? 'all') as Era | 'all')
      })
    })
    railRoot.querySelectorAll<HTMLButtonElement>('[data-tag]').forEach((button) => {
      button.addEventListener('click', () => {
        this.setToggleGroup('[data-tag]', button)
        handlers.onTag((button.dataset.tag ?? 'all') as Tag | 'all')
      })
    })

    const placeCard = (): void => {
      const narrow = window.matchMedia('(max-width: 800px)').matches
      if (!narrow) {
        this.cardEl.style.bottom = ''
        return
      }
      this.cardEl.style.bottom = `${railRoot.offsetHeight + 16}px`
    }
    placeCard()
    new ResizeObserver(placeCard).observe(railRoot)
    window.addEventListener('resize', placeCard)

    this.scrubber.addEventListener('pointerdown', () => {
      this.seeking = true
    })
    this.scrubber.addEventListener('pointerup', () => {
      this.seeking = false
    })
    this.scrubber.addEventListener('input', () => {
      handlers.onSeek(Number(this.scrubber.value) / 1000)
    })
    window.addEventListener('keydown', (event) => this.onKeyDown(event, handlers))
  }

  setPlaying(playing: boolean): void {
    this.playBtn.textContent = playing ? 'Pause' : 'Play'
  }

  setDirection(direction: 1 | -1): void {
    document.querySelector('#dir-reverse')?.classList.toggle('active', direction === -1)
    document.querySelector('#dir-forward')?.classList.toggle('active', direction === 1)
  }

  setNarration(enabled: boolean): void {
    this.speakBtn.setAttribute('aria-pressed', enabled ? 'true' : 'false')
    this.speakBtn.classList.toggle('active', enabled)
    this.speakBtn.textContent = enabled ? 'Speak' : 'Silent'
  }

  setStatus(text: string): void {
    this.statusEl.textContent = text
  }

  setClock(text: string): void {
    this.clockEl.textContent = text
  }

  setFraction(fraction: number): void {
    if (this.seeking) return
    this.scrubber.value = String(Math.round(Math.min(1, Math.max(0, fraction)) * 1000))
  }

  setSpeakProgress(fraction: number): void {
    this.speakBar.style.width = `${Math.round(Math.min(1, Math.max(0, fraction)) * 100)}%`
  }

  setFilterLabel(era: Era | 'all', tag: Tag | 'all'): void {
    const parts = ['Filter the chronicle']
    if (era !== 'all') parts.push(eraLabel(era))
    if (tag !== 'all') parts.push(tagLabel(tag))
    this.filterSummary.textContent = parts.join(' · ')
  }

  setTicks(events: MythEvent[]): void {
    this.ticksEl.replaceChildren()
    if (events.length === 0) return
    const start = events[0].order
    const end = events[events.length - 1].order
    const span = Math.max(1, end - start)
    let previous: string | null = null
    for (let i = 0; i < events.length; i += 1) {
      const event = events[i]
      if (event.era === previous) continue
      previous = event.era
      const tick = document.createElement('span')
      tick.className = event.era
      tick.style.left = `${((event.order - start) / span) * 100}%`
      tick.textContent = eraLabel(event.era)
      this.ticksEl.append(tick)
    }
  }

  showEvent(event: MythEvent): void {
    this.onInspect(false)
    this.cardTitle.textContent = event.title
    const kicker = this.cardEl.querySelector('#card-kicker')
    if (kicker) kicker.textContent = `${eraLabel(event.era)} · ${realmLabel(event.realm)}`
    this.cardEl.classList.add('live')
    this.cardEl.classList.remove('arrive')
    void this.cardEl.offsetWidth
    this.cardEl.classList.add('arrive')
    const tags = event.tags.map((tag) => tagLabel(tag)).join(' · ')
    const roman = event.roman ? `<p class="roman">Roman: ${escapeHtml(event.roman)}</p>` : ''
    const token = ++this.imageToken
    this.closeZoom()
    this.cardBody.innerHTML = `
      <figure class="wiki-shot" hidden>
        <img alt="" />
        <figcaption>Wikipedia</figcaption>
      </figure>
      <p class="tags">${escapeHtml(tags)}</p>
      ${roman}
      <p class="narration">${escapeHtml(event.narration)}</p>
      <div class="wiki-more" hidden></div>
      <p class="sources">${escapeHtml(event.sources)}</p>
      <a href="${escapeHtml(event.url)}" target="_blank" rel="noreferrer">Further reading</a>
    `
    this.cardBody.scrollTop = 0
    this.setSpeakProgress(0)
    this.mountThumb(event, token)
  }

  scrollNarration(fraction: number): void {
    const el = this.cardBody.querySelector<HTMLElement>('.narration')
    if (!el) return
    const t = Math.min(1, Math.max(0, fraction))
    if (t <= 0) {
      this.cardBody.scrollTop = 0
      return
    }
    const spokenY =
      el.getBoundingClientRect().top - this.cardBody.getBoundingClientRect().top + this.cardBody.scrollTop + el.offsetHeight * t
    // Park the spoken line in the upper third so the card starts moving before that line reaches the bottom.
    const lead = Math.max(72, this.cardBody.clientHeight * 0.34)
    const nextTop = Math.max(0, spokenY - lead)
    if (nextTop > this.cardBody.scrollTop) this.cardBody.scrollTop = nextTop
  }

  clearEvent(): void {
    this.onInspect(false)
    this.imageToken += 1
    this.closeZoom()
    this.cardEl.classList.remove('live', 'arrive')
    this.cardTitle.textContent = 'The chronicle'
    this.cardBody.innerHTML = `<p class="muted">No episode in view.</p>`
    this.setSpeakProgress(0)
  }

  private mountThumb(event: MythEvent, token: number): void {
    const shot = this.cardBody.querySelector<HTMLElement>('.wiki-shot')
    const img = shot?.querySelector('img')
    if (!shot || !img) return
    img.addEventListener('load', () => {
      if (token !== this.imageToken) return
      shot.hidden = false
    })
    img.addEventListener('error', () => {
      shot.hidden = true
    })
    void loadWikiGallery(event.url).then((gallery) => {
      if (token !== this.imageToken) return
      if (gallery.lead) {
        img.alt = event.title
        img.dataset.full = gallery.lead.full
        img.dataset.caption = gallery.lead.caption
        img.src = gallery.lead.src
      }
      this.mountMore(gallery.more, token)
    })
  }

  private mountMore(images: WikiImage[], token: number): void {
    const row = this.cardBody.querySelector<HTMLElement>('.wiki-more')
    if (!row || images.length === 0) return
    for (let i = 0; i < images.length; i += 1) {
      const image = images[i]
      const figure = document.createElement('figure')
      figure.className = 'wiki-shot'
      figure.hidden = true
      const thumb = document.createElement('img')
      thumb.alt = image.caption || image.title
      thumb.dataset.full = image.full
      thumb.dataset.caption = image.caption
      thumb.addEventListener('load', () => {
        if (token !== this.imageToken) return
        figure.hidden = false
        row.hidden = false
      })
      thumb.addEventListener('error', () => {
        figure.remove()
      })
      thumb.src = image.src
      figure.append(thumb)
      row.append(figure)
    }
  }

  private onImageInspect(event: Event, active: boolean): void {
    if (event instanceof PointerEvent && event.pointerType === 'touch') return
    const shot = event.target instanceof Element ? event.target.closest('.wiki-shot') : null
    if (!(shot instanceof HTMLElement) || shot.hidden) return
    if (!active) {
      const next = event instanceof PointerEvent ? event.relatedTarget : null
      if (next instanceof Node && (shot.contains(next) || (next instanceof Element && next.closest('.wiki-shot')))) return
    }
    this.onInspect(active)
  }

  private onThumbOver(event: PointerEvent): void {
    if (this.pinnedZoom || event.pointerType === 'touch') return
    const shot = event.target instanceof Element ? event.target.closest('.wiki-shot') : null
    if (!(shot instanceof HTMLElement) || shot.hidden || shot.closest('.wiki-more')) return
    this.openZoom(shot, false)
  }

  private onThumbOut(event: PointerEvent): void {
    if (this.pinnedZoom) return
    const shot = event.target instanceof Element ? event.target.closest('.wiki-shot') : null
    if (!shot || shot.closest('.wiki-more')) return
    const next = event.relatedTarget
    if (next instanceof Node && shot.contains(next)) return
    this.closeZoom()
  }

  private onMoreClick(event: MouseEvent): void {
    const shot = event.target instanceof Element ? event.target.closest('.wiki-more .wiki-shot') : null
    if (!(shot instanceof HTMLElement) || shot.hidden) return
    event.stopPropagation()
    const full = this.zoomSource(shot)
    if (this.pinnedZoom && this.zoomEl.dataset.src === full) {
      this.closeZoom()
      return
    }
    this.openZoom(shot, true)
  }

  private onOutsideZoomClick(event: MouseEvent): void {
    if (!this.pinnedZoom) return
    const target = event.target
    if (target instanceof Element && target.closest('.wiki-more .wiki-shot')) return
    this.closeZoom()
    event.preventDefault()
    event.stopPropagation()
  }

  private openZoom(shot: HTMLElement, pin: boolean): void {
    const source = shot.querySelector('img')
    const full = source?.dataset.full || source?.currentSrc
    if (!full) return
    const caption = source?.dataset.caption ?? ''
    this.zoomImg.src = full
    this.zoomEl.dataset.src = full
    this.zoomCaption.textContent = caption
    this.zoomCaption.hidden = caption.length === 0
    this.zoomEl.classList.add('open')
    this.pinnedZoom = pin
  }

  private closeZoom(): void {
    this.pinnedZoom = false
    this.zoomEl.classList.remove('open')
    delete this.zoomEl.dataset.src
    this.zoomCaption.textContent = ''
    this.zoomCaption.hidden = true
  }

  private zoomSource(shot: HTMLElement): string {
    const source = shot.querySelector('img')
    return source?.dataset.full || source?.currentSrc || ''
  }

  private onKeyDown(event: KeyboardEvent, handlers: HudHandlers): void {
    const scrubbing = event.target instanceof HTMLInputElement && event.target.type === 'range'
    if (event.code === 'Space') {
      if (event.repeat || scrubbing) return
      event.preventDefault()
      handlers.onPlayToggle()
      return
    }
    if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
      if (scrubbing) return
      event.preventDefault()
      handlers.onStep(event.code === 'ArrowLeft' ? -1 : 1)
    }
  }

  private setToggleGroup(selector: string, active: HTMLButtonElement): void {
    active.parentElement?.querySelectorAll<HTMLButtonElement>(selector).forEach((button) => {
      button.classList.toggle('active', button === active)
    })
  }
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}
