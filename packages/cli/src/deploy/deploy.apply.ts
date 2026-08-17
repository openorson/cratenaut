import type { IConnectionClient } from "../connection/connection.types";
import type { IDockerClient } from "../docker/docker.types";
import { diagnostics } from "../diagnostic/diagnostic.catalog";
import {
  createContainerName,
  createNetworkAlias,
  createNetworkName,
  resolveCrateLayout,
} from "../layout/layout.resolve";
import type { IServerLayout } from "../layout/layout.types";
import { inspectActual } from "../plan/plan.create";
import type { IPlanAction, IServerPlan } from "../plan/plan.types";
import type { IStateStore } from "../state/state.types";
import type { ICrateState, IDeploymentState, IResourceState } from "../state/state.types";
import type { ICrateSpecification } from "../specification/specification.types";

/**
 * 应用目录所有权设置
 */
async function applyOwnership(
  connection: IConnectionClient,
  path: string,
  owner: string | undefined,
  group: string | undefined,
): Promise<void> {
  if (owner !== undefined || group !== undefined) {
    await connection.execute("chown", [`${owner ?? ""}:${group ?? ""}`, path]);
  }
}

/**
 * 转义临时环境文件中的 `Shell` 值
 */
function quoteShell(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

/**
 * 执行单个资源操作
 */
async function applyResource(
  action: IPlanAction,
  crate: ICrateSpecification | undefined,
  connection: IConnectionClient,
  docker: IDockerClient,
  layout: IServerLayout,
): Promise<void> {
  const resource = action.specification;

  if (action.operation === "noop") {
    return;
  }

  if (action.operation === "adopt") {
    return;
  }

  if (action.kind === "crate") {
    return;
  }

  if (action.operation === "remove") {
    if (action.kind === "container" && action.locator !== undefined) {
      const state = await docker.inspect(action.locator);

      if (
        state.exists &&
        (state.labels["io.cratenaut.managed"] !== "true" ||
          state.labels["io.cratenaut.project"] !== layout.project ||
          state.labels["io.cratenaut.server"] !== layout.server ||
          state.labels["io.cratenaut.crate"] !== action.crateId ||
          state.labels["io.cratenaut.resource"] !== action.resourceId)
      ) {
        throw new TypeError(`拒绝移除不属于当前配置的同名容器“${action.locator}”`);
      }

      if (state.exists) {
        await docker.remove(action.locator);
      }
    } else if (action.kind === "storage" && action.locator !== undefined) {
      const destination = `${layout.backups}/removed-${action.crateId}-${action.resourceId}-${Date.now()}`;
      await connection.ensureDirectory(layout.backups);
      await connection.execute("mv", [action.locator, destination], { allowFailure: true });
    } else if (action.kind === "file" && action.locator !== undefined) {
      const destination = `${layout.backups}/removed-${action.crateId}-${action.resourceId}-${Date.now()}`;
      await connection.ensureDirectory(layout.backups);
      await connection.execute("mv", [action.locator, destination], { allowFailure: true });
    } else if (action.kind === "directory" && action.locator !== undefined) {
      await connection.execute("rmdir", [action.locator], { allowFailure: true });
    } else if (action.kind === "task" && action.locator !== undefined) {
      await connection.removeFile(action.locator);
    }

    return;
  }

  if (resource === undefined) {
    throw new TypeError(`计划操作“${action.crateId}/${action.resourceId}”缺少资源规格`);
  }

  if (crate === undefined) {
    throw new TypeError(`计划操作“${action.crateId}/${action.resourceId}”缺少 Crate 规格`);
  }

  switch (resource.kind) {
    case "storage":
    case "directory":
      await connection.ensureDirectory(resource.path, resource.mode);
      await applyOwnership(connection, resource.path, resource.owner, resource.group);
      break;
    case "file":
      await connection.writeText(resource.path, resource.content, resource.mode ?? 0o640);
      await applyOwnership(connection, resource.path, resource.owner, resource.group);
      break;
    case "container": {
      const name = createContainerName(layout.project, layout.server, action.crateId, resource.id);
      const network = createNetworkName(layout.project, layout.server);
      const crateLayout = resolveCrateLayout(layout, action.crateId);
      const environmentPath = `${crateLayout.runtime}/${resource.id}.env`;
      const labels = Object.freeze({
        "io.cratenaut.managed": "true",
        "io.cratenaut.schema-version": "1",
        "io.cratenaut.project": layout.project,
        "io.cratenaut.server": layout.server,
        "io.cratenaut.crate": action.crateId,
        "io.cratenaut.crate.name": crate.name,
        "io.cratenaut.crate.version": crate.version,
        "io.cratenaut.resource": resource.id,
        "io.cratenaut.resource.kind": resource.kind,
        "io.cratenaut.spec-hash": action.desiredHash ?? "",
      });

      await docker.ensureNetwork(network, {
        "io.cratenaut.managed": "true",
        "io.cratenaut.schema-version": "1",
        "io.cratenaut.project": layout.project,
        "io.cratenaut.server": layout.server,
      });
      await docker.pull(resource.image);

      if ((await docker.inspect(name)).exists) {
        await docker.remove(name);
      }

      let environmentFile: string | undefined;

      if (Object.keys(resource.environment).length > 0) {
        const content = Object.entries(resource.environment)
          .map(([key, value]) => {
            if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || value.includes("\n") || value.includes("\r")) {
              throw new TypeError(`容器“${name}”的环境变量“${key}”无法安全写入 Docker 环境文件`);
            }

            return `${key}=${value}`;
          })
          .join("\n");
        await connection.writeText(environmentPath, `${content}\n`);
        environmentFile = environmentPath;
      }

      try {
        await docker.run({
          name,
          image: resource.image,
          network,
          networkAlias: createNetworkAlias(action.crateId, resource.id),
          restart: resource.restart,
          labels,
          environmentFile,
          mounts: resource.mounts,
          ports: resource.ports,
          command: resource.command,
          healthcheck: resource.healthcheck,
          stopTimeout: resource.stopTimeout,
          stopSignal: resource.stopSignal,
          sharedMemory: resource.sharedMemory,
        });

        if (resource.healthcheck !== undefined) {
          await docker.waitUntilReady(name, resource.startupTimeout);
        }
      } finally {
        if (environmentFile !== undefined) {
          await connection.removeFile(environmentFile);
        }
      }
      break;
    }
    case "task": {
      if (resource.targetContainer !== undefined) {
        if (Object.keys(resource.environment).length > 0) {
          throw new TypeError(`容器内任务“${action.crateId}/${resource.id}”暂不支持环境变量`);
        }

        await docker.execTask(resource.targetContainer, [resource.command, ...resource.arguments], {
          stdin: resource.stdin,
          workingDirectory: resource.workingDirectory,
        });
      } else if (connection.connection.kind === "local" || Object.keys(resource.environment).length === 0) {
        await connection.execute(resource.command, resource.arguments, {
          cwd: resource.workingDirectory,
          environment: resource.environment,
          stdin: resource.stdin,
        });
      } else {
        const crateLayout = resolveCrateLayout(layout, action.crateId);
        const environmentPath = `${crateLayout.runtime}/${resource.id}.task.env`;
        const content = Object.entries(resource.environment)
          .map(([key, value]) => {
            if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
              throw new TypeError(`任务“${action.crateId}/${resource.id}”的环境变量名称“${key}”无效`);
            }

            return `export ${key}=${quoteShell(value)}`;
          })
          .join("\n");
        await connection.writeText(environmentPath, `${content}\n`);

        try {
          await connection.execute(
            "sh",
            ["-c", '. "$1"; shift; exec "$@"', "sh", environmentPath, resource.command, ...resource.arguments],
            { cwd: resource.workingDirectory, stdin: resource.stdin },
          );
        } finally {
          await connection.removeFile(environmentPath);
        }
      }

      await connection.writeText(
        resource.markerPath,
        `${JSON.stringify({
          desiredHash: action.desiredHash,
          revision: resource.revision,
          completedAt: new Date().toISOString(),
        })}\n`,
      );
      break;
    }
  }
}

