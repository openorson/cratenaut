import type { TResourceText } from "../resource.types";

/**
 * 文件资源配置
 */
export interface IFileResourceOptions {
  /**
   * 服务器上的绝对路径
   *
   * 省略时使用当前 `Crate` 的托管配置目录和资源标识
   */
  readonly path?: string;
  /**
   * 文件内容
   *
   * 秘密值只能表示完整文本内容；二进制秘密应先由调用方编码为文本
   */
  readonly content: TResourceText | Uint8Array;
  /**
   * 文件权限，例如 `0o640`
   *
   * @defaultValue `0o640`
   */
  readonly mode?: number;
  /**
   * 文件所有者
   */
  readonly owner?: string;
  /**
   * 文件所属用户组
   */
  readonly group?: string;
}

/**
 * 当前 `Crate` 内的文件资源引用
 */
export interface IFileReference<Id extends string = string> {
  /**
   * 引用类型
   */
  readonly kind: "file";
  /**
   * 被引用的文件资源标识
   */
  readonly id: Id;
}
