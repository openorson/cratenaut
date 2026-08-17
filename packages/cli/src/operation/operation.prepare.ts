import { createConnection } from "../connection/connection.client";
import { createDockerClient } from "../docker/docker.client";
import { createNetworkName, resolveServerLayout } from "../layout/layout.resolve";
import { createPlan } from "../plan/plan.create";
import type { IRuntimeContext } from "../runtime/runtime.types";
import { StateStore } from "../state/state.store";
import { buildServerSpecification } from "../specification/specification.build";
import type { IPreparedServerOperation } from "./operation.types";

/**
 * 读取实际状态并为每台服务器创建三方计划
 */
export async function prepareServerOperations(runtime: IRuntimeContext): Promise<readonly IPreparedServerOperation[]> {
  const operations: IPreparedServerOperation[] = [];

  for (const server of runtime.materialized.servers) {
    const progress = runtime.output.progress(`正在检查服务器 ${server.id}`);

    try {
      const connection = createConnection(server.id, server.connection);
      const docker = createDockerClient(connection);
      const layout = resolveServerLayout(runtime.materialized.project, server, runtime.loaded.directory);
      const stateStore = new StateStore(connection, layout, runtime.loaded.informationDirectory);
      await docker.check();
      const previousState = await stateStore.load();
      const fingerprintKey = await stateStore.getFingerprintKey();
      const specification = await buildServerSpecification(
        runtime.materialized.project,
        server,
        layout,
        runtime.secretResolver,
        fingerprintKey,
      );
      const hasContainers = specification.crates.some((crate) =>
        crate.resources.some((resource) => resource.kind === "container"),
      );
      const configuredServer = runtime.loaded.config.servers.find((candidate) => candidate.id === server.id);
      const selectedCrateIds = new Set(specification.crates.map((crate) => crate.id));
      const selectedAllConfiguredCrates =
        configuredServer !== undefined &&
        configuredServer.crates.length === selectedCrateIds.size &&
        configuredServer.crates.every((crate) => selectedCrateIds.has(crate.id));

      if (hasContainers) {
        await docker.checkNetwork(createNetworkName(specification.project, specification.server), {
          "io.cratenaut.managed": "true",
          "io.cratenaut.project": specification.project,
          "io.cratenaut.server": specification.server,
        });
      }

      for (const crate of specification.crates) {
        for (const resource of crate.resources) {
          if (resource.kind !== "container") {
            continue;
          }

          const firstSegment = resource.image.split("/")[0] ?? "";
          const fullyQualified =
            resource.image.includes("/") &&
            (firstSegment.includes(".") || firstSegment.includes(":") || firstSegment === "localhost");
          const immutable = resource.image.includes("@sha256:");
          const tagged = /:[^/]+$/.test(resource.image);

          if (!fullyQualified) {
            runtime.output.warn(
              `容器 ${crate.id}/${resource.id} 的镜像“${resource.image}”不是完全限定名称，建议显式写出仓库域名`,
            );
          }

          if (!immutable && (!tagged || resource.image.endsWith(":latest"))) {
            runtime.output.warn(
              `容器 ${crate.id}/${resource.id} 的镜像“${resource.image}”没有固定版本，幂等部署建议使用明确标签或摘要`,
            );
          }
        }
      }
      const plan = await createPlan(
        specification,
        previousState,
        connection,
        docker,
        layout,
        fingerprintKey,
        runtime.args.prune === true,
        runtime.args.prune === true && selectedAllConfiguredCrates,
      );
      operations.push(
        Object.freeze({
          server,
          connection,
          docker,
          layout,
          stateStore,
          fingerprintKey,
          specification,
          plan,
        }),
      );
      progress.stop(`服务器 ${server.id} 检查完成`);
    } catch (error) {
      progress.error(`服务器 ${server.id} 检查失败`);
      throw error;
    }
  }

  return Object.freeze(operations);
}
