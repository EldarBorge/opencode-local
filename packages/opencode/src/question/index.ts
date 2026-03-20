import { runInstance } from "@/effect/run"
import type { MessageID, SessionID } from "@/session/schema"
import type { QuestionID } from "./schema"
import type { Question as S } from "./service"

const svc = () => import("./service").then((m) => m.Question.Service)

export namespace Question {
  export async function ask(input: {
    sessionID: SessionID
    questions: S.Info[]
    tool?: { messageID: MessageID; callID: string }
  }): Promise<S.Answer[]> {
    return runInstance((await svc()).use((s) => s.ask(input)))
  }

  export async function reply(input: { requestID: QuestionID; answers: S.Answer[] }) {
    return runInstance((await svc()).use((s) => s.reply(input)))
  }

  export async function reject(requestID: QuestionID) {
    return runInstance((await svc()).use((s) => s.reject(requestID)))
  }

  export async function list() {
    return runInstance((await svc()).use((s) => s.list()))
  }
}
