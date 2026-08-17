import { decryptSecret, type ISecretEnvelope } from "@cratenaut/core/internal";
import { isAbsolute, resolve } from "node:path";

import { diagnostics } from "../diagnostic/diagnostic.catalog";
import type { ICreateSecretResolverOptions, ISecretResolverContext } from "./config.types";

/**
 * 创建只在物化阶段读取秘密的解析器
 */
export function createSecretResolver(options: ICreateSecretResolverOptions): ISecretResolverContext {
  const passwordSources = [
    options.args.secretKeyFile !== undefined,
    options.args.secretKeyStdin === true,
    process.env.CRATENAUT_SECRET_KEY !== undefined,
  ].filter(Boolean).length;

  if (passwordSources > 1) {
    throw diagnostics.CRN_CLI_5002();
  }

  let passwordPromise: Promise<string> | undefined;

  const getPassword = (): Promise<string> => {
    if (passwordPromise !== undefined) {
      return passwordPromise;
    }

    passwordPromise = (async () => {
      if (options.args.secretKeyFile !== undefined) {
        const path = isAbsolute(options.args.secretKeyFile)
          ? options.args.secretKeyFile
          : resolve(process.cwd(), options.args.secretKeyFile);
        return (await Bun.file(path).text()).trimEnd();
      }

      if (options.args.secretKeyStdin === true) {
        return (await Bun.stdin.text()).trimEnd();
      }

      if (process.env.CRATENAUT_SECRET_KEY !== undefined) {
        return process.env.CRATENAUT_SECRET_KEY;
      }

      if (options.output.mode === "interactive") {
        return options.output.password("请输入秘密解密口令");
      }

      throw diagnostics.CRN_CLI_5001();
    })();

    return passwordPromise;
  };

  return Object.freeze({
    resolver: Object.freeze({
      environment: (name: string) => process.env[name],
      file: (path: string) => Bun.file(isAbsolute(path) ? path : resolve(options.configDirectory, path)).text(),
      decrypt: async (envelope: ISecretEnvelope) => decryptSecret(envelope, await getPassword()),
    }),
  });
}
