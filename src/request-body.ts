import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { createError, createEvent, getHeader, readBody, type H3Event } from 'h3'

/** Maximum bytes accepted by host and SDK structured request readers. */
export const GCS_REQUEST_BODY_MAX_BYTES = 1024 * 1024

const requests = new WeakMap<H3Event, Promise<{ body: unknown; raw: string }>>()

/**
 * Read socket bytes before invoking H3's otherwise unbounded body parser.
 * @param event - Host request whose structured body is being read.
 * @returns Cached parsed body and exact bounded UTF-8 bytes.
 */
export const readBoundedRequestBody = (event: H3Event): Promise<{ body: unknown; raw: string }> => {
  const existing = requests.get(event)
  if (existing) return existing
  const pending = readRequest(event)
  requests.set(event, pending)
  return pending
}

const readRequest = async (event: H3Event): Promise<{ body: unknown; raw: string }> => {
  const request = event.node.req
  const tooLarge = () => createError({ statusCode: 413, statusMessage: 'Payload Too Large' })
  const declared = getHeader(event, 'content-length')
  if (declared && Number(declared) > GCS_REQUEST_BODY_MAX_BYTES) {
    request.resume()
    throw tooLarge()
  }
  const chunks: Buffer[] = []
  let size = 0
  try {
    for await (const rawChunk of request.iterator({ destroyOnReturn: false })) {
      const chunk = Buffer.isBuffer(rawChunk) ? rawChunk : Buffer.from(rawChunk)
      size += chunk.byteLength
      if (size > GCS_REQUEST_BODY_MAX_BYTES) throw tooLarge()
      chunks.push(chunk)
    }
  } catch (error: unknown) {
    if (!request.destroyed) request.resume()
    throw error
  }
  const bytes = Buffer.concat(chunks, size)
  // A fresh public H3 event preserves its JSON/form/text parsing contract without
  // depending on private caches or Nuxt's pre-buffering portable body stream.
  const bounded = new IncomingMessage(new Socket())
  bounded.method = request.method
  bounded.headers = { ...request.headers, 'content-length': String(bytes.byteLength) }
  bounded.push(bytes)
  bounded.push(null)
  const body: unknown = await readBody(createEvent(bounded, new ServerResponse(bounded)))
  return { body, raw: bytes.toString('utf8') }
}
