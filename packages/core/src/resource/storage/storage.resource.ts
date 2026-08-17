import { BaseResource } from "../base/base.resource";
import { validateMode, validateResourceText } from "../resource.validate";
import type { IStorageResourceOptions } from "./storage.types";

/**
 * 持久化存储资源描述
 *
 * 运行时根据项目、服务器、`Crate` 实例和资源标识分配固定目录
 */
export class StorageResource<Id extends string = string> extends BaseResource<"storage", Id> {
  /**
   * 资源类型标识
   */
  public readonly kind = "storage" as const;
  /**
   * 是否允许备份工具自动发现该存储
   */
  public readonly backup: boolean;
  /**
   * 存储目录权限
   */
  public readonly mode: number;
  /**
   * 存储目录所有者
   */
  public readonly owner?: string;
  /**
   * 存储目录所属用户组
   */
  public readonly group?: string;

  public constructor(id: Id, options: IStorageResourceOptions = {}) {
    super(id);

    if (typeof options !== "object" || options === null) {
      throw new TypeError("持久化存储资源配置必须是对象");
    }

    if (options.backup !== undefined && typeof options.backup !== "boolean") {
      throw new TypeError("存储备份标记必须是布尔值");
    }

    this.backup = options.backup ?? true;
    this.mode = validateMode(options.mode, "存储目录权限") ?? 0o750;
    this.owner = options.owner === undefined ? undefined : validateResourceText(options.owner, "存储目录所有者");
    this.group = options.group === undefined ? undefined : validateResourceText(options.group, "存储目录用户组");

    Object.freeze(this);
  }
}
