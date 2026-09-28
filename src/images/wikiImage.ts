export type WikiImage = {
  src: string
  full: string
  title: string
  caption: string
}

export type WikiGallery = {
  lead: WikiImage | null
  more: WikiImage[]
}

const MAX_MORE_IMAGES = 24

const SKIP_FILE =
  /(?:icon|logo|symbol|pictogram|ambox|edit-clear|question_book|disambig|padlock|commons-logo|wiktionary|oojs_|oojs\.|red_pog|green_pog|blue_pog|yes_check|x_mark|cquote|speaker_icon|sound-icon)/i

type MediaItem = {
  title?: string
  type?: string
  leadImage?: boolean
  showInGallery?: boolean
  caption?: { text?: string }
  srcset?: { src?: string; scale?: string }[]
}

type PageImage = {
  title?: string
  thumbnail?: { source?: string }
}

const cache = new Map<string, Promise<WikiGallery>>()

export function pageFromWikiUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const marker = '/wiki/'
    const index = parsed.pathname.indexOf(marker)
    if (index < 0) return ''
    return decodeURIComponent(parsed.pathname.slice(index + marker.length))
  } catch {
    return ''
  }
}

export function imageFromQuery(payload: unknown, page: string): WikiImage | null {
  if (!payload || typeof payload !== 'object') return null
  const pages = (payload as { query?: { pages?: Record<string, PageImage> } }).query?.pages
  if (!pages) return null
  const hit = Object.values(pages).find((entry) => Boolean(entry.thumbnail?.source))
  const src = hit?.thumbnail?.source
  if (!src) return null
  return { src, full: src, title: hit.title || page.replaceAll('_', ' '), caption: '' }
}

export function imagesFromMediaList(payload: unknown): WikiGallery {
  const empty: WikiGallery = { lead: null, more: [] }
  if (!payload || typeof payload !== 'object') return empty
  const items = (payload as { items?: MediaItem[] }).items
  if (!items) return empty
  const images: { lead: boolean; image: WikiImage }[] = []
  for (let i = 0; i < items.length; i += 1) {
    const image = imageFromMediaItem(items[i])
    if (!image) continue
    images.push({ lead: items[i].leadImage === true, image })
  }
  if (images.length === 0) return empty
  let leadAt = images.findIndex((entry) => entry.lead)
  if (leadAt < 0) leadAt = 0
  const more: WikiImage[] = []
  for (let i = 0; i < images.length && more.length < MAX_MORE_IMAGES; i += 1) {
    if (i === leadAt) continue
    more.push(images[i].image)
  }
  return { lead: preferLeadSize(images[leadAt].image), more }
}

export function loadWikiGallery(url: string): Promise<WikiGallery> {
  const page = pageFromWikiUrl(url)
  if (!page) return Promise.resolve({ lead: null, more: [] })
  const cached = cache.get(page)
  if (cached) return cached
  const pending = fetchWikiGallery(page).catch(() => ({ lead: null, more: [] }))
  cache.set(page, pending)
  return pending
}

function preferLeadSize(image: WikiImage): WikiImage {
  return { ...image, src: image.full }
}

function imageFromMediaItem(item: MediaItem): WikiImage | null {
  if (!isContentImage(item)) return null
  const sources = rankedSrcs(item.srcset ?? [])
  if (sources.length === 0) return null
  const caption = item.caption?.text?.trim() ?? ''
  return {
    src: sources[0],
    full: sources[sources.length - 1],
    title: caption || imageLabel(item),
    caption,
  }
}

function isContentImage(item: MediaItem): boolean {
  if (item.type && item.type !== 'image') return false
  if (item.showInGallery === false) return false
  const title = item.title ?? ''
  if (!title.startsWith('File:')) return false
  const file = title.slice('File:'.length)
  if (SKIP_FILE.test(file)) return false
  const ext = file.split('.').pop()?.toLowerCase() ?? ''
  if ((ext === 'svg' || ext === 'gif') && !item.caption?.text?.trim()) return false
  return true
}

function imageLabel(item: MediaItem): string {
  return (item.title ?? '')
    .replace(/^File:/, '')
    .replace(/\.[a-z0-9]+$/i, '')
    .replaceAll('_', ' ')
}

function rankedSrcs(srcset: { src?: string; scale?: string }[]): string[] {
  const ranked: { src: string; scale: number }[] = []
  for (let i = 0; i < srcset.length; i += 1) {
    const raw = srcset[i].src
    if (!raw) continue
    const scale = Number.parseFloat(srcset[i].scale ?? '')
    const absolute = raw.startsWith('//') ? `https:${raw}` : raw
    ranked.push({ src: absolute, scale: Number.isFinite(scale) ? scale : 0 })
  }
  ranked.sort((a, b) => a.scale - b.scale)
  return ranked.map((entry) => entry.src)
}

async function fetchWikiGallery(page: string): Promise<WikiGallery> {
  const listed = await fetchMediaList(page)
  if (listed.lead || listed.more.length > 0) return listed
  const lead = await fetchLeadImage(page)
  return { lead, more: [] }
}

async function fetchMediaList(page: string): Promise<WikiGallery> {
  const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/media-list/${encodeURIComponent(page)}`, {
    headers: { accept: 'application/json' },
  })
  if (!response.ok) return { lead: null, more: [] }
  return imagesFromMediaList(await response.json())
}

async function fetchLeadImage(page: string): Promise<WikiImage | null> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    redirects: '1',
    prop: 'pageimages',
    piprop: 'thumbnail',
    pithumbsize: '1600',
    titles: page,
  })
  const response = await fetch(`https://en.wikipedia.org/w/api.php?${params}`)
  if (!response.ok) return null
  return imageFromQuery(await response.json(), page)
}