/**
 * 创建部署完成后的权威状态
 */
async function buildState(
  plan: IServerPlan,
  connection: IConnectionClient,
  docker: IDockerClient,
  layout: IServerLayout,
  key: Uint8Array,
  deploymentId: string,
): Promise<IDeploymentState> {
  const crates: ICrateState[] = [];
  const selectedIds = new Set(plan.specification.crates.map((crate) => crate.id));
  const removedIds = new Set(
    plan.actions
      .filter((action) => !selectedIds.has(action.crateId) && action.operation === "remove")
      .map((action) => action.crateId),
  );
  const previousCrates = new Map((plan.previousState?.crates ?? []).map((crate) => [crate.id, crate]));
  const actionsByCrate = new Map<string, IPlanAction[]>();

  for (const action of plan.actions) {
    const actions = actionsByCrate.get(action.crateId) ?? [];
    actions.push(action);
    actionsByCrate.set(action.crateId, actions);
  }

  for (const previous of plan.previousState?.crates ?? []) {
    if (!selectedIds.has(previous.id) && !removedIds.has(previous.id)) {
      crates.push(previous);
    }
  }

  for (const crate of plan.specification.crates) {
    const resources: IResourceState[] = [];
    const previousCrate = previousCrates.get(crate.id);
    const previousResources = new Map((previousCrate?.resources ?? []).map((resource) => [resource.id, resource]));
    const crateActions = actionsByCrate.get(crate.id) ?? [];
    const actionsByResource = new Map(crateActions.map((action) => [action.resourceId, action]));

    for (const resource of crate.resources) {
      const action = actionsByResource.get(resource.id);

      if (action === undefined || action.desiredHash === undefined) {
        throw new TypeError(`无法为资源“${crate.id}/${resource.id}”生成部署状态`);
      }

      const previous = previousResources.get(resource.id);
      const actualHash =
        resource.kind === "task"
          ? action.operation === "noop"
            ? (previous?.actualHash ?? action.desiredHash)
            : action.desiredHash
          : await inspectActual(connection, docker, layout, crate.id, resource, key, previous);
      const imageDigest =
        resource.kind === "container"
          ? ((await docker.resolveImageDigest(resource.image)) ??
            (await docker.inspect(createContainerName(layout.project, layout.server, crate.id, resource.id))).imageId)
          : undefined;

      resources.push(
        Object.freeze({
          id: resource.id,
          kind: resource.kind,
          desiredHash: action.desiredHash,
          actualHash,
          appliedAt: new Date().toISOString(),
          locator:
            resource.kind === "container"
              ? createContainerName(layout.project, layout.server, crate.id, resource.id)
              : resource.kind === "task"
                ? resource.markerPath
                : resource.path,
          imageDigest,
          backup: resource.kind === "storage" ? resource.backup : undefined,
        }),
      );
    }

    for (const action of crateActions) {
      if (action.specification !== undefined || action.operation === "remove") {
        continue;
      }

      const previous = previousResources.get(action.resourceId);

      if (previous !== undefined) {
        resources.push(previous);
      }
    }

    crates.push(
      Object.freeze({
        id: crate.id,
        name: crate.name,
        version: crate.version,
        optionsSnapshot: crate.optionsSnapshot,
        resources: Object.freeze(resources),
      }),
    );
  }

  return Object.freeze({
    schemaVersion: 1,
    deploymentId,
    project: plan.project,
    server: plan.server,
    updatedAt: new Date().toISOString(),
    crates: Object.freeze(crates),
  });
}

