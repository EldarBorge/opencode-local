import type { Agent } from "../agent/agent"
import { run } from "@/effect/run"

const svc = () => import("./truncate-effect").then((m) => m.Truncate.Service)

export namespace Truncate {
  export async function output(text: string, options: any = {}, agent?: Agent.Info) {
    return run((await svc()).use((s) => s.output(text, options, agent)))
  }
}
