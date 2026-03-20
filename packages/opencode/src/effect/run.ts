import type { Effect } from "effect"

/**
 * Lazy wrappers that defer the import of @/effect/runtime to call time.
 *
 * Adapter modules must not eagerly import @/effect/runtime — or even
 * their own service modules — because bun's bundler can evaluate them
 * before their dependencies have finished initializing.
 */

/** For global services (Auth, Account, etc.) */
export async function run<A, E>(effect: Effect.Effect<A, E, any>): Promise<A> {
  const { runtime } = await import("@/effect/runtime")
  return runtime.runPromise(effect)
}

/** For instance-scoped services (Skill, Snapshot, Question, etc.) */
export async function runInstance<A, E>(effect: Effect.Effect<A, E, any>): Promise<A> {
  const { runPromiseInstance } = await import("@/effect/runtime")
  return runPromiseInstance(effect)
}
