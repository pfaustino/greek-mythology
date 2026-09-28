export type Era = 'cosmogony' | 'titanomachy' | 'olympian' | 'heroic' | 'trojan'

export type Tag = 'creation' | 'titan' | 'god' | 'hero' | 'monster' | 'war' | 'underworld'

export type Realm =
  | 'chaos'
  | 'olympus'
  | 'tartarus'
  | 'underworld'
  | 'sea'
  | 'crete'
  | 'troy'
  | 'earth'
  | 'thebes'
  | 'argos'
  | 'athens'
  | 'colchis'
  | 'delphi'
  | 'ithaca'

export type Family = 'void' | 'sky' | 'land' | 'sea' | 'below'

export type MythEvent = {
  id: string
  title: string
  order: number
  era: Era
  tags: Tag[]
  realm: Realm
  roman?: string
  narration: string
  sources: string
  url: string
}

export const ERAS: Era[] = ['cosmogony', 'titanomachy', 'olympian', 'heroic', 'trojan']

export const TAGS: Tag[] = ['creation', 'titan', 'god', 'hero', 'monster', 'war', 'underworld']
