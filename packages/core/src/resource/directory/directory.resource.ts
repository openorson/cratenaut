import { BaseResource } from "../base/base.resource";
import { validateAbsolutePath, validateMode, validateResourceText } from "../resource.validate";
import type { IDirectoryResourceOptions } from "./directory.types";

/**
 * 目录资源描述
 */
export class DirectoryResource<Id extends string = string> extends BaseResource<"directory", Id> {
  /**
   * 资源类型标识
   */
  public readonly kind = "directory" as const;

  /**
   * 服务器上的绝对路径
   */
  public readonly path: string;
  /**
   * 目录权限
   */
  public readonly mode?: number;
  /**
   * 目录所有者
   */
  public readonly owner?: string;
  /**
   * 目录所属用户组
   */
  public readonly group?: string;

  public constructor(id: Id, options: IDirectoryResourceOptions) {
    super(id);

    if (typeof options !== "object" || options === null) {
      throw new TypeError("目录资源配置必须是对象");
    }

    this.path = validateAbsolutePath(options.path, "目录路径");

    if (this.path === "/") {
      throw new TypeError("目录资源不能管理服务器根目录");
    }

    this.mode = validateMode(options.mode, "目录权限");
    this.owner = options.owner === undefined ? undefined : validateResourceText(options.owner, "目录所有者");
    this.group = options.group === undefined ? undefined : validateResourceText(options.group, "目录用户组");

    Object.freeze(this);
  }
}
