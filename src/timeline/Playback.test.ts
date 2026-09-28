import { describe, expect, it } from 'vitest'
import type { MythEvent } from '../data/types.ts'
import { EPISODE_GAP_MS, Playback, travelMs } from './Playback.ts'

function episode(id: string, order: number, realm: MythEvent['realm'] = 'earth'): MythEvent {
  return {
    id,
    title: id,
    order,
    era: 'heroic',
    tags: ['hero'],
    realm,
    narration: 'A short telling of this episode for the playback test, with enough words to dwell.',
    sources: 'Test',
    url: 'https://en.wikipedia.org/wiki/Test',
  }
}

describe('Playback', () => {
  it('travels longer between distant realms', () => {
    expect(travelMs('olympus', 'tartarus')).toBeGreaterThan(travelMs('olympus', 'olympus'))
    expect(travelMs('sea', 'sea')).toBe(480)
  })

  it('focuses the first episode, steps, and seeks', () => {
    const playback = new Playback()
    playback.setEvents([episode('a', 1, 'chaos'), episode('b', 2, 'sea'), episode('c', 3, 'troy')], 60_000)
    let focused: MythEvent | null = null
    playback.tick(40, (event) => {
      focused = event
    })
    expect(focused?.id).toBe('a')
    expect(playback.step(1)?.id).toBe('b')
    expect(playback.playing).toBe(false)
    expect(playback.step(-1)?.id).toBe('a')
    expect(playback.step(-1)).toBeNull()
    expect(playback.seekFraction(1)?.id).toBe('c')
    expect(playback.seekFraction(0)?.id).toBe('a')
  })

  it('holds an episode for five seconds before the next one', () => {
    const playback = new Playback()
    playback.setEvents([episode('a', 1), episode('b', 2)], 60_000)
    playback.tick(40, () => {})
    expect(playback.focusing).toBe(true)
    expect(playback.focused?.id).toBe('a')
    expect(playback.focusRemain).toBe(EPISODE_GAP_MS)
    playback.focusRemain = 0
    playback.tick(40, () => {})
    let next: string | null = null
    playback.tick(40, (event) => {
      next = event.id
    })
    expect(next).toBe('b')
  })

  it('holds the current episode while an image is under the pointer', () => {
    const playback = new Playback()
    playback.setEvents([episode('a', 1), episode('b', 2)], 60_000)
    playback.tick(40, () => {})
    playback.setInspecting(true)
    const remain = playback.focusRemain
    let next: string | null = null
    playback.tick(1_000, (event) => {
      next = event.id
    })
    expect(next).toBeNull()
    expect(playback.focused?.id).toBe('a')
    expect(playback.focusRemain).toBe(remain)
    playback.setInspecting(false)
    playback.focusRemain = 0
    playback.tick(40, () => {})
    playback.tick(40, (event) => {
      next = event.id
    })
    expect(next).toBe('b')
  })

  it('stops at the end of the chronicle', () => {
    const playback = new Playback()
    playback.setEvents([episode('a', 1), episode('b', 2)], 1_000)
    playback.speed = 8
    let ended = false
    for (let i = 0; i < 40 && !ended; i += 1) {
      ended = playback.tick(200, () => {})
      if (playback.focusing) playback.focusRemain = 0
    }
    expect(ended).toBe(true)
    expect(playback.playing).toBe(false)
  })
})
