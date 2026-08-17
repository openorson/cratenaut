import type { IConfig, ConfigTypes } from "@cratenaut/core";

import { diagnostics } from "../diagnostic/diagnostic.catalog";
import type { IOutput } from "../output/output.types";
import type { IRuntimeArguments } from "./runtime.types";

/**
 * 解析逗号分隔的标识列表
 */
function parseIdentifiers(value: string | undefined): readonly string[] {
  return value === undefined
    ? []
    : Object.freeze(
        value
          .split(",")
          .map((item) => item.trim())
          .filter((item) => item !== ""),
      );
}

/**
 * 选择本次命令处理的服务器和 `Crate`
 */
export async function selectConfig(config: IConfig, args: IRuntimeArguments, output: IOutput): Promise<IConfig> {
  const requestedServers = parseIdentifiers(args.server);
  let servers: readonly ConfigTypes.IServerDefinition[];

  if (requestedServers.length > 0) {
    servers = requestedServers.map((id) => {
      const server = config.servers.find((candidate) => candidate.id === id);

      if (server === undefined) {
        throw diagnostics.CRN_CLI_1003({ subject: "服务器", value: id });
      }

      return server;
    });
  } else if (args.all === true || config.servers.length === 1) {
    servers = config.servers;
  } else if (output.mode === "interactive") {
    const selected = await output.multiselect(
      "选择要处理的服务器",
      config.servers.map((server) => ({
        value: server.id,
        label: server.id,
        hint: server.description,
      })),
      [config.servers[0]!.id],
    );
    servers = config.servers.filter((server) => selected.includes(server.id));
  } else {
    throw diagnostics.CRN_CLI_1004();
  }

  const requestedCrates = parseIdentifiers(args.crate);
  const selectedServers = [];

  for (const server of servers) {
    let crates = server.crates;

    if (requestedCrates.length > 0) {
      crates = requestedCrates.map((id) => {
        const crate = server.crates.find((candidate) => candidate.id === id);

        if (crate === undefined) {
          throw diagnostics.CRN_CLI_1003({ subject: `服务器“${server.id}”中的 Crate`, value: id });
        }

        return crate;
      });
    } else if (args.all !== true && output.mode === "interactive" && server.crates.length > 1) {
      const selected = await output.multiselect(
        `选择服务器“${server.id}”中的 Crate`,
        server.crates.map((crate) => ({
          value: crate.id,
          label: crate.id,
          hint: crate.description ?? `${crate.name}@${crate.version}`,
        })),
        server.crates.map((crate) => crate.id),
      );
      crates = server.crates.filter((crate) => selected.includes(crate.id));
    }

    selectedServers.push(Object.freeze({ ...server, crates: Object.freeze([...crates]) }));
  }

  return Object.freeze({ project: config.project, servers: Object.freeze(selectedServers) });
}
