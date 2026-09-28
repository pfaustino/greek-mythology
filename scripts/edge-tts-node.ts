import { createHash, randomBytes } from 'node:crypto'
import WebSocket from 'ws'
import { EDGE_UK_MALE_VOICE, escapeSsml } from '../src/audio/edgeTts.ts'

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
const WIN_EPOCH = 11_644_473_600
const SEC_MS_GEC_VERSION = '1-143.0.3650.96'
const ORIGIN = 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0'

function secMsGec(): string {
  const windows = Math.floor(Date.now() / 1000 + WIN_EPOCH)
  const floored = BigInt(windows - (windows % 300))
  const ticks = floored * 10_000_000n
  return createHash('sha256')
    .update(`${ticks.toString()}${TRUSTED_CLIENT_TOKEN}`)
    .digest('hex')
    .toUpperCase()
}

function hexId(bytes = 16): string {
  return randomBytes(bytes).toString('hex')
}

function headerText(request: string, path: string, contentType: string, body: string): string {
  return `X-RequestId:${request}\r\nContent-Type:${contentType}\r\nPath:${path}\r\n\r\n${body}`
}

export function synthesizeEdgeTtsNode(text: string): Promise<Buffer> {
  const connectionId = hexId()
  const request = hexId()
  const params = new URLSearchParams({
    TrustedClientToken: TRUSTED_CLIENT_TOKEN,
    ConnectionId: connectionId,
    'Sec-MS-GEC': secMsGec(),
    'Sec-MS-GEC-Version': SEC_MS_GEC_VERSION,
  })
  const url = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?${params}`
  const chunks: Buffer[] = []

  return new Promise((resolve, reject) => {
    let settled = false
    const socket = new WebSocket(url, {
      origin: ORIGIN,
      headers: {
        'User-Agent': USER_AGENT,
        Cookie: `muid=${hexId().toUpperCase()};`,
        Pragma: 'no-cache',
        'Cache-Control': 'no-cache',
      },
    })

    const succeed = (audio: Buffer): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      socket.close()
      resolve(audio)
    }

    const fail = (error: Error): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      socket.close()
      reject(error)
    }

    const timer = setTimeout(() => fail(new Error('Edge TTS timed out')), 45_000)

    socket.on('open', () => {
      const config = JSON.stringify({
        context: {
          synthesis: {
            audio: {
              metadataoptions: { sentenceBoundaryEnabled: 'false', wordBoundaryEnabled: 'false' },
              outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
            },
          },
        },
      })
      const ssml =
        `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-GB">` +
        `<voice name="${EDGE_UK_MALE_VOICE}">` +
        `<prosody rate="-8%" pitch="-4%">${escapeSsml(text)}</prosody>` +
        `</voice></speak>`
      socket.send(headerText(request, 'speech.config', 'application/json; charset=utf-8', config))
      socket.send(headerText(request, 'ssml', 'application/ssml+xml', ssml))
    })

    socket.on('message', (data) => {
      if (typeof data === 'string') {
        if (data.includes('Path:turn.end')) {
          if (chunks.length === 0) fail(new Error('Edge TTS returned no audio'))
          else succeed(Buffer.concat(chunks))
        }
        return
      }
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer)
      if (buffer.length < 2) return
      const headerLength = buffer.readUInt16BE(0)
      const audio = buffer.subarray(headerLength + 2)
      if (audio.length > 0) chunks.push(audio)
    })

    socket.on('error', (error) => fail(error instanceof Error ? error : new Error(String(error))))
    socket.on('close', () => {
      if (chunks.length > 0) succeed(Buffer.concat(chunks))
      else fail(new Error('Edge TTS connection closed'))
    })
  })
}
