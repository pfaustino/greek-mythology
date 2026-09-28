import { describe, expect, it } from 'vitest'
import { events } from './catalog.ts'
import { realmDepth } from './labels.ts'
import { ERAS, TAGS, type Realm } from './types.ts'

const REALMS: Realm[] = [
  'chaos',
  'olympus',
  'tartarus',
  'underworld',
  'sea',
  'crete',
  'troy',
  'earth',
  'thebes',
  'argos',
  'athens',
  'colchis',
  'delphi',
  'ithaca',
]

describe('catalog', () => {
  it('keeps a curated set in mythic order', () => {
    expect(events.length).toBeGreaterThanOrEqual(40)
    expect(events.length).toBeLessThanOrEqual(80)
    const ids = new Set<string>()
    const titles = new Set<string>()
    for (let i = 0; i < events.length; i += 1) {
      const event = events[i]
      expect(event.order).toBe(i + 1)
      expect(ids.has(event.id)).toBe(false)
      expect(titles.has(event.title)).toBe(false)
      ids.add(event.id)
      titles.add(event.title)
      expect(event.tags.length).toBeGreaterThan(0)
      expect(event.narration.length).toBeGreaterThan(180)
      expect(event.narration.length).toBeLessThan(900)
      expect(event.sources.length).toBeGreaterThan(0)
      expect(event.url.startsWith('https://en.wikipedia.org/wiki/')).toBe(true)
      if (i > 0) expect(ERAS.indexOf(event.era)).toBeGreaterThanOrEqual(ERAS.indexOf(events[i - 1].era))
    }
  })

  it('uses every era, kind, and realm at least once', () => {
    for (const era of ERAS) expect(events.some((event) => event.era === era)).toBe(true)
    for (const tag of TAGS) expect(events.some((event) => event.tags.includes(tag))).toBe(true)
    for (const realm of REALMS) expect(events.some((event) => event.realm === realm)).toBe(true)
  })

  it('puts Tartaros below the sea and Olympus above Chaos', () => {
    expect(realmDepth('tartarus')).toBeGreaterThan(realmDepth('underworld'))
    expect(realmDepth('underworld')).toBeGreaterThan(realmDepth('sea'))
    expect(realmDepth('sea')).toBeGreaterThan(realmDepth('olympus'))
    expect(realmDepth('olympus')).toBeGreaterThan(realmDepth('chaos'))
  })
})
