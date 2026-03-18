import { describe, expect, test } from "bun:test"
import { anthropicHelper } from "../src/routes/zen/util/provider/anthropic"
import { googleHelper } from "../src/routes/zen/util/provider/google"
import { openaiHelper } from "../src/routes/zen/util/provider/openai"
import { oaCompatHelper } from "../src/routes/zen/util/provider/openai-compatible"

describe("provider usage extraction", () => {
  test("reads OpenAI Responses usage from response.usage", () => {
    const helper = openaiHelper({ reqModel: "gpt-5.4", providerModel: "gpt-5.4" })

    expect(
      helper.extractBodyUsage({
        response: {
          usage: {
            input_tokens: 13,
            input_tokens_details: { cached_tokens: 3 },
            output_tokens: 5,
            output_tokens_details: { reasoning_tokens: 1 },
          },
        },
      }),
    ).toEqual({
      input_tokens: 13,
      input_tokens_details: { cached_tokens: 3 },
      output_tokens: 5,
      output_tokens_details: { reasoning_tokens: 1 },
    })
  })

  test("reads Anthropic usage from message.usage", () => {
    const helper = anthropicHelper({ reqModel: "claude-sonnet", providerModel: "claude-sonnet-4-5" })

    expect(
      helper.extractBodyUsage({
        message: {
          usage: {
            input_tokens: 10,
            output_tokens: 4,
          },
        },
      }),
    ).toEqual({
      input_tokens: 10,
      output_tokens: 4,
    })
  })

  test("reads OA-compatible usage from usage", () => {
    const helper = oaCompatHelper({ reqModel: "gpt-4o-mini", providerModel: "gpt-4o-mini" })

    expect(
      helper.extractBodyUsage({
        usage: {
          prompt_tokens: 8,
          completion_tokens: 2,
        },
      }),
    ).toEqual({
      prompt_tokens: 8,
      completion_tokens: 2,
    })
  })

  test("reads Google usage from usageMetadata", () => {
    const helper = googleHelper({ reqModel: "gemini-2.5-flash", providerModel: "gemini-2.5-flash" })

    expect(
      helper.extractBodyUsage({
        usageMetadata: {
          promptTokenCount: 11,
          candidatesTokenCount: 3,
        },
      }),
    ).toEqual({
      promptTokenCount: 11,
      candidatesTokenCount: 3,
    })
  })
})
