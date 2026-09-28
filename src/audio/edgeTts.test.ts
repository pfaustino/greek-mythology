import { describe, expect, it } from 'vitest'
import { pickUkMaleVoice } from './Narrator.ts'
import { escapeSsml, secMsGec } from './edgeTts.ts'

describe('Edge TTS helpers', () => {
  it('escapes SSML text', () => {
    expect(escapeSsml(`A & B <C> "D" 'E'`)).toBe('A &amp; B &lt;C&gt; &quot;D&quot; &apos;E&apos;')
  })

  it('builds a 64-character Sec-MS-GEC token', async () => {
    const token = await secMsGec(1_700_000_000)
    expect(token).toMatch(/^[0-9A-F]{64}$/)
    expect(await secMsGec(1_700_000_000)).toBe(token)
  })
})

describe('UK male voice picker', () => {
  it('prefers Ryan over other UK voices', () => {
    const voices = [
      { name: 'Microsoft Sonia Online (Natural) - English (United Kingdom)', lang: 'en-GB' },
      { name: 'Microsoft Ryan Online (Natural) - English (United Kingdom)', lang: 'en-GB' },
      { name: 'Google UK English Female', lang: 'en-GB' },
    ] as SpeechSynthesisVoice[]
    expect(pickUkMaleVoice(voices)?.name).toContain('Ryan')
  })
})
