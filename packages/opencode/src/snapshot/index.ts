import { runInstance } from "@/effect/run"
import { Snapshot as S } from "./service"

const svc = () => import("./service").then((m) => m.Snapshot.Service)

export namespace Snapshot {
  export const Patch = S.Patch
  export type Patch = S.Patch
  export const FileDiff = S.FileDiff
  export type FileDiff = S.FileDiff
  export type Interface = S.Interface
  export const Service = S.Service
  export const layer = S.layer
  export const defaultLayer = S.defaultLayer

  export async function cleanup() {
    return runInstance((await svc()).use((s) => s.cleanup()))
  }

  export async function track() {
    return runInstance((await svc()).use((s) => s.track()))
  }

  export async function patch(hash: string) {
    return runInstance((await svc()).use((s) => s.patch(hash)))
  }

  export async function restore(snapshot: string) {
    return runInstance((await svc()).use((s) => s.restore(snapshot)))
  }

  export async function revert(patches: Patch[]) {
    return runInstance((await svc()).use((s) => s.revert(patches)))
  }

  export async function diff(hash: string) {
    return runInstance((await svc()).use((s) => s.diff(hash)))
  }

  export async function diffFull(from: string, to: string) {
    return runInstance((await svc()).use((s) => s.diffFull(from, to)))
  }
}
