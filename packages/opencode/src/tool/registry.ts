import type { Agent } from "../agent/agent"
import { Tool } from "./tool"
import path from "path"
import { type ToolContext as PluginToolContext, type ToolDefinition } from "@opencode-ai/plugin"
import z from "zod"
import { ProviderID, type ModelID } from "../provider/schema"
import { Flag } from "@/flag/flag"
import { Log } from "@/util/log"
import { Truncate } from "./truncate"
import { Glob } from "../util/glob"
import { pathToFileURL } from "url"
import { Effect, Layer, ServiceMap } from "effect"
import { InstanceContext } from "@/effect/instance-context"

export namespace ToolRegistry {
  const log = Log.create({ service: "tool.registry" })

  export interface Interface {
    readonly register: (tool: Tool.Info) => Effect.Effect<void>
    readonly ids: () => Effect.Effect<string[]>
    readonly tools: (
      model: { providerID: ProviderID; modelID: ModelID },
      agent?: Agent.Info,
    ) => Effect.Effect<(Awaited<ReturnType<Tool.Info["init"]>> & { id: string })[]>
  }

  export class Service extends ServiceMap.Service<Service, Interface>()("@opencode/ToolRegistry") {}

  export const layer = Layer.effect(
    Service,
    Effect.gen(function* () {
      const instance = yield* InstanceContext

      const custom: Tool.Info[] = []
      let task: Promise<void> | undefined

      const load = Effect.fn("ToolRegistry.load")(function* () {
        yield* Effect.promise(async () => {
          const [{ Config }, { Plugin }] = await Promise.all([import("../config/config"), import("../plugin")])
          const matches = await Config.directories().then((dirs) =>
            dirs.flatMap((dir) =>
              Glob.scanSync("{tool,tools}/*.{js,ts}", { cwd: dir, absolute: true, dot: true, symlink: true }),
            ),
          )
          if (matches.length) await Config.waitForDependencies()
          for (const match of matches) {
            const namespace = path.basename(match, path.extname(match))
            const mod = await import(process.platform === "win32" ? match : pathToFileURL(match).href)
            for (const [id, def] of Object.entries<ToolDefinition>(mod)) {
              custom.push(fromPlugin(id === "default" ? namespace : `${namespace}_${id}`, def))
            }
          }

          const plugins = await Plugin.list()
          for (const plugin of plugins) {
            for (const [id, def] of Object.entries(plugin.tool ?? {})) {
              custom.push(fromPlugin(id, def))
            }
          }
        })
      })

      const ensure = Effect.fn("ToolRegistry.ensure")(function* () {
        yield* Effect.promise(() => {
          task ??= Effect.runPromise(
            load().pipe(Effect.catchCause((cause) => Effect.sync(() => log.error("init failed", { cause })))),
          )
          return task
        })
      })

      function fromPlugin(id: string, def: ToolDefinition): Tool.Info {
        return {
          id,
          init: async (initCtx) => ({
            parameters: z.object(def.args),
            description: def.description,
            execute: async (args, ctx) => {
              const pluginCtx = {
                ...ctx,
                directory: instance.directory,
                worktree: instance.worktree,
              } as unknown as PluginToolContext
              const result = await def.execute(args as any, pluginCtx)
              const out = await Truncate.output(result, {}, initCtx?.agent)
              return {
                title: "",
                output: out.truncated ? out.content : result,
                metadata: { truncated: out.truncated, outputPath: out.truncated ? out.outputPath : undefined },
              }
            },
          }),
        }
      }

      async function all(): Promise<Tool.Info[]> {
        const { Config } = await import("../config/config")
        const config = await Config.get()
        const question = ["app", "cli", "desktop"].includes(Flag.OPENCODE_CLIENT) || Flag.OPENCODE_ENABLE_QUESTION_TOOL
        const [
          invalid,
          questionMod,
          bash,
          read,
          glob,
          grep,
          edit,
          write,
          task,
          webfetch,
          todo,
          websearch,
          codesearch,
          skill,
          applyPatch,
          lsp,
          batch,
          plan,
        ] = await Promise.all([
          import("./invalid"),
          import("./question"),
          import("./bash"),
          import("./read"),
          import("./glob"),
          import("./grep"),
          import("./edit"),
          import("./write"),
          import("./task"),
          import("./webfetch"),
          import("./todo"),
          import("./websearch"),
          import("./codesearch"),
          import("./skill"),
          import("./apply_patch"),
          import("./lsp"),
          import("./batch"),
          import("./plan"),
        ])

        return [
          invalid.InvalidTool,
          ...(question ? [questionMod.QuestionTool] : []),
          bash.BashTool,
          read.ReadTool,
          glob.GlobTool,
          grep.GrepTool,
          edit.EditTool,
          write.WriteTool,
          task.TaskTool,
          webfetch.WebFetchTool,
          todo.TodoWriteTool,
          // TodoReadTool,
          websearch.WebSearchTool,
          codesearch.CodeSearchTool,
          skill.SkillTool,
          applyPatch.ApplyPatchTool,
          ...(Flag.OPENCODE_EXPERIMENTAL_LSP_TOOL ? [lsp.LspTool] : []),
          ...(config.experimental?.batch_tool === true ? [batch.BatchTool] : []),
          ...(Flag.OPENCODE_EXPERIMENTAL_PLAN_MODE && Flag.OPENCODE_CLIENT === "cli" ? [plan.PlanExitTool] : []),
          ...custom,
        ]
      }

      const register = Effect.fn("ToolRegistry.register")(function* (tool: Tool.Info) {
        yield* ensure()
        const idx = custom.findIndex((t) => t.id === tool.id)
        if (idx >= 0) {
          custom.splice(idx, 1, tool)
          return
        }
        custom.push(tool)
      })

      const ids = Effect.fn("ToolRegistry.ids")(function* () {
        yield* ensure()
        const tools = yield* Effect.promise(() => all())
        return tools.map((t) => t.id)
      })

      const tools = Effect.fn("ToolRegistry.tools")(function* (
        model: { providerID: ProviderID; modelID: ModelID },
        agent?: Agent.Info,
      ) {
        yield* ensure()
        const allTools = yield* Effect.promise(() => all())
        return yield* Effect.promise(() =>
          Promise.all(
            allTools
              .filter((t) => {
                // Enable websearch/codesearch for zen users OR via enable flag
                if (t.id === "codesearch" || t.id === "websearch") {
                  return model.providerID === ProviderID.opencode || Flag.OPENCODE_ENABLE_EXA
                }

                // use apply tool in same format as codex
                const usePatch =
                  model.modelID.includes("gpt-") && !model.modelID.includes("oss") && !model.modelID.includes("gpt-4")
                if (t.id === "apply_patch") return usePatch
                if (t.id === "edit" || t.id === "write") return !usePatch

                return true
              })
              .map(async (t) => {
                using _ = log.time(t.id)
                const tool = await t.init({ agent })
                const output = {
                  description: tool.description,
                  parameters: tool.parameters,
                }
                const { Plugin } = await import("../plugin")
                await Plugin.trigger("tool.definition", { toolID: t.id }, output)
                return {
                  id: t.id,
                  ...tool,
                  description: output.description,
                  parameters: output.parameters,
                }
              }),
          ),
        )
      })

      return Service.of({ register, ids, tools })
    }),
  ).pipe(Layer.fresh)

  async function run<A, E>(effect: Effect.Effect<A, E, Service>) {
    const { runPromiseInstance } = await import("@/effect/runtime")
    return runPromiseInstance(effect)
  }

  export async function register(tool: Tool.Info) {
    return run(Service.use((svc) => svc.register(tool)))
  }

  export async function ids() {
    return run(Service.use((svc) => svc.ids()))
  }

  export async function tools(
    model: {
      providerID: ProviderID
      modelID: ModelID
    },
    agent?: Agent.Info,
  ) {
    return run(Service.use((svc) => svc.tools(model, agent)))
  }
}