/**
 * 顺序应用计划并原子保存部署状态
 */
export async function applyPlan(
  plan: IServerPlan,
  connection: IConnectionClient,
  docker: IDockerClient,
  stateStore: IStateStore,
  layout: IServerLayout,
  key: Uint8Array,
  forceUnlock = false,
): Promise<IDeploymentState> {
  const deploymentId = crypto.randomUUID();
  const journalPath = `${layout.journals}/${deploymentId}.json`;
  const journal = {
    deploymentId,
    project: plan.project,
    server: plan.server,
    startedAt: new Date().toISOString(),
    status: "running",
    actions: [] as unknown[],
  };
  const crates = new Map(plan.specification.crates.map((crate) => [crate.id, crate]));

  await stateStore.acquireLock(forceUnlock);

  try {
    const currentState = await stateStore.load();

    if (currentState?.deploymentId !== plan.previousState?.deploymentId) {
      throw diagnostics.CRN_CLI_3004({ server: plan.server });
    }

    for (const directory of [
      layout.state,
      layout.stateHistory,
      layout.journals,
      layout.locks,
      layout.runtime,
      layout.deployment,
      layout.backups,
      layout.crates,
    ]) {
      await connection.ensureDirectory(directory);
    }

    for (const crate of plan.specification.crates) {
      const crateLayout = resolveCrateLayout(layout, crate.id);

      for (const directory of [
        crateLayout.base,
        crateLayout.data,
        crateLayout.config,
        crateLayout.cache,
        crateLayout.runtime,
      ]) {
        await connection.ensureDirectory(directory);
      }
    }

    await stateStore.persistFingerprintKey();
    await connection.ensureDirectory(layout.journals);
    await connection.writeText(journalPath, `${JSON.stringify(journal, null, 2)}\n`);

    for (const action of plan.actions) {
      if (action.operation === "noop") {
        continue;
      }

      const crate = crates.get(action.crateId);

      if (crate === undefined && action.operation !== "remove") {
        throw new TypeError(`计划中的 Crate“${action.crateId}”不存在`);
      }

      await applyResource(action, crate, connection, docker, layout);
      journal.actions.push({
        crate: action.crateId,
        resource: action.resourceId,
        operation: action.operation,
        completedAt: new Date().toISOString(),
      });
      await connection.writeText(journalPath, `${JSON.stringify(journal, null, 2)}\n`);
    }

    const state = await buildState(plan, connection, docker, layout, key, deploymentId);
    await connection.writeText(
      `${layout.deployment}/current.json`,
      `${JSON.stringify(
        {
          schemaVersion: state.schemaVersion,
          deploymentId: state.deploymentId,
          project: state.project,
          server: state.server,
          updatedAt: state.updatedAt,
          crates: state.crates.map((crate) => ({
            id: crate.id,
            name: crate.name,
            version: crate.version,
            resources: crate.resources.map((resource) => ({
              id: resource.id,
              kind: resource.kind,
              locator: resource.locator,
              imageDigest: resource.imageDigest,
              backup: resource.backup,
            })),
          })),
        },
        null,
        2,
      )}\n`,
    );
    await stateStore.save(state);
    journal.status = "succeeded";
    Object.assign(journal, { completedAt: new Date().toISOString() });
    await connection.writeText(journalPath, `${JSON.stringify(journal, null, 2)}\n`);
    return state;
  } catch (error) {
    journal.status = "failed";
    Object.assign(journal, {
      failedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    });
    await connection.writeText(journalPath, `${JSON.stringify(journal, null, 2)}\n`).catch(() => undefined);
    throw error;
  } finally {
    await stateStore.releaseLock();
  }
}
