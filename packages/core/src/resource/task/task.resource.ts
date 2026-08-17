import { BaseResource } from "../base/base.resource";
import type { IContainerReference } from "../container/container.types";
import type { TResourceText } from "../resource.types";
import {
  validateAbsolutePath,
  validateChoice,
  validateResourceText,
  validateResourceValue,
  validateStringArray,
} from "../resource.validate";
import type { ITaskResourceOptions, TTaskImpact, TTaskRunPolicy } from "./task.types";

/**
 * 任务资源描述
 *
 * 任务是资源清单中的显式部署操作，不是隐藏的生命周期钩子
 *
 * 其执行位置由 `Crate` 返回的资源数组决定
 */
export class TaskResource<Id extends string = string> extends BaseResource<"task", Id> {
  /**
   * 资源类型标识
   */
  public readonly kind = "task" as const;

  /**
   * 任务执行目标容器
   */
  public readonly target?: IContainerReference;

  /**
   * 要执行的程序
   */
  public readonly command: string;
  /**
   * 传递给程序的参数
   */
  public readonly arguments?: readonly string[];
  /**
   * 注入任务进程的环境变量
   */
  public readonly environment?: Readonly<Record<string, TResourceText>>;
  /**
   * 写入任务标准输入的内容
   */
  public readonly stdin?: TResourceText;
  /**
   * 任务工作目录
   */
  public readonly workingDirectory?: string;
  /**
   * 执行时机
   */
  public readonly run: TTaskRunPolicy;
  /**
   * 任务执行影响
   */
  public readonly impact: TTaskImpact;
  /**
   * 任务修订号
   */
  public readonly revision?: string;

  public constructor(id: Id, options: ITaskResourceOptions) {
    super(id);

    if (typeof options !== "object" || options === null) {
      throw new TypeError("任务资源配置必须是对象");
    }

    validateResourceText(options.command, "任务程序");
    validateStringArray(options.arguments, "任务参数");

    if (options.target !== undefined && options.target.kind !== "container") {
      throw new TypeError("任务执行目标必须是容器引用");
    }

    if (options.workingDirectory !== undefined) {
      validateAbsolutePath(options.workingDirectory, "任务工作目录");
    }

    if (options.revision !== undefined) {
      validateResourceText(options.revision, "任务修订号");
    }

    for (const [name, value] of Object.entries(options.environment ?? {})) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
        throw new TypeError(`任务环境变量名称无效：${name}`);
      }

      validateResourceValue(value, `任务环境变量“${name}”`);
    }

    if (options.stdin !== undefined) {
      validateResourceValue(options.stdin, "任务标准输入");
    }

    this.target = options.target === undefined ? undefined : Object.freeze({ ...options.target });
    this.command = options.command;
    this.arguments = options.arguments === undefined ? undefined : Object.freeze([...options.arguments]);
    this.environment = options.environment === undefined ? undefined : Object.freeze({ ...options.environment });
    this.stdin = options.stdin;
    this.workingDirectory = options.workingDirectory;
    this.run = validateChoice(options.run, ["always", "on-change", "once"], "任务执行时机") ?? "on-change";
    this.impact = validateChoice(options.impact, ["safe", "disruptive", "destructive"], "任务执行影响") ?? "disruptive";
    this.revision = options.revision;

    Object.freeze(this);
  }
}
