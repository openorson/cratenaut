import type { ConfigTypes } from "@cratenaut/core";
import { posix } from "node:path";

import { diagnostics } from "../diagnostic/diagnostic.catalog";
import type { IConnectionClient, IExecuteOptions, IExecuteResult, IStreamObserver } from "./connection.types";

/**
 * 对单个命令参数进行远程 `POSIX Shell` 转义
 */
function quote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

/**
 * 构建远程执行命令
 */
function buildRemoteCommand(command: string, args: readonly string[], options: IExecuteOptions): string {
  const environment = Object.entries(options.environment ?? {})
    .map(([key, value]) => `${key}=${quote(value)}`)
    .join(" ");
  const executable = [quote(command), ...args.map(quote)].join(" ");
  const withEnvironment = environment === "" ? executable : `env ${environment} ${executable}`;
  return options.cwd === undefined ? withEnvironment : `cd ${quote(options.cwd)} && ${withEnvironment}`;
}

/**
 * 服务器连接客户端实现
 */
export class ConnectionClient implements IConnectionClient {
  public readonly serverId: string;
  public readonly connection: ConfigTypes.TServerConnection;

  public constructor(serverId: string, connection: ConfigTypes.TServerConnection) {
    this.serverId = serverId;
    this.connection = connection;
  }

  public async execute(
    command: string,
    args: readonly string[] = [],
    options: IExecuteOptions = {},
  ): Promise<IExecuteResult> {
    if (this.connection.kind === "ssh" && Object.keys(options.environment ?? {}).length > 0) {
      throw new TypeError("SSH 命令环境变量必须通过权限受控的临时文件注入");
    }

    const invocation =
      this.connection.kind === "local"
        ? [command, ...args]
        : [...this.createSshArguments(options.tty === true), buildRemoteCommand(command, args, options)];
    const executable = this.connection.kind === "local" ? invocation : ["ssh", ...invocation];
    let processResult: Bun.Subprocess<"pipe", "pipe", "pipe">;

    try {
      processResult = Bun.spawn(executable, {
        cwd: this.connection.kind === "local" ? options.cwd : undefined,
        env: this.connection.kind === "local" ? { ...process.env, ...(options.environment ?? {}) } : process.env,
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
      });

      if (options.stdin !== undefined) {
        processResult.stdin.write(options.stdin);
      }

      processResult.stdin.end();
    } catch (error) {
      throw diagnostics.CRN_CLI_2001({ server: this.serverId, detail: String(error), cause: error });
    }

    const [code, stdout, stderr] = await Promise.all([
      processResult.exited,
      new Response(processResult.stdout).text(),
      new Response(processResult.stderr).text(),
    ]);
    const result = Object.freeze({ code, stdout, stderr });

    if (code !== 0 && options.allowFailure !== true) {
      throw diagnostics.CRN_CLI_4001({
        command: [command, ...args].join(" "),
        code,
        cause: new Error(stderr.trim()),
      });
    }

    return result;
  }

  public async executeInteractive(
    command: string,
    args: readonly string[] = [],
    options: IExecuteOptions = {},
  ): Promise<void> {
    if (this.connection.kind === "ssh" && Object.keys(options.environment ?? {}).length > 0) {
      throw new TypeError("SSH 命令环境变量必须通过权限受控的临时文件注入");
    }

    const invocation =
      this.connection.kind === "local"
        ? [command, ...args]
        : [...this.createSshArguments(options.tty === true), buildRemoteCommand(command, args, options)];
    const executable = this.connection.kind === "local" ? invocation : ["ssh", ...invocation];
    const processResult = Bun.spawn(executable, {
      cwd: this.connection.kind === "local" ? options.cwd : undefined,
      env: this.connection.kind === "local" ? { ...process.env, ...(options.environment ?? {}) } : process.env,
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });
    const code = await processResult.exited;

    if (code !== 0 && options.allowFailure !== true) {
      throw diagnostics.CRN_CLI_4001({ command: [command, ...args].join(" "), code });
    }
  }

