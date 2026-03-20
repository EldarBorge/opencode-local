import { runInstance } from "@/effect/run"
import type { ProviderAuth as S } from "./auth-service"

const svc = () => import("./auth-service").then((m) => m.ProviderAuth.Service)

export namespace ProviderAuth {
  export async function methods() {
    return runInstance((await svc()).use((s) => s.methods()))
  }

  export async function authorize(input: {
    providerID: string
    method: number
    inputs?: Record<string, string>
  }): Promise<S.Authorization | undefined> {
    return runInstance((await svc()).use((s) => s.authorize(input as any)))
  }

  export async function callback(input: { providerID: string; method: number; code?: string }) {
    return runInstance((await svc()).use((s) => s.callback(input as any)))
  }
}
