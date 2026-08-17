import type { ConfigTypes } from "@cratenaut/core";

/**
 * 远程命令执行参数
 */
export interface IExecuteOptions {
  readonly cwd?: string;
  readonly environment?: Readonly<Record<string, string>>;
  readonly stdin?: string | Uint8Array;
  readonly allowFailure?: boolean;
  readonly tty?: boolean;
}

/**
 * 远程命令执行结果
 */
export interface IExecuteResult {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * 流式命令输出观察器
 */
export interface IStreamObserver {
  readonly stdout?: (chunk: string) => void;
  readonly stderr?: (chunk: string) => void;
}

/**
 * 服务器连接客户端
 */
export interface IConnectionClient {
  readonly serverId: string;
  readonly connection: ConfigTypes.TServerConnection;
  execute(command: string, args?: readonly string[], options?: IExecuteOptions): Promise<IExecuteResult>;
  executeInteractive(command: string, args?: readonly string[], options?: IExecuteOptions): Promise<void>;
  executeStream(
    command: string,
    args: readonly string[],
    observer: IStreamObserver,
    options?: IExecuteOptions,
  ): Promise<void>;
  readText(path: string): Promise<string | undefined>;
  writeText(path: string, content: string | Uint8Array, mode?: number): Promise<void>;
  exists(path: string): Promise<boolean>;
  ensureDirectory(path: string, mode?: number): Promise<void>;
  removeFile(path: string): Promise<void>;
}
