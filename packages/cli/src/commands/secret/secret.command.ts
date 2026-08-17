import { decryptSecret, encryptSecret, parseSecretEnvelope } from "@cratenaut/core/internal";
import { isCancel, password } from "@clack/prompts";
import { chmod, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { defineCommand } from "citty";

import { diagnostics } from "../../diagnostic/diagnostic.catalog";
import { createOutput } from "../../output/output.instance";

const outputArguments = {
  json: { type: "boolean" as const, description: "输出 JSON" },
  plain: { type: "boolean" as const, description: "禁用交互和 ANSI 样式" },
  verbose: { type: "boolean" as const, alias: "v", description: "输出详细错误" },
};

/**
 * 获取秘密加解密口令
 */
async function getPassword(
  output: ReturnType<typeof createOutput>,
  keyFile: string | undefined,
  keyStdin: boolean,
  confirm: boolean,
): Promise<string> {
  const passwordSources = [keyFile !== undefined, keyStdin, process.env.CRATENAUT_SECRET_KEY !== undefined].filter(
    Boolean,
  ).length;

  if (passwordSources > 1) {
    throw diagnostics.CRN_CLI_5002();
  }

  if (keyFile !== undefined) {
    return (await Bun.file(resolve(keyFile)).text()).trimEnd();
  }

  if (keyStdin) {
    return (await Bun.stdin.text()).trimEnd();
  }

  if (process.env.CRATENAUT_SECRET_KEY !== undefined) {
    return process.env.CRATENAUT_SECRET_KEY;
  }

  if (output.mode !== "interactive") {
    throw diagnostics.CRN_CLI_5001();
  }

  if (!confirm) {
    return output.password("输入解密口令");
  }

  const first = await password({
    message: "输入加密口令",
    validate: (value) => ((value ?? "").length < 12 ? "加密口令至少需要 12 个字符" : undefined),
  });

  if (isCancel(first)) {
    throw diagnostics.CRN_CLI_9001();
  }

  const second = await password({ message: "再次输入加密口令" });

  if (isCancel(second)) {
    throw diagnostics.CRN_CLI_9001();
  }

  if (first !== second) {
    throw new TypeError("两次输入的加密口令不一致");
  }

  return first;
}

/**
 * 秘密加密和信封检查命令
 */
export const secretCommand = defineCommand({
  meta: { name: "secret", description: "加密和检查秘密信封" },
  subCommands: {
    encrypt: defineCommand({
      meta: { name: "encrypt", description: "使用 scrypt 和 AES-256-GCM 加密秘密" },
      args: {
        ...outputArguments,
        value: {
          type: "string",
          description: "要加密的值，可能进入 Shell 历史，生产环境建议改用 --from-stdin",
        },
        "from-stdin": {
          type: "boolean",
          description: "从标准输入读取明文",
        },
        "key-file": {
          type: "string",
          description: "从文件读取加密口令",
        },
        "key-stdin": {
          type: "boolean",
          description: "从标准输入读取加密口令",
        },
        output: {
          type: "string",
          alias: "o",
          description: "将密文写入权限为 0600 的文件",
        },
      },
      run: async ({ args }) => {
        const output = createOutput(args);

        if (args["from-stdin"] === true && args["key-stdin"] === true) {
          throw diagnostics.CRN_CLI_5002();
        }

        const value =
          args["from-stdin"] === true
            ? (await Bun.stdin.text()).trimEnd()
            : (args.value ?? (output.mode === "interactive" ? await output.password("输入要加密的秘密") : undefined));

        if (value === undefined) {
          throw diagnostics.CRN_CLI_1004();
        }

        if (args.value !== undefined) {
          output.warn("--value 可能被 Shell 历史记录保存，生产环境建议使用 --from-stdin");
        }

        const key = await getPassword(output, args["key-file"], args["key-stdin"] === true, true);

        if (key.length < 12) {
          throw new TypeError("秘密加密口令至少需要 12 个字符");
        }

        const encrypted = await encryptSecret(value, key);

        if (args.output === undefined) {
          output.data(encrypted);
          return;
        }

        const path = resolve(args.output);
        await mkdir(dirname(path), { recursive: true });
        await Bun.write(path, `${encrypted}\n`);
        await chmod(path, 0o600);
        output.success(`加密秘密已写入 ${path}`);
      },
    }),
    inspect: defineCommand({
      meta: { name: "inspect", description: "检查秘密信封元数据，不输出明文" },
      args: {
        ...outputArguments,
        value: { type: "positional", description: "秘密信封文本", required: true },
      },
      run: ({ args }) => {
        const envelope = parseSecretEnvelope(args.value);

        if (envelope === undefined) {
          throw new TypeError("输入不是有效的 Cratenaut 秘密信封");
        }

        createOutput(args).data({
          version: envelope.version,
          keyDerivation: {
            algorithm: envelope.keyDerivation.algorithm,
            cost: envelope.keyDerivation.cost,
            blockSize: envelope.keyDerivation.blockSize,
            parallelization: envelope.keyDerivation.parallelization,
          },
          cipher: { algorithm: envelope.cipher.algorithm },
        });
      },
    }),
    decrypt: defineCommand({
      meta: { name: "decrypt", description: "解密秘密并写入文件，不向终端输出明文" },
      args: {
        ...outputArguments,
        value: { type: "positional", description: "秘密信封文本", required: true },
        output: { type: "string", alias: "o", description: "明文输出文件", required: true },
        "key-file": { type: "string", description: "从文件读取解密口令" },
        "key-stdin": { type: "boolean", description: "从标准输入读取解密口令" },
      },
      run: async ({ args }) => {
        const output = createOutput(args);
        const envelope = parseSecretEnvelope(args.value);

        if (envelope === undefined) {
          throw new TypeError("输入不是有效的 Cratenaut 秘密信封");
        }

        const key = await getPassword(output, args["key-file"], args["key-stdin"] === true, false);
        const plaintext = await decryptSecret(envelope, key);
        const path = resolve(args.output);
        await mkdir(dirname(path), { recursive: true });
        await Bun.write(path, plaintext);
        await chmod(path, 0o600);
        output.success(`明文已写入 ${path}`);
      },
    }),
  },
});
