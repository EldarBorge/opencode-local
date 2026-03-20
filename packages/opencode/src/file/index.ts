import { runInstance } from "@/effect/run"
import { File as S } from "./service"

const svc = () => import("./service").then((m) => m.File.Service)

export namespace File {
  export const Info = S.Info
  export type Info = S.Info
  export const Node = S.Node
  export type Node = S.Node
  export const Content = S.Content
  export type Content = S.Content
  export const Event = S.Event
  export type Interface = S.Interface
  export const Service = S.Service
  export const layer = S.layer

  export async function init() {
    return runInstance((await svc()).use((s) => s.init()))
  }

  export async function status() {
    return runInstance((await svc()).use((s) => s.status()))
  }

  export async function read(file: string): Promise<Content> {
    return runInstance((await svc()).use((s) => s.read(file)))
  }

  export async function list(dir?: string) {
    return runInstance((await svc()).use((s) => s.list(dir)))
  }

  export async function search(input: { query: string; limit?: number; dirs?: boolean; type?: "file" | "directory" }) {
    return runInstance((await svc()).use((s) => s.search(input)))
  }
}
