import { BaseResource } from "../base/base.resource";
import { isIP } from "node:net";
import type { TResourceText } from "../resource.types";
import {
  validateAbsolutePath,
  validateChoice,
  validateResourceText,
  validateResourceValue,
  validateStringArray,
} from "../resource.validate";
import type {
  IContainerHealthcheck,
  IContainerMount,
  IContainerPort,
  IContainerResourceOptions,
  TContainerRestartPolicy,
} from "./container.types";

const durationPattern = /^(?:0|(?:\d+(?:\.\d+)?(?:ns|us|µs|ms|s|m|h))+)$/;
const memoryPattern = /^[1-9]\d*(?:[bkmg])?$/i;
const signalPattern = /^(?:SIG[A-Z0-9]+|[1-9]\d*)$/;

/**
 * 容器资源描述
 */
export class ContainerResource<Id extends string = string> extends BaseResource<"container", Id> {
  /**
   * 资源类型标识
   */
  public readonly kind = "container" as const;

  /**
   * 容器镜像
   */
  public readonly image: string;
  /**
   * 覆盖镜像默认命令的参数数组
   */
  public readonly command?: readonly string[];
  /**
   * 注入容器的环境变量
   */
  public readonly environment?: Readonly<Record<string, TResourceText>>;
  /**
   * 文件或目录挂载项
   */
  public readonly mounts?: readonly IContainerMount[];
  /**
   * 端口映射
   */
  public readonly ports?: readonly IContainerPort[];
  /**
   * 容器健康检查
   */
  public readonly healthcheck?: IContainerHealthcheck;
  /**
   * 等待容器健康的最长秒数
   */
  public readonly startupTimeout: number;
  /**
   * 容器停止超时秒数
   */
  public readonly stopTimeout: number;
  /**
   * 容器停止信号
   */
  public readonly stopSignal?: string;
  /**
   * 容器共享内存大小
   */
  public readonly sharedMemory?: string;
  /**
   * 容器退出后的重启策略
   */
  public readonly restart: TContainerRestartPolicy;

  public constructor(id: Id, options: IContainerResourceOptions) {
    super(id);

    if (typeof options !== "object" || options === null) {
      throw new TypeError("容器资源配置必须是对象");
    }

    validateResourceText(options.image, "容器镜像");
    validateStringArray(options.command, "容器命令");
    const mountTargets = new Set<string>();

    for (const mount of options.mounts ?? []) {
      if (typeof mount.source === "string") {
        validateAbsolutePath(mount.source, "容器挂载源路径");
      } else if (mount.source?.kind !== "storage" && mount.source?.kind !== "file") {
        throw new TypeError("容器挂载源必须是绝对路径、文件引用或持久化存储引用");
      }

      validateAbsolutePath(mount.target, "容器挂载目标路径");

      if (mount.readOnly !== undefined && typeof mount.readOnly !== "boolean") {
        throw new TypeError("容器挂载只读标记必须是布尔值");
      }

      if (mountTargets.has(mount.target)) {
        throw new TypeError(`容器挂载目标路径重复：${mount.target}`);
      }

      mountTargets.add(mount.target);
    }

    const publishedPorts = new Set<string>();

    for (const port of options.ports ?? []) {
      validateChoice(port.protocol, ["tcp", "udp"] as const, "容器端口协议");

      if (port.address !== undefined) {
        validateResourceText(port.address, "容器端口监听地址");

        if (port.host === undefined) {
          throw new TypeError("容器端口只有在发布服务器端口时才能指定监听地址");
        }

        if (isIP(port.address) === 0) {
          throw new TypeError("容器端口监听地址必须是 IPv4 或 IPv6 地址");
        }
      }

      if (
        !Number.isInteger(port.container) ||
        port.container < 1 ||
        port.container > 65_535 ||
        (port.host !== undefined && (!Number.isInteger(port.host) || port.host < 1 || port.host > 65_535))
      ) {
        throw new TypeError("容器端口必须是 1 至 65535 的整数");
      }

      if (port.host !== undefined) {
        const publishedPort = `${port.host}/${port.protocol ?? "tcp"}`;

        if (publishedPorts.has(publishedPort)) {
          throw new TypeError(`容器服务器端口重复：${publishedPort}`);
        }

        publishedPorts.add(publishedPort);
      }
    }

    for (const [name, value] of Object.entries(options.environment ?? {})) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
        throw new TypeError(`容器环境变量名称无效：${name}`);
      }

      validateResourceValue(value, `容器环境变量“${name}”`);
    }

    if (options.healthcheck !== undefined) {
      if (typeof options.healthcheck !== "object" || options.healthcheck === null) {
        throw new TypeError("容器健康检查必须是对象");
      }

      validateResourceText(options.healthcheck.command, "容器健康检查命令");

      for (const [name, value] of [
        ["间隔", options.healthcheck.interval],
        ["超时", options.healthcheck.timeout],
        ["启动宽限期", options.healthcheck.startPeriod],
      ] as const) {
        if (value !== undefined) {
          validateResourceText(value, `容器健康检查${name}`);

          if (!durationPattern.test(value)) {
            throw new TypeError(`容器健康检查${name}必须是 Docker 时间长度`);
          }
        }
      }

      if (
        options.healthcheck.retries !== undefined &&
        (!Number.isInteger(options.healthcheck.retries) || options.healthcheck.retries < 1)
      ) {
        throw new TypeError("容器健康检查连续失败次数必须是正整数");
      }
    }

    for (const [name, value] of [
      ["启动等待超时", options.startupTimeout],
      ["停止超时", options.stopTimeout],
    ] as const) {
      if (value !== undefined && (!Number.isInteger(value) || value < 1)) {
        throw new TypeError(`容器${name}秒数必须是正整数`);
      }
    }

    if (options.stopSignal !== undefined) {
      validateResourceText(options.stopSignal, "容器停止信号");

      if (!signalPattern.test(options.stopSignal)) {
        throw new TypeError("容器停止信号必须是信号名称或正整数");
      }
    }

    if (options.sharedMemory !== undefined) {
      validateResourceText(options.sharedMemory, "容器共享内存大小");

      if (!memoryPattern.test(options.sharedMemory)) {
        throw new TypeError("容器共享内存大小必须使用正整数和可选的 b、k、m、g 单位");
      }
    }

    this.image = options.image;
    this.command = options.command === undefined ? undefined : Object.freeze([...options.command]);
    this.environment = options.environment === undefined ? undefined : Object.freeze({ ...options.environment });
    this.mounts =
      options.mounts === undefined
        ? undefined
        : Object.freeze(options.mounts.map((mount) => Object.freeze({ ...mount })));
    this.ports =
      options.ports === undefined ? undefined : Object.freeze(options.ports.map((port) => Object.freeze({ ...port })));
    this.healthcheck = options.healthcheck === undefined ? undefined : Object.freeze({ ...options.healthcheck });
    this.startupTimeout = options.startupTimeout ?? 60;
    this.stopTimeout = options.stopTimeout ?? 10;
    this.stopSignal = options.stopSignal;
    this.sharedMemory = options.sharedMemory;
    this.restart =
      validateChoice(options.restart, ["no", "always", "on-failure", "unless-stopped"], "容器重启策略") ??
      "unless-stopped";

    Object.freeze(this);
  }
}
