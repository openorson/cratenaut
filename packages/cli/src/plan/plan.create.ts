import { semver } from "bun";

import type { IConnectionClient } from "../connection/connection.types";
import type { IDockerClient } from "../docker/docker.types";
import { createContainerName } from "../layout/layout.resolve";
import type { IServerLayout } from "../layout/layout.types";
import type { ICrateState, IDeploymentState, IResourceState } from "../state/state.types";
import { fingerprint, stableSerialize } from "../specification/specification.hash";
import type {
  ICrateSpecification,
  IServerSpecification,
  TResourceSpecification,
} from "../specification/specification.types";
import type { IPlanAction, IServerPlan, TPlanAuthorization } from "./plan.types";

const riskOrder = Object.freeze({ safe: 0, disruptive: 1, unknown: 2, destructive: 3, immutable: 4 });

/**
 * 返回风险等级较高的一项
 */
function maximumRisk(left: keyof typeof riskOrder, right: keyof typeof riskOrder): keyof typeof riskOrder {
  return riskOrder[left] >= riskOrder[right] ? left : right;
}

/**
 * 收集两个配置快照之间变化的叶子路径
 */
function collectChangedPaths(previous: unknown, next: unknown, path = ""): readonly string[] {
  if (stableSerialize(previous) === stableSerialize(next)) {
    return [];
  }

  if (
    typeof previous !== "object" ||
    previous === null ||
    typeof next !== "object" ||
    next === null ||
    Array.isArray(previous) !== Array.isArray(next)
  ) {
    return [path];
  }

  const left = previous as Record<string, unknown>;
  const right = next as Record<string, unknown>;
  const paths: string[] = [];

  for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
    paths.push(...collectChangedPaths(left[key], right[key], path === "" ? key : `${path}.${key}`));
  }

  return paths;
}

/**
 * 判断配置变更路径是否由字段策略覆盖
 */
function matchesPolicyPath(policyPath: string, changedPath: string): boolean {
  if (policyPath === "") {
    return true;
  }

  const policySegments = policyPath.split(".");
  const changedSegments = changedPath.split(".");

  return (
    policySegments.length <= changedSegments.length &&
    policySegments.every((segment, index) => segment === "*" || segment === changedSegments[index])
  );
}

/**
 * 评估配置字段变更风险
 */
function assessOptions(crate: ICrateSpecification, previous: ICrateState | undefined) {
  if (previous === undefined) {
    return Object.freeze({ risk: "safe" as const, reasons: Object.freeze([] as string[]) });
  }

  const paths = collectChangedPaths(previous.optionsSnapshot, crate.optionsSnapshot);
  let risk: keyof typeof riskOrder = "safe";
  const reasons: string[] = [];

  for (const path of paths) {
    const policy = crate.optionChangePolicies.find((candidate) => matchesPolicyPath(candidate.path, path));
    const fieldRisk = policy?.risk ?? "unknown";
    risk = maximumRisk(risk, fieldRisk);
    reasons.push(policy?.reason ?? `配置字段“${path}”没有声明变更风险`);
  }

  for (const assessment of crate.assessChange(previous.optionsSnapshot)) {
    risk = maximumRisk(risk, assessment.risk);
    reasons.push(assessment.reason);
  }

  return Object.freeze({ risk, reasons: Object.freeze(reasons) });
}

/**
 * 检查 `Crate` 版本变化
 */
function assessVersion(crate: ICrateSpecification, previous: ICrateState | undefined) {
  if (previous === undefined) {
    return Object.freeze({
      risk: "safe" as const,
      authorizations: Object.freeze([] as TPlanAuthorization[]),
      reasons: Object.freeze([] as string[]),
    });
  }

  if (previous.name !== crate.name) {
    return Object.freeze({
      risk: "immutable" as const,
      authorizations: Object.freeze(["immutable"] as TPlanAuthorization[]),
      reasons: Object.freeze([`Crate 实例类型不能从 ${previous.name} 修改为 ${crate.name}`]),
    });
  }

  if (previous.version === crate.version) {
    return Object.freeze({
      risk: "safe" as const,
      authorizations: Object.freeze([] as TPlanAuthorization[]),
      reasons: Object.freeze([] as string[]),
    });
  }

  const order = semver.order(previous.version, crate.version);

  if (order > 0) {
    return Object.freeze({
      risk: "unknown" as const,
      authorizations: Object.freeze(["downgrade"] as TPlanAuthorization[]),
      reasons: Object.freeze([`Crate 版本将从 ${previous.version} 降级到 ${crate.version}`]),
    });
  }

  const previousMajor = Number(previous.version.match(/^\d+/)?.[0] ?? 0);
  const nextMajor = Number(crate.version.match(/^\d+/)?.[0] ?? 0);
  const explicitlyCompatible = (crate.compatibility?.upgradesFrom ?? []).some((range) =>
    semver.satisfies(previous.version, range),
  );

  if (previousMajor !== nextMajor && !explicitlyCompatible) {
    return Object.freeze({
      risk: "unknown" as const,
      authorizations: Object.freeze(["major"] as TPlanAuthorization[]),
      reasons: Object.freeze([`Crate 主版本将从 ${previous.version} 升级到 ${crate.version}`]),
    });
  }

  return Object.freeze({
    risk: "disruptive" as const,
    authorizations: Object.freeze([] as TPlanAuthorization[]),
    reasons: Object.freeze([`Crate 版本将从 ${previous.version} 升级到 ${crate.version}`]),
  });
}

