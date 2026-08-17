import { BaseResource } from "../base/base.resource";
import type { TResourceText } from "../resource.types";
import { validateAbsolutePath, validateMode, validateResourceText, validateResourceValue } from "../resource.validate";
import type { IFileResourceOptions } from "./file.types";

/**
 * 文件资源描述
 */
export class FileResource<Id extends string = string> extends BaseResource<"file", Id> {
  readonly #content: TResourceText | Uint8Array;

  /**
   * 资源类型标识
   */
  public readonly kind = "file" as const;

  /**
   * 服务器上的绝对路径
   *
   * 未定义时由运行时解析到当前 `Crate` 的托管配置目录
   */
  public readonly path?: string;
  /**
   * 文件内容
   */
  public get content(): TResourceText | Uint8Array {
    return this.#content instanceof Uint8Array ? new Uint8Array(this.#content) : this.#content;
  }
  /**
   * 文件权限
   */
  public readonly mode?: number;
  /**
   * 文件所有者
   */
  public readonly owner?: string;
  /**
   * 文件所属用户组
   */
  public readonly group?: string;

  public constructor(id: Id, options: IFileResourceOptions) {
    super(id);

    if (typeof options !== "object" || options === null) {
      throw new TypeError("文件资源配置必须是对象");
    }

    if (options.path !== undefined) {
      this.path = validateAbsolutePath(options.path, "文件路径");

      if (this.path === "/") {
        throw new TypeError("文件资源路径不能是服务器根目录");
      }
    }

    if (!(options.content instanceof Uint8Array)) {
      validateResourceValue(options.content, "文件内容");
    }

    this.#content = options.content instanceof Uint8Array ? new Uint8Array(options.content) : options.content;
    this.mode = validateMode(options.mode, "文件权限");
    this.owner = options.owner === undefined ? undefined : validateResourceText(options.owner, "文件所有者");
    this.group = options.group === undefined ? undefined : validateResourceText(options.group, "文件用户组");

    Object.freeze(this);
  }
}
