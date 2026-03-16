type Model = {
  id: string
  provider: {
    id: string
  }
}

function lower(model: Model) {
  return model.id.toLowerCase()
}

export function kind(model: Model | undefined) {
  if (!model) return
  const id = lower(model)
  if (
    model.provider.id === "anthropic" &&
    (id.includes("claude-opus-4-6") || id.includes("claude-opus-4.6") || id.includes("opus-4-6"))
  ) {
    return "claude"
  }
  if (model.provider.id === "openai" && id.includes("gpt-5.4")) {
    return "codex"
  }
}

export function enabled(model: Model | undefined) {
  return !!kind(model)
}
