import type { Hooks, PluginInput } from "@opencode-ai/plugin"
import { discoverWorkflowModels } from "gitlab-ai-provider"
import { Log } from "@/util/log"
import { ProviderTransform } from "@/provider/transform"
import { ModelID, ProviderID } from "@/provider/schema"

const log = Log.create({ service: "plugin.gitlab" })

function str(value: unknown, fallback: string) {
  if (typeof value === "string" && value) return value
  return fallback
}

export async function GitlabPlugin(input: PluginInput): Promise<Hooks> {
  return {
    provider: {
      id: "gitlab",
      models: {
        async reconcile(args) {
          const url = str(args.options?.instanceUrl, "https://gitlab.com")

          const token = str(args.options?.apiKey, "")
          if (!token) return
          const headers = (): Record<string, string> => {
            if (args.auth?.type === "api") return { "PRIVATE-TOKEN": token }
            return { Authorization: `Bearer ${token}` }
          }

          try {
            log.info("gitlab model discovery starting", { instanceUrl: url })
            const res = await discoverWorkflowModels(
              { instanceUrl: url, getHeaders: headers },
              { workingDirectory: input.directory },
            )

            if (!res.models.length) {
              log.info("gitlab model discovery skipped: no models found", {
                project: res.project ? { id: res.project.id, path: res.project.pathWithNamespace } : null,
              })
              return
            }
            for (const model of res.models) {
              if (args.models[model.id]) {
                continue
              }

              const m = {
                id: ModelID.make(model.id),
                providerID: ProviderID.make("gitlab"),
                name: `Agent Platform (${model.name})`,
                api: {
                  id: model.id,
                  url,
                  npm: "gitlab-ai-provider",
                },
                status: "active" as const,
                headers: {},
                options: { workflowRef: model.ref },
                cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
                limit: { context: model.context, output: model.output },
                capabilities: {
                  temperature: false,
                  reasoning: true,
                  attachment: true,
                  toolcall: true,
                  input: { text: true, audio: false, image: true, video: false, pdf: true },
                  output: { text: true, audio: false, image: false, video: false, pdf: false },
                  interleaved: false,
                },
                release_date: "",
                variants: {} as Record<string, Record<string, any>>,
              }
              m.variants = ProviderTransform.variants(m)
              args.models[model.id] = m
            }

            return args.models
          } catch (err) {
            log.warn("gitlab model discovery failed", { error: err })
            return
          }
        },
      },
    },
  }
}
