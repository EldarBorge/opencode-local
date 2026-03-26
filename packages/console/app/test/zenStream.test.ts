import { describe, expect, test } from "bun:test"
import { eventName, relay } from "../src/routes/zen/util/stream"

const enc = new TextEncoder()

const read = (stream: ReadableStream<Uint8Array>) => new Response(stream).text()

const body = (parts: string[]) =>
  new ReadableStream<Uint8Array>({
    async start(c) {
      for (const part of parts) c.enqueue(enc.encode(part))
      c.close()
    },
  })

describe("zen stream", () => {
  test("parses known event names", () => {
    expect(eventName("event: response.created\ndata: {}")).toBe("response.created")
    expect(eventName('data: {"ok":true}')).toBe("message")
    expect(eventName("data: [DONE]")).toBe("[DONE]")
  })

  test("relays split OpenAI responses and logs completion", async () => {
    const seen: string[] = []
    const logs: Array<Record<string, unknown>> = []
    const stream = relay({
      body: body([
        "event: response.created\n",
        'data: {"type":"response.created"}\n\n',
        "event: response.completed\n",
        'data: {"response":{"usage":{"input_tokens":1,"output_tokens":2}}}\n\n',
      ]),
      separator: "\n\n",
      signal: new AbortController().signal,
      start: Date.now(),
      same: true,
      parse: (part) => {
        seen.push(part)
      },
      convert: (part) => part,
      tail: async () => undefined,
      metric: (values) => logs.push(values),
    })

    const text = await read(stream)
    expect(text).toContain("response.created")
    expect(text).toContain("response.completed")
    expect(seen).toHaveLength(2)
    expect(logs.at(-1)?.["stream.event"]).toBe("finished")
    expect(logs.at(-1)?.["stream.saw_completed"]).toBe(true)
  })

  test("keeps reading when binary decoder needs another chunk", async () => {
    let calls = 0
    const logs: Array<Record<string, unknown>> = []
    const stream = relay({
      body: body(["a", "b"]),
      separator: "\n\n",
      signal: new AbortController().signal,
      start: Date.now(),
      same: true,
      binary: (chunk) => {
        calls += 1
        if (calls === 1) return
        return chunk
      },
      parse: () => undefined,
      convert: (part) => part,
      tail: async () => undefined,
      metric: (values) => logs.push(values),
    })

    const text = await read(stream)
    expect(text).toBe("b")
    expect(logs.at(-1)?.["stream.event"]).toBe("finished")
  })

  test("flushes a final unterminated event at EOF", async () => {
    const seen: string[] = []
    const logs: Array<Record<string, unknown>> = []
    const stream = relay({
      body: body(['event: response.completed\ndata: {"response":{"usage":{"input_tokens":1}}}']),
      separator: "\n\n",
      signal: new AbortController().signal,
      start: Date.now(),
      same: true,
      parse: (part) => {
        seen.push(part)
      },
      convert: (part) => part,
      tail: async () => undefined,
      metric: (values) => logs.push(values),
    })

    const text = await read(stream)
    expect(text).toContain("response.completed")
    expect(seen).toHaveLength(1)
    expect(logs.at(-1)?.["stream.saw_completed"]).toBe(true)
  })

  test("closes cleanly when upstream body is missing", async () => {
    const logs: Array<Record<string, unknown>> = []
    const stream = relay({
      body: null,
      separator: "\n\n",
      signal: new AbortController().signal,
      start: Date.now(),
      same: true,
      parse: () => undefined,
      convert: (part) => part,
      tail: async () => undefined,
      metric: (values) => logs.push(values),
    })

    expect(await read(stream)).toBe("")
    expect(logs.at(-1)?.["stream.event"]).toBe("missing_body")
  })

  test("surfaces postprocess failures with stream metrics", async () => {
    const logs: Array<Record<string, unknown>> = []
    const stream = relay({
      body: body(["event: response.created\ndata: {}\n\n"]),
      separator: "\n\n",
      signal: new AbortController().signal,
      start: Date.now(),
      same: true,
      parse: () => undefined,
      convert: (part) => part,
      tail: async () => {
        throw new Error("boom")
      },
      metric: (values) => logs.push(values),
    })

    await expect(read(stream)).rejects.toThrow("boom")
    expect(logs.at(-1)?.["stream.event"]).toBe("error")
    expect(logs.at(-1)?.["stream.phase"]).toBe("tail")
  })
})
