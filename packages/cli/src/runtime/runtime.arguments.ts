import type { IRuntimeArguments } from "./runtime.types";

/**
 * 把 `CLI` 的短横线参数转换为内部驼峰字段
 */
export function normalizeRuntimeArguments(args: Readonly<Record<string, unknown>>): IRuntimeArguments {
  return Object.freeze({
    config: typeof args.config === "string" ? args.config : undefined,
    global: args.global === true,
    server: typeof args.server === "string" ? args.server : undefined,
    crate: typeof args.crate === "string" ? args.crate : undefined,
    all: args.all === true,
    yes: args.yes === true,
    json: args.json === true,
    plain: args.plain === true,
    verbose: args.verbose === true,
    secretKeyFile: typeof args["secret-key-file"] === "string" ? args["secret-key-file"] : undefined,
    secretKeyStdin: args["secret-key-stdin"] === true,
    allowDestructive: args["allow-destructive"] === true,
    allowUnknownChange: args["allow-unknown-change"] === true,
    allowMajor: args["allow-major"] === true,
    allowDowngrade: args["allow-downgrade"] === true,
    overwriteDrift: args["overwrite-drift"] === true,
    prune: args.prune === true,
    forceUnlock: args["force-unlock"] === true,
  });
}
