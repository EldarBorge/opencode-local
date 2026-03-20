import { runInstance } from "@/effect/run"
import { fn } from "@/util/fn"
import { ProviderID } from "./schema"
import z from "zod"
import { ProviderAuth as S } from "./auth-service"

const svc = () => import("./auth-service").then((m) => m.ProviderAuth.Service)

export namespace ProviderAuth {
  export const Method = S.Method
  export type Method = S.Method
  export const Authorization = S.Authorization
  export type Authorization = S.Authorization
  export const OauthMissing = S.OauthMissing
  export const OauthCodeMissing = S.OauthCodeMissing
  export const OauthCallbackFailed = S.OauthCallbackFailed
  export const ValidationFailed = S.ValidationFailed
  export type Error = S.Error
  export type Interface = S.Interface
  export const Service = S.Service
  export const layer = S.layer
  export const defaultLayer = S.defaultLayer

  export async function methods() {
    return runInstance((await svc()).use((s) => s.methods()))
  }

  export const authorize = fn(
    z.object({
      providerID: ProviderID.zod,
      method: z.number(),
      inputs: z.record(z.string(), z.string()).optional(),
    }),
    async (input): Promise<Authorization | undefined> =>
      runInstance((await svc()).use((s) => s.authorize(input))),
  )

  export const callback = fn(
    z.object({
      providerID: ProviderID.zod,
      method: z.number(),
      code: z.string().optional(),
    }),
    async (input) => runInstance((await svc()).use((s) => s.callback(input))),
  )
}
