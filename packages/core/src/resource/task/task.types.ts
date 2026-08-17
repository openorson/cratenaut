import type { TResourceText } from "../resource.types";
import type { IContainerReference } from "../container/container.types";

/**
 * 任务资源配置
 */
export interface ITaskResourceOptions {
  /**
   * 任务执行目标容器
   *
   * 省略时在目标服务器上执行
   */
  readonly target?: IContainerReference;
  /**
   * 要执行的程序
   */
  readonly command: string;
  /**
   * 传递给程序的参数
   *
   * 命令参数可能出现在进程列表或日志中，因此这里有意不接受秘密值
   */
  readonly arguments?: readonly string[];
  /**
   * 注入任务进程的环境变量
   */
  readonly environment?: Readonly<Record<string, TResourceText>>;
  /**
   * 写入任务标准输入的内容
   */
  readonly stdin?: TResourceText;
  /**
   * 任务工作目录
   */
  readonly workingDirectory?: string;
  /**
   * 执行时机
   *
   * @defaultValue `"on-change"`
   */
  readonly run?: TTaskRunPolicy;
  /**
   * 任务执行影响
   *
   * @defaultValue `"disruptive"`
   */
  readonly impact?: TTaskImpact;
  /**
   * 任务修订号
   *
   * 修改该值可以让 `once` 或 `on-change` 任务重新执行
   */
  readonly revision?: string;
}

/**
 * 任务执行策略
 */
export type TTaskRunPolicy = "always" | "on-change" | "once";

/**
 * 任务执行影响
 */
export type TTaskImpact = "safe" | "disruptive" | "destructive";
