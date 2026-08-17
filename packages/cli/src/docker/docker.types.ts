/**
 * 容器实际状态
 */
export interface IContainerState {
  readonly exists: boolean;
  readonly running: boolean;
  readonly status?: string;
  readonly health?: string;
  readonly image?: string;
  readonly imageId?: string;
  readonly desiredHash?: string;
  readonly labels: Readonly<Record<string, string>>;
  readonly configuration?: unknown;
}

/**
 * 容器运行参数
 */
export interface IRunContainerOptions {
  readonly name: string;
  readonly image: string;
  readonly network: string;
  readonly networkAlias: string;
  readonly restart: string;
  readonly labels: Readonly<Record<string, string>>;
  readonly environmentFile?: string;
  readonly mounts: readonly Readonly<{ source: string; target: string; readOnly: boolean }>[];
  readonly ports: readonly Readonly<{
    container: number;
    host?: number;
    address?: string;
    protocol: "tcp" | "udp";
  }>[];
  readonly command?: readonly string[];
  readonly healthcheck?: Readonly<{
    command: string;
    interval: string;
    timeout: string;
    startPeriod: string;
    retries: number;
  }>;
  readonly stopTimeout: number;
  readonly stopSignal?: string;
  readonly sharedMemory?: string;
}

/**
 * `Docker` 客户端
 */
export interface IDockerClient {
  check(): Promise<void>;
  inspect(name: string): Promise<IContainerState>;
  checkNetwork(name: string, labels: Readonly<Record<string, string>>): Promise<boolean>;
  ensureNetwork(name: string, labels: Readonly<Record<string, string>>): Promise<void>;
  pull(image: string): Promise<void>;
  resolveImageDigest(image: string): Promise<string | undefined>;
  run(options: IRunContainerOptions): Promise<void>;
  waitUntilReady(name: string, timeout: number): Promise<void>;
  remove(name: string): Promise<void>;
  start(name: string): Promise<void>;
  stop(name: string, timeout?: number): Promise<void>;
  restart(name: string, timeout?: number): Promise<void>;
  logs(
    name: string,
    args: readonly string[],
    observer?: Readonly<{ stdout?: (chunk: string) => void; stderr?: (chunk: string) => void }>,
  ): Promise<void>;
  exec(
    name: string,
    command: readonly string[],
    options?: Readonly<{ tty?: boolean; interactive?: boolean; user?: string; workingDirectory?: string }>,
  ): Promise<void>;
  execTask(
    name: string,
    command: readonly string[],
    options?: Readonly<{ stdin?: string; workingDirectory?: string }>,
  ): Promise<void>;
}
