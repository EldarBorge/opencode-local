import { runInstance } from "@/effect/run"
import { Permission as S } from "./service"

const svc = () => import("./service").then((m) => m.Permission.Service)

export namespace PermissionNext {
  export const Action = S.Action
  export type Action = S.Action
  export const Rule = S.Rule
  export type Rule = S.Rule
  export type Ruleset = S.Ruleset
  export const Request = S.Request
  export type Request = S.Request
  export const Reply = S.Reply
  export type Reply = S.Reply
  export const Approval = S.Approval
  export const Event = S.Event
  export const RejectedError = S.RejectedError
  export const CorrectedError = S.CorrectedError
  export const DeniedError = S.DeniedError
  export type Error = S.Error
  export const AskInput = S.AskInput
  export const ReplyInput = S.ReplyInput
  export type Interface = S.Interface
  export const Service = S.Service
  export const layer = S.layer
  export const evaluate = S.evaluate
  export const fromConfig = S.fromConfig
  export const merge = S.merge
  export const disabled = S.disabled

  export async function ask(input: S.AskInput) {
    return runInstance((await svc()).use((s) => s.ask(input)))
  }

  export async function reply(input: S.ReplyInput) {
    return runInstance((await svc()).use((s) => s.reply(input)))
  }

  export async function list() {
    return runInstance((await svc()).use((s) => s.list()))
  }
}
