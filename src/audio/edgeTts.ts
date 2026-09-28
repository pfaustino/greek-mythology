const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
const WIN_EPOCH = 11_644_473_600
const SEC_MS_GEC_VERSION = '1-143.0.3650.96'
export const EDGE_UK_MALE_VOICE = 'en-GB-RyanNeural'

export function escapeSsml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

export async function secMsGec(unixSeconds = Date.now() / 1000): Promise<string> {
  const windows = Math.floor(unixSeconds + WIN_EPOCH)
  const floored = BigInt(windows - (windows % 300))
  const ticks = floored * 10_000_000n
  const bytes = new TextEncoder().encode(`${ticks.toString()}${TRUSTED_CLIENT_TOKEN}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase()
}

function requestId(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function headerText(request: string, path: string, contentType: string, body: string): string {
  return `X-RequestId:${request}\r\nContent-Type:${contentType}\r\nPath:${path}\r\n\r\n${body}`
}

function audioFromBinary(data: ArrayBuffer): Uint8Array | null {
  if (data.byteLength < 2) return null
  const view = new DataView(data)
  const headerLength = view.getUint16(0, false)
  const start = headerLength + 2
  if (start >= data.byteLength) return null
  return new Uint8Array(data, start)
}

export async function synthesizeEdgeTts(text: string, signal: AbortSignal): Promise<Blob> {
  const gec = await secMsGec()
  const connectionId = requestId()
  const request = requestId()
  const params = new URLSearchParams({
    TrustedClientToken: TRUSTED_CLIENT_TOKEN,
    ConnectionId: connectionId,
    'Sec-MS-GEC': gec,
    'Sec-MS-GEC-Version': SEC_MS_GEC_VERSION,
  })
  const url = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?${params}`
  const chunks: Uint8Array[] = []

  await new Promise<void>((resolve, reject) => {
    const socket = new WebSocket(url)
    socket.binaryType = 'arraybuffer'
    let settled = false

    const succeed = (): void => {
      if (settled) return
      settled = true
      signal.removeEventListener('abort', onAbort)
      socket.close()
      resolve()
    }

    const fail = (error: Error): void => {
      if (settled) return
      settled = true
      signal.removeEventListener('abort', onAbort)
      socket.close()
      reject(error)
    }

    const onAbort = (): void => {
      fail(new DOMException('Narration cancelled', 'AbortError'))
    }
    if (signal.aborted) {
      onAbort()
      return
    }
    signal.addEventListener('abort', onAbort, { once: true })

    socket.addEventListener('open', () => {
      const config = JSON.stringify({
        context: {
          synthesis: {
            audio: {
              metadataoptions: {
                sentenceBoundaryEnabled: 'false',
                wordBoundaryEnabled: 'false',
              },
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

    socket.addEventListener('message', (event) => {
      if (typeof event.data === 'string') {
        if (event.data.includes('Path:turn.end')) succeed()
        return
      }
      const audio = audioFromBinary(event.data as ArrayBuffer)
      if (audio && audio.byteLength > 0) chunks.push(audio)
    })

    socket.addEventListener('error', () => {
      fail(new Error('Edge TTS connection failed'))
    })
    socket.addEventListener('close', () => {
      if (chunks.length > 0) succeed()
      else fail(new Error('Edge TTS connection closed'))
    })
  })

  if (chunks.length === 0) throw new Error('Edge TTS returned no audio')
  const bytes = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0))
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new Blob([bytes], { type: 'audio/mpeg' })
}
