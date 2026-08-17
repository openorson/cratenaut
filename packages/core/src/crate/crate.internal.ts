import type { ICrateRuntimeState } from "../internal/internal.types";
import type { ICrateInstance } from "./crate.types";

/**
 * `Crate` 实例与内部运行状态的映射
 */
const crateRuntimeStates = new WeakMap<object, ICrateRuntimeState>();

/**
 * 记录 `Crate` 实例的内部运行状态
 *
 * @internal
 */
export function registerCrateRuntimeState(instance: ICrateInstance, state: ICrateRuntimeState): void {
  crateRuntimeStates.set(instance, state);
}

/**
 * 获取 `Crate` 实例的内部运行状态
 *
 * @internal
 */
export function getCrateRuntimeState(instance: ICrateInstance): ICrateRuntimeState {
  const state = crateRuntimeStates.get(instance);

  if (state === undefined) {
    throw new TypeError("无法识别 Crate 实例");
  }

  return state;
}