  public async executeStream(
    command: string,
    args: readonly string[],
    observer: IStreamObserver,
    options: IExecuteOptions = {},
  ): Promise<void> {
    if (this.connection.kind === "ssh" && Object.keys(options.environment ?? {}).length > 0) {
      throw new TypeError("SSH 命令环境变量必须通过权限受控的临时文件注入");
    }

    const invocation =
      this.connection.kind === "local"
        ? [command, ...args]
        : [...this.createSshArguments(false), buildRemoteCommand(command, args, options)];
    const executable = this.connection.kind === "local" ? invocation : ["ssh", ...invocation];
    const processResult = Bun.spawn(executable, {
      cwd: this.connection.kind === "local" ? options.cwd : undefined,
      env: this.connection.kind === "local" ? { ...process.env, ...(options.environment ?? {}) } : process.env,
      stdin: "inherit",
      stdout: "pipe",
      stderr: "pipe",
    });
    const forward = async (stream: ReadableStream<Uint8Array>, callback: ((chunk: string) => void) | undefined) => {
      const decoder = new TextDecoder();

      for await (const chunk of stream) {
        callback?.(decoder.decode(chunk, { stream: true }));
      }

      const remaining = decoder.decode();

      if (remaining !== "") {
        callback?.(remaining);
      }
    };
    const [, , code] = await Promise.all([
      forward(processResult.stdout, observer.stdout),
      forward(processResult.stderr, observer.stderr),
      processResult.exited,
    ]);

    if (code !== 0 && options.allowFailure !== true) {
      throw diagnostics.CRN_CLI_4001({ command: [command, ...args].join(" "), code });
    }
  }

  public async readText(path: string): Promise<string | undefined> {
    const result = await this.execute("cat", [path], { allowFailure: true });
    return result.code === 0 ? result.stdout : undefined;
  }

  public async writeText(path: string, content: string | Uint8Array, mode = 0o600): Promise<void> {
    await this.execute("mkdir", ["-p", posix.dirname(path)]);
    await this.execute(
      "sh",
      [
        "-c",
        'target="$1"; mode="$2"; temporary="${target}.tmp.$$"; trap \'rm -f "$temporary"\' EXIT; cat > "$temporary"; chmod "$mode" "$temporary"; mv "$temporary" "$target"; trap - EXIT',
        "sh",
        path,
        mode.toString(8),
      ],
      { stdin: content },
    );
  }

  public async exists(path: string): Promise<boolean> {
    const result = await this.execute("test", ["-e", path], { allowFailure: true });
    return result.code === 0;
  }

  public async ensureDirectory(path: string, mode = 0o750): Promise<void> {
    await this.execute("mkdir", ["-p", path]);
    await this.execute("chmod", [mode.toString(8), path]);
  }

  public async removeFile(path: string): Promise<void> {
    await this.execute("rm", ["-f", path]);
  }

  private createSshArguments(tty = false): readonly string[] {
    if (this.connection.kind !== "ssh") {
      return [];
    }

    const args = [
      "-o",
      "BatchMode=yes",
      "-o",
      `ConnectTimeout=${this.connection.connectTimeout ?? 10}`,
      "-p",
      String(this.connection.port ?? 22),
    ];

    if (tty) {
      args.unshift("-t");
    }

    if (this.connection.identityFile !== undefined) {
      args.push("-i", this.connection.identityFile);
    }

    if (this.connection.proxyJump !== undefined) {
      args.push("-J", this.connection.proxyJump);
    }

    args.push(`${this.connection.user === undefined ? "" : `${this.connection.user}@`}${this.connection.host}`, "--");
    return args;
  }
}

/**
 * 创建服务器连接客户端
 */
export function createConnection(serverId: string, connection: ConfigTypes.TServerConnection): IConnectionClient {
  return new ConnectionClient(serverId, connection);
}
