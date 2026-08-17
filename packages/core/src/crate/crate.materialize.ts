import type { TSchema } from "typebox";

import type { IMaterializedCrate } from "../internal/internal.types";
import { BaseResource } from "../resource/base/base.resource";
import type { TResource } from "../resource/resource.types";
import { resolveSecretValues } from "../secret/secret.resolve";
import type { ISecretResolver } from "../secret/secret.types";
import { getCrateRuntimeState } from "./crate.internal";
import type { ICrateInstance } from "./crate.types";

/**
 * 检查并冻结资源清单
 */
function normalizeResources(crateId: string, resources: readonly TResource[]): readonly TResource[] {
  if (!Array.isArray(resources)) {
    throw new TypeError(`Crate 实例“${crateId}”的资源声明函数必须返回数组`);
  }

  const resourceIds = new Set<string>();
  const fileIds = new Set<string>();
  const containerIds = new Set<string>();
  const storageIds = new Set<string>();

  for (const resource of resources) {
    if (!(resource instanceof BaseResource)) {
      throw new TypeError(`Crate 实例“${crateId}”的资源必须由资源声明上下文创建`);
    }

    const typedResource = resource as TResource;

    if (resourceIds.has(typedResource.id)) {
      throw new TypeError(`Crate 实例“${crateId}”中存在重复的资源标识“${typedResource.id}”`);
    }

    if (typedResource.kind === "container") {
      for (const mount of typedResource.mounts ?? []) {
        if (typeof mount.source === "string") {
          continue;
        }

        if (mount.source.kind === "storage" && !storageIds.has(mount.source.id)) {
          throw new TypeError(
            `Crate 实例“${crateId}”中的容器“${typedResource.id}”引用了尚未声明的存储“${mount.source.id}”`,
          );
        }

        if (mount.source.kind === "file" && !fileIds.has(mount.source.id)) {
          throw new TypeError(
            `Crate 实例“${crateId}”中的容器“${typedResource.id}”引用了尚未声明的文件“${mount.source.id}”`,
          );
        }
      }
    }

    if (
      typedResource.kind === "task" &&
      typedResource.target !== undefined &&
      !containerIds.has(typedResource.target.id)
    ) {
      throw new TypeError(
        `Crate 实例“${crateId}”中的任务“${typedResource.id}”引用了尚未声明的容器“${typedResource.target.id}”`,
      );
    }

    resourceIds.add(typedResource.id);

    if (typedResource.kind === "storage") {
      storageIds.add(typedResource.id);
    }

    if (typedResource.kind === "file") {
      fileIds.add(typedResource.id);
    }

    if (typedResource.kind === "container") {
      containerIds.add(typedResource.id);
    }
  }

  return Object.freeze([...resources]);
}

/**
 * 解析秘密、解码配置并生成一个可执行的 `Crate`
 *
 * @internal
 */
export async function materializeCrate<
  Id extends string,
  Type extends { name: string; version: string; optionsSchema: TSchema | undefined },
>(instance: ICrateInstance<Id, Type>, resolver: ISecretResolver): Promise<IMaterializedCrate<Id, Type>> {
  const state = getCrateRuntimeState(instance);
  const resolvedOptions = await resolveSecretValues(instance.options, resolver);
  const options = state.decodeOptions(resolvedOptions);
  const resources = state.createResources(instance.id, options);

  return Object.freeze({
    id: instance.id,
    description: instance.description,
    name: instance.name,
    version: instance.version,
    options,
    optionChangePolicies: state.optionChangePolicies,
    secretOptionPaths: state.secretOptionPaths,
    compatibility: state.compatibility,
    assessChange: (previousOptions: unknown) => state.assessChange(previousOptions, options),
    resources: normalizeResources(instance.id, resources),
  }) as IMaterializedCrate<Id, Type>;
}
