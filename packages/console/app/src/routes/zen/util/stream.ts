const done = new Set(["[DONE]", "message_stop", "response.completed"])

type Dump = {
  provideStream: (chunk: string) => void
  flush: () => void
}

type Opts = {
  body: ReadableStream<Uint8Array> | null | undefined
  separator: string
  signal: AbortSignal
  start: number
  same: boolean
  binary?: (chunk: Uint8Array) => Uint8Array | undefined
  parse: (part: string) => void
  convert: (part: string) => string
  tail: () => Promise<string | undefined>
  metric: (values: Record<string, unknown>) => void
  dump?: Dump
}

export const eventName = (part: string) => {
  const line = part.split("\n", 1)[0]?.trim() ?? ""
  if (line.startsWith("event:")) return line.slice(6).trim() || "message"
  if (part.includes("[DONE]")) return "[DONE]"
  if (line.startsWith("data:")) return "message"
  return "unknown"
}

const errInfo = (err: unknown) => {
  if (err instanceof Error) {
    return {
      "stream.error_type": err.constructor.name,
      "stream.error_message": err.message,
    }
  }

  return {
    "stream.error_type": typeof err,
    "stream.error_message": String(err),
  }
}

const stats = (len: number, cnt: number, seen: number, buf: string, end: string | undefined, gap: number) => ({
  "stream.response_length": len,
  "stream.chunk_count": cnt,
  "stream.event_count": seen,
  "stream.pending_length": buf.length,
  "stream.last_event": end,
  "stream.max_gap_ms": gap || undefined,
})

export const relay = (opts: Opts) =>
  new ReadableStream({
    async start(c) {
      let phase = "start"
      let len = 0
      let cnt = 0
      let seen = 0
      let end: string | undefined
      let gap = 0
      let prev: number | undefined
      let completed = false
      let aborted = false
      let buf = ""

      if (!opts.body) {
        opts.metric({
          "stream.event": "missing_body",
          "stream.phase": phase,
        })
        opts.dump?.flush()
        c.close()
        return
      }

      const reader = opts.body.getReader()
      const dec = new TextDecoder()
      const enc = new TextEncoder()
      const names: Record<string, number> = {}

      const abort = () => {
        aborted = true
        reader.cancel().catch(() => undefined)
      }

      const note = (part: string) => {
        const name = eventName(part)
        end = name
        seen += 1
        names[name] = (names[name] ?? 0) + 1
        if (done.has(name)) completed = true
      }

      opts.signal.addEventListener("abort", abort)
      opts.metric({
        "stream.event": "started",
      })

      try {
        while (true) {
          phase = "read"
          const raw = await reader.read()
          if (raw.done) break

          if (len === 0) {
            const now = Date.now()
            opts.metric({
              time_to_first_byte: now - opts.start,
              "timestamp.first_byte": now,
            })
          }

          const value = opts.binary ? opts.binary(raw.value) : raw.value
          if (!value) continue

          cnt += 1
          len += value.length
          const now = Date.now()
          if (prev !== undefined) gap = Math.max(gap, now - prev)
          prev = now

          const text = dec.decode(value, { stream: true })
          buf += text
          opts.dump?.provideStream(text)

          const parts = buf.split(opts.separator)
          buf = parts.pop() ?? ""

          for (let part of parts) {
            part = part.trim()
            if (!part) continue
            note(part)
            phase = "parse"
            opts.parse(part)
            if (opts.same) continue
            phase = "convert"
            c.enqueue(enc.encode(opts.convert(part) + "\n\n"))
          }

          if (opts.same) c.enqueue(value)
        }

        const tail = dec.decode()
        if (tail) {
          buf += tail
          opts.dump?.provideStream(tail)
        }

        if (buf.trim()) {
          const part = buf.trim()
          note(part)
          phase = "parse"
          opts.parse(part)
          if (!opts.same) {
            phase = "convert"
            c.enqueue(enc.encode(opts.convert(part) + "\n\n"))
          }
          buf = ""
        }

        opts.metric({
          response_length: len,
          "timestamp.last_byte": Date.now(),
        })
        opts.dump?.flush()

        phase = "tail"
        const chunk = await opts.tail()
        if (chunk) c.enqueue(enc.encode(chunk))

        c.close()
        opts.metric({
          "stream.event": "finished",
          "stream.phase": "done",
          "stream.duration_ms": Date.now() - opts.start,
          "stream.saw_completed": completed,
          "stream.events": JSON.stringify(names),
          ...stats(len, cnt, seen, buf, end, gap),
        })
      } catch (err) {
        opts.metric({
          "stream.event": aborted ? "aborted" : "error",
          "stream.phase": phase,
          "stream.duration_ms": Date.now() - opts.start,
          "stream.saw_completed": completed,
          "stream.events": JSON.stringify(names),
          ...stats(len, cnt, seen, buf, end, gap),
          ...errInfo(err),
        })
        c.error(err)
      } finally {
        opts.signal.removeEventListener("abort", abort)
      }
    },
  })
