import { diagnostics } from "../diagnostic/diagnostic.catalog";
import { createContainerName } from "../layout/layout.resolve";
import type { IOutput } from "../output/output.types";
import type { IContainerState } from "../docker/docker.types";
import type { IServerSpecification } from "../specification/specification.types";
import type { IContainerTarget } from "./container.types";

/**
 * 收集服务器规格中的全部容器
 */
export function collectContainers(specification: IServerSpecification): readonly IContainerTarget[] {
  const targets: IContainerTarget[] = [];

  for (const crate of specification.crates) {
    for (const resource of crate.resources) {
      if (resource.kind === "container") {
        targets.push(
          Object.freeze({
            crateId: crate.id,
            resource,
            name: createContainerName(specification.project, specification.server, crate.id, resource.id),
          }),
        );
      }
    }
  }

  return Object.freeze(targets);
}

/**
 * 选择一个需要日志或命令交互的容器
 */
export async function selectContainer(
  specification: IServerSpecification,
  output: IOutput,
  resourceId?: string,
): Promise<IContainerTarget> {
  const containers = collectContainers(specification);

  if (resourceId !== undefined) {
    const target = containers.find(
      (container) =>
        container.resource.id === resourceId || `${container.crateId}/${container.resource.id}` === resourceId,
    );

    if (target === undefined) {
      throw diagnostics.CRN_CLI_1003({ subject: "容器资源", value: resourceId });
    }

    return target;
  }

  if (containers.length === 1) {
    return containers[0]!;
  }

  if (output.mode !== "interactive") {
    throw diagnostics.CRN_CLI_1004();
  }

  const selected = await output.select(
    "选择容器",
    containers.map((container) => ({
      value: `${container.crateId}/${container.resource.id}`,
      label: `${container.crateId}/${container.resource.id}`,
      hint: container.resource.image,
    })),
  );
  return containers.find((container) => `${container.crateId}/${container.resource.id}` === selected)!;
}

/**
 * 确认同名容器确实属于当前项目和服务器
 */
export function assertManagedContainer(
  target: IContainerTarget,
  state: IContainerState,
  project: string,
  server: string,
): void {
  if (
    !state.exists ||
    state.labels["io.cratenaut.managed"] !== "true" ||
    state.labels["io.cratenaut.project"] !== project ||
    state.labels["io.cratenaut.server"] !== server ||
    state.labels["io.cratenaut.crate"] !== target.crateId ||
    state.labels["io.cratenaut.resource"] !== target.resource.id
  ) {
    throw new TypeError(`容器“${target.name}”不存在或不属于当前 Cratenaut 配置`);
  }
}
