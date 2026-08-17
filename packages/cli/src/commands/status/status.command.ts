import { defineCommand } from "citty";

import { createContainerName } from "../../layout/layout.resolve";
import { prepareServerOperations } from "../../operation/operation.prepare";
import { loadRuntime } from "../../runtime/runtime.load";
import type { IRuntimeArguments } from "../../runtime/runtime.types";
import { commonArguments } from "../commands.arguments";

/**
 * 显示部署状态与容器运行状态
 */
export const statusCommand = defineCommand({
  meta: { name: "status", description: "显示所选资源状态" },
  args: commonArguments,
  run: async ({ args }) => {
    const runtime = await loadRuntime(args as unknown as IRuntimeArguments);
    const operations = await prepareServerOperations(runtime);

    for (const operation of operations) {
      const containers = [];

      for (const crate of operation.specification.crates) {
        for (const resource of crate.resources) {
          if (resource.kind !== "container") {
            continue;
          }

          const name = createContainerName(operation.plan.project, operation.plan.server, crate.id, resource.id);
          const state = await operation.docker.inspect(name);
          const recorded = operation.plan.previousState?.crates
            .find((candidate) => candidate.id === crate.id)
            ?.resources.find((candidate) => candidate.id === resource.id);
          containers.push({
            crate: crate.id,
            resource: resource.id,
            name,
            exists: state.exists,
            managed:
              state.labels["io.cratenaut.managed"] === "true" &&
              state.labels["io.cratenaut.project"] === operation.plan.project &&
              state.labels["io.cratenaut.server"] === operation.plan.server,
            running: state.running,
            status: state.status,
            image: state.image,
            imageId: state.imageId,
            imageDigest: recorded?.imageDigest,
          });
        }
      }

      runtime.output.data({
        project: operation.plan.project,
        server: operation.plan.server,
        lastDeployment: operation.plan.previousState?.updatedAt,
        drift: operation.plan.actions.filter((action) => action.operation === "drift").length,
        containers,
      });
    }
  },
});
