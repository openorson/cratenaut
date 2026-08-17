/**
 * 持久化存储资源配置
 */
export interface IStorageResourceOptions {
  /**
   * 是否允许备份工具自动发现该存储
   *
   * @defaultValue `true`
   */
  readonly backup?: boolean;
  /**
   * 存储目录权限
   *
   * @defaultValue `0o750`
   */
  readonly mode?: number;
  /**
   * 存储目录所有者
   */
  readonly owner?: string;
  /**
   * 存储目录所属用户组
   */
  readonly group?: string;
}

/**
 * 当前 `Crate` 内的持久化存储引用
 */
export interface IStorageReference<Id extends string = string> {
  /**
   * 引用类型
   */
  readonly kind: "storage";
  /**
   * 被引用的存储资源标识
   */
  readonly id: Id;
}
