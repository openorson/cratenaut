import { secret } from "@cratenaut/core";
import {
  resolveSecret,
  type IMaterializedServer,
  type ISecretResolver,
  type TResourceText,
} from "@cratenaut/core/internal";
import { posix } from "node:path";

import { createContainerName, resolveCrateLayout } from "../layout/layout.resolve";
import type { IServerLayout } from "../layout/layout.types";
import { createOptionsSnapshot, fingerprint } from "./specification.hash";
import type {
  IContainerSpecification,
  ICrateSpecification,
  IServerSpecification,
  ITaskSpecification,
  TResourceSpecification,
} from "./specification.types";

/**
 * 解析资源中的文本秘密
 */
async function resolveText(value: TResourceText, resolver: ISecretResolver): Promise<string> {
  return secret.is(value) ? resolveSecret(value, resolver) : value;
}

/**
 * 解析环境变量集合
 */
async function resolveEnvironment(
  environment: Readonly<Record<string, TResourceText>> | undefined,
  resolver: ISecretResolver,
): Promise<Readonly<Record<string, string>>> {
  const entries = [];

  for (const [name, value] of Object.entries(environment ?? {})) {
    entries.push([name, await resolveText(value, resolver)] as const);
  }

  return Object.freeze(Object.fromEntries(entries));
}

/**
 * 构建可执行服务器规格
 */
