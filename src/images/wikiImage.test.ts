import { describe, expect, it } from 'vitest'
import { imageFromQuery, imagesFromMediaList, pageFromWikiUrl } from './wikiImage.ts'

describe('wiki images', () => {
  it('reads the article title from a Wikipedia url', () => {
    expect(pageFromWikiUrl('https://en.wikipedia.org/wiki/Chaos_(cosmogony)')).toBe('Chaos_(cosmogony)')
    expect(pageFromWikiUrl('https://example.com/not-wiki')).toBe('')
  })

  it('keeps the lead thumbnail and ignores pages without one', () => {
    const payload = {
      query: {
        pages: {
          '1': {
            title: 'Chaos (cosmogony)',
            thumbnail: { source: 'https://upload.wikimedia.org/chaos.jpg' },
          },
          '2': { title: 'Greek primordial deities' },
        },
      },
    }
    expect(imageFromQuery(payload, 'Chaos_(cosmogony)')).toEqual({
      src: 'https://upload.wikimedia.org/chaos.jpg',
      full: 'https://upload.wikimedia.org/chaos.jpg',
      title: 'Chaos (cosmogony)',
    })
    expect(imageFromQuery({ query: { pages: { '2': { title: 'Empty' } } } }, 'Empty')).toBeNull()
    expect(imageFromQuery(null, 'Empty')).toBeNull()
  })

  it('puts the lead image first and the other article images after it', () => {
    const gallery = imagesFromMediaList({
      items: [
        {
          title: 'File:Watts.jpg',
          leadImage: true,
          type: 'image',
          caption: { text: 'Watts – Chaos' },
          srcset: [
            { src: '//thumb.wikimedia.org/wikipedia/commons/thumb/a/a/Watts.jpg/500px-Watts.jpg', scale: '1x' },
            { src: '//thumb.wikimedia.org/wikipedia/commons/thumb/a/a/Watts.jpg/960px-Watts.jpg', scale: '2x' },
          ],
        },
        {
          title: 'File:Hollar.jpg',
          type: 'image',
          caption: { text: 'Hollar' },
          srcset: [{ src: '//thumb.wikimedia.org/wikipedia/commons/thumb/b/b/Hollar.jpg/500px-Hollar.jpg', scale: '1x' }],
        },
        {
          title: 'File:Laurel_vector.svg',
          type: 'image',
          srcset: [{ src: '//upload.wikimedia.org/wikipedia/commons/a/a/Laurel_vector.svg', scale: '1x' }],
        },
        {
          title: 'File:Commons-logo.svg',
          type: 'image',
          caption: { text: 'logo' },
          srcset: [{ src: '//upload.wikimedia.org/wikipedia/commons/logo.svg', scale: '1x' }],
        },
        { title: 'File:Reading.ogg', type: 'audio', srcset: [] },
      ],
    })
    expect(gallery.lead).toEqual({
      src: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a/Watts.jpg/960px-Watts.jpg',
      full: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a/Watts.jpg/960px-Watts.jpg',
      title: 'Watts – Chaos',
    })
    expect(gallery.more).toEqual([
      {
        src: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b/Hollar.jpg/500px-Hollar.jpg',
        full: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b/Hollar.jpg/500px-Hollar.jpg',
        title: 'Hollar',
      },
    ])
    expect(imagesFromMediaList(null)).toEqual({ lead: null, more: [] })
  })
})
