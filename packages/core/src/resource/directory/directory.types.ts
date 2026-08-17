/**
 * 目录资源配置
 */
export interface IDirectoryResourceOptions {
  /**
   * 服务器上的绝对路径
   */
  readonly path: string;
  /**
   * 目录权限，例如 `0o750`
   *
   * @defaultValue `0o750`
   */
  readonly mode?: number;
  /**
   * 目录所有者
   */
  readonly owner?: string;
  /**
   * 目录所属用户组
   */
  readonly group?: string;
}