/**
 * 检查资源的实际状态指纹
 */
export async function inspectActual(
  connection: IConnectionClient,
  docker: IDockerClient,
  layout: IServerLayout,
  crateId: string,
  resource: TResourceSpecification,
  key: Uint8Array,
  previous: IResourceState | undefined,
): Promise<string> {
  switch (resource.kind) {
    case "container": {
      const state = await docker.inspect(createContainerName(layout.project, layout.server, crateId, resource.id));

      if (!state.exists) {
        return "missing";
      }

      return state.desiredHash === undefined || state.configuration === undefined
        ? "unmanaged"
        : fingerprint(state.configuration, key);
    }
    case "file": {
      const result = await connection.execute(
        "sh",
        [
          "-c",
          'test -f "$1" || exit 44; if stat -c "%a:%U:%G" "$1" >/dev/null 2>&1; then stat -c "%a:%U:%G" "$1"; else stat -f "%Lp:%Su:%Sg" "$1"; fi; base64 < "$1"',
          "sh",
          resource.path,
        ],
        { allowFailure: true },
      );
      return result.code === 0 ? fingerprint(result.stdout, key) : "missing";
    }
    case "directory":
    case "storage": {
      const result = await connection.execute(
        "sh",
        [
          "-c",
          'test -d "$1" || exit 44; if stat -c "%a:%U:%G" "$1" >/dev/null 2>&1; then stat -c "%a:%U:%G" "$1"; else stat -f "%Lp:%Su:%Sg" "$1"; fi',
          "sh",
          resource.path,
        ],
        { allowFailure: true },
      );
      return result.code === 0 ? fingerprint(result.stdout.trim(), key) : "missing";
    }
    case "task": {
      const content = await connection.readText(resource.markerPath);

      if (content === undefined) {
        return "missing";
      }

      try {
        const marker = JSON.parse(content) as Readonly<Record<string, unknown>>;
        return typeof marker.desiredHash === "string" ? marker.desiredHash : "invalid";
      } catch {
        return "invalid";
      }
    }
  }
}

/**
 * 检查已经从配置删除的资源是否发生漂移
 */
async function inspectRemovedActual(
  connection: IConnectionClient,
  docker: IDockerClient,
  layout: IServerLayout,
  crateId: string,
  resource: IResourceState,
  key: Uint8Array,
): Promise<string> {
  if (resource.locator === undefined) {
    return resource.actualHash;
  }

  switch (resource.kind) {
    case "container": {
      const state = await docker.inspect(resource.locator);

      if (!state.exists) {
        return "missing";
      }

      return state.desiredHash === undefined || state.configuration === undefined
        ? "unmanaged"
        : fingerprint(state.configuration, key);
    }
    case "file": {
      const result = await connection.execute(
        "sh",
        [
          "-c",
          'test -f "$1" || exit 44; if stat -c "%a:%U:%G" "$1" >/dev/null 2>&1; then stat -c "%a:%U:%G" "$1"; else stat -f "%Lp:%Su:%Sg" "$1"; fi; base64 < "$1"',
          "sh",
          resource.locator,
        ],
        { allowFailure: true },
      );
      return result.code === 0 ? fingerprint(result.stdout, key) : "missing";
    }
    case "directory":
    case "storage": {
      const result = await connection.execute(
        "sh",
        [
          "-c",
          'test -d "$1" || exit 44; if stat -c "%a:%U:%G" "$1" >/dev/null 2>&1; then stat -c "%a:%U:%G" "$1"; else stat -f "%Lp:%Su:%Sg" "$1"; fi',
          "sh",
          resource.locator,
        ],
        { allowFailure: true },
      );
      return result.code === 0 ? fingerprint(result.stdout.trim(), key) : "missing";
    }
    case "task": {
      const content = await connection.readText(resource.locator);

      if (content === undefined) {
        return "missing";
      }

      try {
        const marker = JSON.parse(content) as Readonly<Record<string, unknown>>;
        return typeof marker.desiredHash === "string" ? marker.desiredHash : "invalid";
      } catch {
        return "invalid";
      }
    }
    default:
      return resource.actualHash;
  }
}

