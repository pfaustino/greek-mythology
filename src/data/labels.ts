import type { Era, Family, Realm, Tag } from './types.ts'

export function eraLabel(era: Era): string {
  switch (era) {
    case 'cosmogony':
      return 'Cosmogony'
    case 'titanomachy':
      return 'Titanomachy'
    case 'olympian':
      return 'Olympian age'
    case 'heroic':
      return 'Heroic age'
    case 'trojan':
      return 'Trojan cycle'
  }
}

export function tagLabel(tag: Tag): string {
  switch (tag) {
    case 'creation':
      return 'Creation'
    case 'titan':
      return 'Titan'
    case 'god':
      return 'God'
    case 'hero':
      return 'Hero'
    case 'monster':
      return 'Monster'
    case 'war':
      return 'War'
    case 'underworld':
      return 'Underworld'
  }
}

export function realmLabel(realm: Realm): string {
  switch (realm) {
    case 'chaos':
      return 'Chaos'
    case 'olympus':
      return 'Olympus'
    case 'tartarus':
      return 'Tartaros'
    case 'underworld':
      return 'The underworld'
    case 'sea':
      return 'The wine-dark sea'
    case 'crete':
      return 'Crete'
    case 'troy':
      return 'Troy'
    case 'earth':
      return 'The earth'
    case 'thebes':
      return 'Thebes'
    case 'argos':
      return 'Argos'
    case 'athens':
      return 'Athens'
    case 'colchis':
      return 'Colchis'
    case 'delphi':
      return 'Delphi'
    case 'ithaca':
      return 'Ithaca'
  }
}

export function realmDepth(realm: Realm): number {
  switch (realm) {
    case 'chaos':
      return 0
    case 'olympus':
      return 1
    case 'delphi':
      return 1.4
    case 'athens':
      return 2
    case 'argos':
      return 2.15
    case 'thebes':
      return 2.3
    case 'earth':
      return 2.45
    case 'crete':
      return 2.8
    case 'troy':
      return 3
    case 'colchis':
      return 3.2
    case 'ithaca':
      return 3.35
    case 'sea':
      return 3.6
    case 'underworld':
      return 4.5
    case 'tartarus':
      return 5.2
  }
}

export function realmFamily(realm: Realm): Family {
  switch (realm) {
    case 'chaos':
      return 'void'
    case 'olympus':
    case 'delphi':
      return 'sky'
    case 'sea':
    case 'crete':
    case 'colchis':
    case 'ithaca':
      return 'sea'
    case 'underworld':
    case 'tartarus':
      return 'below'
    case 'earth':
    case 'thebes':
    case 'argos':
    case 'athens':
    case 'troy':
      return 'land'
  }
}

export function spokenScript(title: string, narration: string): string {
  return `${title}. ${narration}`
}
