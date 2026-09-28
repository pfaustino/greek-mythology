import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { synthesizeEdgeTtsNode } from './edge-tts-node.ts'

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf8')
}

function handleTts(req: IncomingMessage, res: ServerResponse): boolean {
  if (req.url?.split('?')[0] !== '/api/tts') return false
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.end()
    return true
  }
  void readBody(req)
    .then((text) => synthesizeEdgeTtsNode(text.slice(0, 1200)))
    .then((audio) => {
      res.statusCode = 200
      res.setHeader('Content-Type', 'audio/mpeg')
      res.end(audio)
    })
    .catch((error: unknown) => {
      res.statusCode = 502
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end(error instanceof Error ? error.message : 'Edge TTS failed')
    })
  return true
}

export function edgeTtsPlugin(): Plugin {
  return {
    name: 'edge-tts',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!handleTts(req, res)) next()
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!handleTts(req, res)) next()
      })
    },
  }
}