/**
 * 根据资源类型和操作选择固有风险
 */
function intrinsicRisk(resource: TResourceSpecification, operation: IPlanAction["operation"]): keyof typeof riskOrder {
  if (operation === "noop" || operation === "adopt") {
    return "safe";
  }

  if (resource.kind === "task") {
    return resource.impact;
  }

  if (operation === "create") {
    return "safe";
  }

  return resource.kind === "container" || resource.kind === "storage" ? "disruptive" : "safe";
}

/**
 * 创建单服务器三方部署计划
 */
export async function createPlan(
  specification: IServerSpecification,
  previousState: IDeploymentState | undefined,
  connection: IConnectionClient,
  docker: IDockerClient,
  layout: IServerLayout,
  key: Uint8Array,
  prune: boolean,
  pruneRemovedCrates = false,
): Promise<IServerPlan> {
  const actions: IPlanAction[] = [];
  const previousCrates = new Map((previousState?.crates ?? []).map((crate) => [crate.id, crate]));
  const currentCrateIds = new Set(specification.crates.map((crate) => crate.id));

  for (const crate of specification.crates) {
    const previousCrate = previousCrates.get(crate.id);
    const previousResources = new Map((previousCrate?.resources ?? []).map((resource) => [resource.id, resource]));
    const currentResourceIds = new Set(crate.resources.map((resource) => resource.id));
    const optionAssessment = assessOptions(crate, previousCrate);
    const versionAssessment = assessVersion(crate, previousCrate);
    const crateRisk = maximumRisk(optionAssessment.risk, versionAssessment.risk);
    const crateReasons = [...optionAssessment.reasons, ...versionAssessment.reasons];

    if (crateReasons.length > 0) {
      const authorizations: TPlanAuthorization[] = [...versionAssessment.authorizations];

      if (crateRisk === "destructive") {
        authorizations.push("destructive");
      } else if (
        crateRisk === "unknown" &&
        !authorizations.some((authorization) => ["major", "downgrade"].includes(authorization))
      ) {
        authorizations.push("unknown");
      } else if (crateRisk === "immutable" && !authorizations.includes("immutable")) {
        authorizations.push("immutable");
      }

      actions.push(
        Object.freeze({
          crateId: crate.id,
          resourceId: "$crate",
          kind: "crate",
          operation: "update",
          risk: crateRisk,
          reason: crateReasons.join("；"),
          desiredHash: fingerprint({ version: crate.version, options: crate.optionsSnapshot }, key),
          previousHash:
            previousCrate === undefined
              ? undefined
              : fingerprint({ version: previousCrate.version, options: previousCrate.optionsSnapshot }, key),
          authorizations: Object.freeze(authorizations),
        }),
      );
    }

    for (const resource of crate.resources) {
      const previous = previousResources.get(resource.id);
      const desiredHash = fingerprint(
        {
          crate: { name: crate.name, version: crate.version },
          resource,
        },
        key,
      );
      const actualHash = await inspectActual(connection, docker, layout, crate.id, resource, key, previous);
      const desiredChanged = previous === undefined || previous.desiredHash !== desiredHash;
      const matchingTaskMarker = previous === undefined && resource.kind === "task" && actualHash === desiredHash;
      const drifted =
        previous === undefined ? actualHash !== "missing" && !matchingTaskMarker : previous.actualHash !== actualHash;
      const operation: IPlanAction["operation"] = matchingTaskMarker
        ? resource.kind === "task" && resource.run === "always"
          ? "run"
          : "adopt"
        : drifted
          ? "drift"
          : previous === undefined
            ? "create"
            : desiredChanged
              ? resource.kind === "container"
                ? "recreate"
                : resource.kind === "task"
                  ? "run"
                  : "update"
              : resource.kind === "task" && resource.run === "always"
                ? "run"
                : "noop";
      let risk = maximumRisk(intrinsicRisk(resource, operation), crateRisk);
      const authorizations: TPlanAuthorization[] = [...versionAssessment.authorizations];
      const reasons = [...crateReasons];

      if (drifted) {
        risk = maximumRisk(risk, "unknown");
        authorizations.push("drift");
        reasons.push("实际状态与上次部署记录不同");

        if (actualHash === "unmanaged") {
          risk = maximumRisk(risk, "destructive");
          authorizations.push("destructive");
          reasons.push("同名容器不带 Cratenaut 托管标签");
        }
      } else if (operation === "adopt") {
        reasons.push("任务已成功执行，但上次部署状态尚未提交，本次只接管任务标记");
      } else if (desiredChanged) {
        reasons.push(previous === undefined ? "资源尚未部署" : "期望规格发生变化");
      } else if (operation === "run") {
        reasons.push("任务执行策略为 always");
      } else {
        reasons.push("期望状态、上次状态和实际状态一致");
      }

      if (risk === "destructive") {
        authorizations.push("destructive");
      }

      if (
        risk === "unknown" &&
        !authorizations.some((authorization) => ["major", "downgrade", "drift"].includes(authorization))
      ) {
        authorizations.push("unknown");
      }

      if (risk === "immutable") {
        authorizations.push("immutable");
      }

      actions.push(
        Object.freeze({
          crateId: crate.id,
          resourceId: resource.id,
          kind: resource.kind,
          operation,
          risk,
          reason: reasons.join("；"),
          desiredHash,
          actualHash,
          previousHash: previous?.desiredHash,
          locator:
            resource.kind === "container"
              ? createContainerName(layout.project, layout.server, crate.id, resource.id)
              : resource.kind === "task"
                ? resource.markerPath
                : resource.path,
          authorizations: Object.freeze([...new Set(authorizations)]),
          specification: resource,
        }),
      );
    }

    for (const previous of previousCrate?.resources ?? []) {
      if (currentResourceIds.has(previous.id)) {
        continue;
      }

      const actualHash = await inspectRemovedActual(connection, docker, layout, crate.id, previous, key);
      const drifted = actualHash !== "missing" && actualHash !== previous.actualHash;
      const risk =
        actualHash === "missing"
          ? "safe"
          : actualHash === "unmanaged"
            ? "immutable"
            : previous.kind === "container"
              ? "disruptive"
              : previous.kind === "task"
                ? "safe"
                : "destructive";
      const authorizations: TPlanAuthorization[] = prune
        ? [
            "prune",
            ...(risk === "destructive" ? ["destructive" as const] : []),
            ...(risk === "immutable" ? ["immutable" as const] : []),
            ...(drifted ? ["drift" as const] : []),
          ]
        : [];
      actions.push(
        Object.freeze({
          crateId: crate.id,
          resourceId: previous.id,
          kind: previous.kind,
          operation: prune ? "remove" : "noop",
          risk,
          reason: prune
            ? drifted
              ? "资源已从配置删除并启用了 prune，但实际状态存在漂移"
              : actualHash === "missing"
                ? "资源已从配置删除，且实际资源已经不存在"
                : "资源已从配置删除并启用了 prune"
            : "资源已从配置删除，但未启用 prune",
          actualHash,
          previousHash: previous.desiredHash,
          locator: previous.locator,
          authorizations: Object.freeze(authorizations),
        }),
      );
    }
  }

  if (prune && pruneRemovedCrates) {
    for (const previousCrate of previousState?.crates ?? []) {
      if (currentCrateIds.has(previousCrate.id)) {
        continue;
      }

      actions.push(
        Object.freeze({
          crateId: previousCrate.id,
          resourceId: "$crate",
          kind: "crate",
          operation: "remove",
          risk: "safe",
          reason: "Crate 已从配置删除并启用了 prune",
          authorizations: Object.freeze(["prune"] as TPlanAuthorization[]),
        }),
      );

      for (const previous of previousCrate.resources) {
        const actualHash = await inspectRemovedActual(connection, docker, layout, previousCrate.id, previous, key);
        const drifted = actualHash !== "missing" && actualHash !== previous.actualHash;
        const risk =
          actualHash === "missing"
            ? "safe"
            : actualHash === "unmanaged"
              ? "immutable"
              : previous.kind === "container"
                ? "disruptive"
                : previous.kind === "task"
                  ? "safe"
                  : "destructive";
        const authorizations: TPlanAuthorization[] = [
          "prune",
          ...(risk === "destructive" ? (["destructive"] as const) : []),
          ...(risk === "immutable" ? (["immutable"] as const) : []),
          ...(drifted ? (["drift"] as const) : []),
        ];

        actions.push(
          Object.freeze({
            crateId: previousCrate.id,
            resourceId: previous.id,
            kind: previous.kind,
            operation: "remove",
            risk,
            reason: drifted
              ? "Crate 已从配置删除并启用了 prune，但实际状态存在漂移"
              : actualHash === "missing"
                ? "Crate 已从配置删除，且实际资源已经不存在"
                : "Crate 已从配置删除并启用了 prune",
            actualHash,
            previousHash: previous.desiredHash,
            locator: previous.locator,
            authorizations: Object.freeze(authorizations),
          }),
        );
      }
    }
  }

  return Object.freeze({
    project: specification.project,
    server: specification.server,
    createdAt: new Date().toISOString(),
    previousState,
    specification,
    actions: Object.freeze(actions),
  });
}
