import type { TResourceText } from "../resource.types";
import type { IFileReference } from "../file/file.types";
import type { IStorageReference } from "../storage/storage.types";

/**
 * 容器端口映射
 */
export interface IContainerPort {
  /**
   * 容器内端口
   */
  readonly container: number;
  /**
   * 服务器端口
   *
   * 省略时只在容器网络内提供服务
   */
  readonly host?: number;
  /**
   * 服务器监听地址
   *
   * 仅在发布服务器端口时生效
   */
  readonly address?: string;
  /**
   * 传输协议
   *
   * @defaultValue `"tcp"`
   */
  readonly protocol?: "tcp" | "udp";
}

/**
 * 容器挂载项
 */
export interface IContainerMount {
  /**
   * 服务器上的源路径或当前 `Crate` 内的持久化存储引用
   */
  readonly source: string | IFileReference | IStorageReference;
  /**
   * 容器内的目标路径
   */
  readonly target: string;
  /**
   * 是否以只读方式挂载
   *
   * @defaultValue `false`
   */
  readonly readOnly?: boolean;
}

/**
 * 容器资源配置
 */
export interface IContainerResourceOptions {
  /**
   * 容器镜像
   */
  readonly image: string;
  /**
   * 覆盖镜像默认命令的参数数组
   *
   * 命令参数可能出现在进程列表或日志中，因此这里有意不接受秘密值
   */
  readonly command?: readonly string[];
  /**
   * 注入容器的环境变量
   */
  readonly environment?: Readonly<Record<string, TResourceText>>;
  /**
   * 文件、目录或持久化存储挂载项
   */
  readonly mounts?: readonly IContainerMount[];
  /**
   * 端口映射
   */
  readonly ports?: readonly IContainerPort[];
  /**
   * 容器健康检查
   */
  readonly healthcheck?: IContainerHealthcheck;
  /**
   * 等待容器健康的最长秒数
   *
   * @defaultValue `60`
   */
  readonly startupTimeout?: number;
  /**
   * 容器停止超时秒数
   *
   * @defaultValue `10`
   */
  readonly stopTimeout?: number;
  /**
   * 容器停止信号
   */
  readonly stopSignal?: string;
  /**
   * 容器共享内存大小
   *
   * 取值遵循 `Docker --shm-size` 格式
   */
  readonly sharedMemory?: string;
  /**
   * 容器退出后的重启策略
   *
   * @defaultValue `"unless-stopped"`
   */
  readonly restart?: TContainerRestartPolicy;
}

/**
 * 容器重启策略
 */
export type TContainerRestartPolicy = "no" | "always" | "on-failure" | "unless-stopped";

/**
 * 容器健康检查配置
 */
export interface IContainerHealthcheck {
  /**
   * 在容器内由 `Shell` 执行的检查命令
   */
  readonly command: string;
  /**
   * 检查间隔
   *
   * @defaultValue `"30s"`
   */
  readonly interval?: string;
  /**
   * 单次检查超时
   *
   * @defaultValue `"30s"`
   */
  readonly timeout?: string;
  /**
   * 启动宽限期
   *
   * @defaultValue `"0s"`
   */
  readonly startPeriod?: string;
  /**
   * 连续失败次数
   *
   * @defaultValue `3`
   */
  readonly retries?: number;
}

/**
 * 当前 `Crate` 内的容器资源引用
 */
export interface IContainerReference<Id extends string = string> {
  /**
   * 引用类型
   */
  readonly kind: "container";
  /**
   * 被引用的容器资源标识
   */
  readonly id: Id;
}
