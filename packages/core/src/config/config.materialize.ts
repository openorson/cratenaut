import { materializeCrate } from "../crate/crate.materialize";
import type { IMaterializedConfig, IMaterializedServer } from "../internal/internal.types";
import type { ISecretResolver } from "../secret/secret.types";
import type { IConfig } from "./config.types";

/**
 * 按配置顺序物化全部服务器和 `Crate` 实例
 *
 * @internal
 */
export async function materializeConfig(config: IConfig, resolver: ISecretResolver): Promise<IMaterializedConfig> {
  const servers: IMaterializedServer[] = [];

  for (const server of config.servers) {
    const crates = [];

    for (const crate of server.crates) {
      crates.push(await materializeCrate(crate, resolver));
    }

    servers.push(
      Object.freeze({
        id: server.id,
        description: server.description,
        connection: server.connection,
        root: server.root,
        crates: Object.freeze(crates),
      }),
    );
  }

  return Object.freeze({
    project: config.project,
    servers: Object.freeze(servers),
  });
}
