import type { Agent } from "@/agent/agent"
import { runInstance } from "@/effect/run"

const svc = () => import("./service").then((m) => m.Skill.Service)

export namespace Skill {
  export async function get(name: string) {
    return runInstance((await svc()).use((s) => s.get(name)))
  }

  export async function all() {
    return runInstance((await svc()).use((s) => s.all()))
  }

  export async function dirs() {
    return runInstance((await svc()).use((s) => s.dirs()))
  }

  export async function available(agent?: Agent.Info) {
    return runInstance((await svc()).use((s) => s.available(agent)))
  }
}
