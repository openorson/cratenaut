import { registerSecretSource } from "./secret.internal";
import type { TSecretSource } from "./secret.types";

const inspectCustom = Symbol.for("nodejs.util.inspect.custom");

/**
 * 日志和序列化中使用的秘密遮蔽文本
 */
export const SECRET_REDACTION_TEXT = "[secret]";

/**
 * 不透明秘密值
 *
 * 该对象保存的是秘密来源，而不是要求调用方立即提供明文
 *
 * 常规字符串转换、`JSON` 序列化以及 `Node.js` 对象检查都会得到统一的遮蔽文本
 */
export class Secret<Value extends string = string> {
  /**
   * 仅用于保留泛型类型，不会生成运行时字段
   */
  declare private readonly valueType: Value;

  /**
   * 创建不透明秘密值
   *
   * 通常应使用 {@link secret}，而不是直接调用构造函数
   */
  public constructor(source: TSecretSource<Value>) {
    registerSecretSource(this, source);
    Object.freeze(this);
  }

  /**
   * 返回遮蔽文本
   */
  public toString(): string {
    return SECRET_REDACTION_TEXT;
  }

  /**
   * 在 `JSON` 序列化时返回遮蔽文本
   */
  public toJSON(): string {
    return SECRET_REDACTION_TEXT;
  }

  /**
   * 在隐式转换为原始值时返回遮蔽文本
   */
  public [Symbol.toPrimitive](): string {
    return SECRET_REDACTION_TEXT;
  }

  /**
   * 在 `Node.js` 对象检查时返回遮蔽文本
   */
  public [inspectCustom](): string {
    return SECRET_REDACTION_TEXT;
  }
}
