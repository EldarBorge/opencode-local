type Model = {
  providerID: string
  api: {
    id: string
    npm: string
  }
}

function lower(model: Pick<Model, "api">) {
  return model.api.id.toLowerCase()
}

type Input = {
  codex?: boolean
}

export function kind(model: Pick<Model, "providerID" | "api">, input?: Input) {
  const id = lower(model)
  if (
    model.providerID === "anthropic" &&
    model.api.npm === "@ai-sdk/anthropic" &&
    (id.includes("claude-opus-4-6") || id.includes("claude-opus-4.6") || id.includes("opus-4-6"))
  ) {
    return "claude"
  }
  if (
    model.providerID === "openai" &&
    input?.codex === true &&
    model.api.npm === "@ai-sdk/openai" &&
    id.includes("gpt-5.4")
  ) {
    return "codex"
  }
}

export function enabled(model: Pick<Model, "providerID" | "api">, input?: Input) {
  return !!kind(model, input)
}

export function options(model: Pick<Model, "providerID" | "api">, input?: Input) {
  const mode = kind(model, input)
  if (mode === "claude") return { speed: "fast" }
  if (mode === "codex") return { serviceTier: "priority" }
  return {}
}
