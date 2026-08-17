/**
 * 命令输出模式
 */
export type TOutputMode = "interactive" | "plain" | "json";

/**
 * 选择项
 */
export interface IOutputOption<Value extends string = string> {
  /**
   * 实际值
   */
  readonly value: Value;
  /**
   * 显示文本
   */
  readonly label: string;
  /**
   * 补充说明
   */
  readonly hint?: string;
}

/**
 * 进度输出控制器
 */
export interface IOutputProgress {
  /**
   * 更新进度说明
   */
  message(message: string): void;
  /**
   * 标记成功结束
   */
  stop(message?: string): void;
  /**
   * 标记失败结束
   */
  error(message?: string): void;
}

/**
 * 统一命令输出接口
 */
export interface IOutput {
  /**
   * 当前输出模式
   */
  readonly mode: TOutputMode;
  intro(message: string): void;
  outro(message: string): void;
  info(message: string, data?: unknown): void;
  step(message: string, data?: unknown): void;
  success(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
  data(value: unknown): void;
  markdown(value: string): void;
  progress(message: string): IOutputProgress;
  confirm(message: string, initialValue?: boolean): Promise<boolean>;
  select<Value extends string>(
    message: string,
    options: readonly IOutputOption<Value>[],
    initialValue?: Value,
  ): Promise<Value>;
  multiselect<Value extends string>(
    message: string,
    options: readonly IOutputOption<Value>[],
    initialValues?: readonly Value[],
  ): Promise<readonly Value[]>;
  text(message: string, placeholder?: string): Promise<string>;
  password(message: string): Promise<string>;
}
