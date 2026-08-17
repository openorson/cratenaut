import {
  confirm,
  intro,
  isCancel,
  log,
  multiselect,
  outro,
  password,
  select,
  spinner,
  text,
  type Option as ClackOption,
} from "@clack/prompts";

import { diagnostics } from "../diagnostic/diagnostic.catalog";
import type { IOutput, IOutputOption, IOutputProgress, TOutputMode } from "./output.types";

/**
 * 终端统一输出器
 */
export class Output implements IOutput {
  public readonly mode: TOutputMode;

  public constructor(mode: TOutputMode) {
    this.mode = mode;
  }

  public intro(message: string): void {
    if (this.mode === "interactive") {
      intro(message);
    } else {
      this.write("intro", message);
    }
  }

  public outro(message: string): void {
    if (this.mode === "interactive") {
      outro(message);
    } else {
      this.write("outro", message);
    }
  }

  public info(message: string, data?: unknown): void {
    this.log("info", message, data);
  }

  public step(message: string, data?: unknown): void {
    this.log("step", message, data);
  }

  public success(message: string, data?: unknown): void {
    this.log("success", message, data);
  }

  public warn(message: string, data?: unknown): void {
    this.log("warn", message, data);
  }

  public error(message: string, data?: unknown): void {
    this.log("error", message, data);
  }

  public data(value: unknown): void {
    if (this.mode === "json") {
      console.log(JSON.stringify({ type: "data", value }));
      return;
    }

    console.log(typeof value === "string" ? value : JSON.stringify(value, null, 2));
  }

  public markdown(value: string): void {
    if (this.mode === "json") {
      this.write("markdown", value);
      return;
    }

    const styled = this.mode === "interactive";
    const rendered = Bun.markdown.render(value, {
      heading: (children) => (styled ? `\u001B[1;4m${children}\u001B[0m\n` : `${children}\n`),
      paragraph: (children) => `${children}\n`,
      strong: (children) => (styled ? `\u001B[1m${children}\u001B[22m` : children),
      emphasis: (children) => (styled ? `\u001B[3m${children}\u001B[23m` : children),
      codespan: (children) => (styled ? `\u001B[36m${children}\u001B[39m` : children),
      code: (children) => `\n${children.trimEnd()}\n`,
      listItem: (children, meta) =>
        `${"  ".repeat(meta.depth)}${meta.ordered ? `${(meta.start ?? 1) + meta.index}.` : "-"} ${children.trimEnd()}\n`,
      list: (children) => children,
      link: (children, meta) => `${children} (${meta.href})`,
    });

    console.log(rendered.trimEnd());
  }

  public progress(message: string): IOutputProgress {
    if (this.mode === "interactive") {
      const indicator = spinner();
      indicator.start(message);
      return {
        message: (next) => indicator.message(next),
        stop: (next) => indicator.stop(next),
        error: (next) => indicator.error(next),
      };
    }

    this.write("progress", message);
    return {
      message: (next) => this.write("progress", next),
      stop: (next = "完成") => this.write("success", next),
      error: (next = "失败") => this.write("error", next),
    };
  }

  public async confirm(message: string, initialValue = false): Promise<boolean> {
    this.ensureInteractive();
    const result = await confirm({ message, initialValue });
    return this.unwrap(result);
  }

  public async select<Value extends string>(
    message: string,
    options: readonly IOutputOption<Value>[],
    initialValue?: Value,
  ): Promise<Value> {
    this.ensureInteractive();
    const result = await select({
      message,
      options: options.map((option) => ({
        value: option.value,
        label: option.label,
        hint: option.hint,
      })) as ClackOption<Value>[],
      initialValue,
    });
    return this.unwrap(result);
  }

  public async multiselect<Value extends string>(
    message: string,
    options: readonly IOutputOption<Value>[],
    initialValues: readonly Value[] = [],
  ): Promise<readonly Value[]> {
    this.ensureInteractive();
    const result = await multiselect({
      message,
      options: options.map((option) => ({
        value: option.value,
        label: option.label,
        hint: option.hint,
      })) as ClackOption<Value>[],
      initialValues: [...initialValues],
      required: true,
    });
    return this.unwrap(result);
  }

  public async text(message: string, placeholder?: string): Promise<string> {
    this.ensureInteractive();
    const result = await text({
      message,
      placeholder,
      validate: (value) => ((value ?? "").trim() === "" ? "不能为空" : undefined),
    });
    return this.unwrap(result);
  }

  public async password(message: string): Promise<string> {
    this.ensureInteractive();
    const result = await password({
      message,
      validate: (value) => ((value ?? "").length < 8 ? "口令至少需要 8 个字符" : undefined),
    });
    return this.unwrap(result);
  }

  private ensureInteractive(): void {
    if (this.mode !== "interactive") {
      throw diagnostics.CRN_CLI_1004();
    }
  }

  private unwrap<Value>(value: Value | symbol): Value {
    if (isCancel(value)) {
      throw diagnostics.CRN_CLI_9001();
    }

    return value;
  }

  private log(level: "info" | "step" | "success" | "warn" | "error", message: string, data?: unknown): void {
    if (this.mode === "interactive") {
      log[level](message);
      return;
    }

    this.write(level, message, data);
  }

  private write(type: string, message: string, data?: unknown): void {
    if (this.mode === "json") {
      console.log(JSON.stringify({ type, message, ...(data === undefined ? {} : { data }) }));
      return;
    }

    console.log(`${type === "error" ? "错误" : type === "warn" ? "警告" : "信息"}：${message}`);

    if (data !== undefined) {
      console.log(JSON.stringify(data, null, 2));
    }
  }
}

/**
 * 根据命令参数创建输出器
 */
export function createOutput(args: Readonly<Record<string, unknown>>): IOutput {
  const mode: TOutputMode =
    args.json === true ? "json" : args.plain === true || !process.stdout.isTTY ? "plain" : "interactive";
  return new Output(mode);
}