export async function buildServerSpecification(
  project: string,
  server: IMaterializedServer,
  layout: IServerLayout,
  resolver: ISecretResolver,
  fingerprintKey: Uint8Array,
): Promise<IServerSpecification> {
  const crates: ICrateSpecification[] = [];
  const managedPaths = new Map<string, string>();
  const publishedPorts = new Map<string, string>();

  for (const crate of server.crates) {
    const crateLayout = resolveCrateLayout(layout, crate.id);
    const resources: TResourceSpecification[] = [];
    const fileReferences = new Map<string, Readonly<{ path: string; revision: string }>>();

    for (const resource of crate.resources) {
      switch (resource.kind) {
        case "storage": {
          const path = posix.join(crateLayout.data, resource.id);
          const owner = managedPaths.get(path);

          if (owner !== undefined) {
            throw new TypeError(`资源“${crate.id}/${resource.id}”与资源“${owner}”管理相同路径“${path}”`);
          }

          managedPaths.set(path, `${crate.id}/${resource.id}`);
          resources.push(
            Object.freeze({
              kind: "storage",
              id: resource.id,
              path,
              backup: resource.backup,
              mode: resource.mode,
              owner: resource.owner,
              group: resource.group,
            }),
          );
          break;
        }
        case "directory": {
          const owner = managedPaths.get(resource.path);

          if (owner !== undefined) {
            throw new TypeError(`资源“${crate.id}/${resource.id}”与资源“${owner}”管理相同路径“${resource.path}”`);
          }

          managedPaths.set(resource.path, `${crate.id}/${resource.id}`);
          resources.push(
            Object.freeze({
              kind: "directory",
              id: resource.id,
              path: resource.path,
              mode: resource.mode,
              owner: resource.owner,
              group: resource.group,
            }),
          );
          break;
        }
        case "file": {
          const path = resource.path ?? posix.join(crateLayout.config, resource.id);
          const owner = managedPaths.get(path);

          if (owner !== undefined) {
            throw new TypeError(`资源“${crate.id}/${resource.id}”与资源“${owner}”管理相同路径“${path}”`);
          }

          managedPaths.set(path, `${crate.id}/${resource.id}`);
          const content = secret.is(resource.content)
            ? await resolveSecret(resource.content, resolver)
            : resource.content;
          fileReferences.set(resource.id, Object.freeze({ path, revision: fingerprint(content, fingerprintKey) }));
          resources.push(
            Object.freeze({
              kind: "file",
              id: resource.id,
              path,
              content,
              mode: resource.mode,
              owner: resource.owner,
              group: resource.group,
            }),
          );
          break;
        }
        case "container": {
          for (const port of resource.ports ?? []) {
            if (port.host === undefined) {
              continue;
            }

            const key = `${port.host}/${port.protocol ?? "tcp"}`;
            const owner = publishedPorts.get(key);

            if (owner !== undefined) {
              throw new TypeError(`容器“${crate.id}/${resource.id}”与容器“${owner}”重复发布服务器端口“${key}”`);
            }

            publishedPorts.set(key, `${crate.id}/${resource.id}`);
          }

          const specification: IContainerSpecification = Object.freeze({
            kind: "container",
            id: resource.id,
            image: resource.image,
            command: resource.command,
            environment: await resolveEnvironment(resource.environment, resolver),
            mounts: Object.freeze(
              (resource.mounts ?? []).map((mount) => {
                const file =
                  typeof mount.source !== "string" && mount.source.kind === "file"
                    ? fileReferences.get(mount.source.id)
                    : undefined;

                if (typeof mount.source !== "string" && mount.source.kind === "file" && file === undefined) {
                  throw new TypeError(
                    `容器“${crate.id}/${resource.id}”引用的托管文件“${mount.source.id}”没有可执行规格`,
                  );
                }

                return Object.freeze({
                  source:
                    typeof mount.source === "string"
                      ? mount.source
                      : mount.source.kind === "storage"
                        ? posix.join(crateLayout.data, mount.source.id)
                        : file!.path,
                  target: mount.target,
                  readOnly: mount.readOnly ?? false,
                  revision: file?.revision,
                });
              }),
            ),
            ports: Object.freeze(
              (resource.ports ?? []).map((port) =>
                Object.freeze({
                  container: port.container,
                  host: port.host,
                  address: port.address,
                  protocol: port.protocol ?? "tcp",
                }),
              ),
            ),
            restart: resource.restart,
            healthcheck:
              resource.healthcheck === undefined
                ? undefined
                : Object.freeze({
                    command: resource.healthcheck.command,
                    interval: resource.healthcheck.interval ?? "30s",
                    timeout: resource.healthcheck.timeout ?? "30s",
                    startPeriod: resource.healthcheck.startPeriod ?? "0s",
                    retries: resource.healthcheck.retries ?? 3,
                  }),
            startupTimeout: resource.startupTimeout,
            stopTimeout: resource.stopTimeout,
            stopSignal: resource.stopSignal,
            sharedMemory: resource.sharedMemory,
          });
          resources.push(specification);
          break;
        }
        case "task": {
          const specification: ITaskSpecification = Object.freeze({
            kind: "task",
            id: resource.id,
            command: resource.command,
            arguments: Object.freeze([...(resource.arguments ?? [])]),
            environment: await resolveEnvironment(resource.environment, resolver),
            stdin: resource.stdin === undefined ? undefined : await resolveText(resource.stdin, resolver),
            workingDirectory: resource.workingDirectory,
            run: resource.run,
            impact: resource.impact,
            revision: resource.revision,
            markerPath: posix.join(crateLayout.runtime, `${resource.id}.task.json`),
            targetContainer:
              resource.target === undefined
                ? undefined
                : createContainerName(project, server.id, crate.id, resource.target.id),
          });
          resources.push(specification);
          break;
        }
      }
    }

    crates.push(
      Object.freeze({
        id: crate.id,
        description: crate.description,
        name: crate.name,
        version: crate.version,
        compatibility: crate.compatibility,
        optionsSnapshot: createOptionsSnapshot(crate.options, crate.secretOptionPaths, fingerprintKey),
        optionChangePolicies: crate.optionChangePolicies,
        assessChange: crate.assessChange,
        resources: Object.freeze(resources),
      }),
    );
  }

  return Object.freeze({ project, server: server.id, crates: Object.freeze(crates) });
}
