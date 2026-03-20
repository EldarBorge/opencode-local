import { runInstance } from "@/effect/run"
import type { MessageID, SessionID } from "@/session/schema"
import type { QuestionID } from "./schema"
import { Question as S } from "./service"

const svc = () => import("./service").then((m) => m.Question.Service)

export namespace Question {
  export const Info = S.Info
  export type Info = S.Info
  export const Request = S.Request
  export type Request = S.Request
  export const Answer = S.Answer
  export type Answer = S.Answer
  export const Reply = S.Reply
  export type Reply = S.Reply
  export const Option = S.Option
  export type Option = S.Option
  export const Event = S.Event
  export const RejectedError = S.RejectedError
  export type Interface = S.Interface
  export const Service = S.Service
  export const layer = S.layer

  export async function ask(input: {
    sessionID: SessionID
    questions: Info[]
    tool?: { messageID: MessageID; callID: string }
  }): Promise<Answer[]> {
    return runInstance((await svc()).use((s) => s.ask(input)))
  }

  export async function reply(input: { requestID: QuestionID; answers: Answer[] }) {
    return runInstance((await svc()).use((s) => s.reply(input)))
  }

  export async function reject(requestID: QuestionID) {
    return runInstance((await svc()).use((s) => s.reject(requestID)))
  }

  export async function list() {
    return runInstance((await svc()).use((s) => s.list()))
  }
}
