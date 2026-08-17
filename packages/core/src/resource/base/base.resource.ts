import { validateIdentifier } from "../../identifier/identifier.validate";

/**
 * 资源描述基类
 *
 * 资源对象只表达期望状态，不负责连接服务器或执行部署操作
 *
 * 运行时通过 {@link kind} 判断具体资源类型，通过 {@link id} 在同一个 `Crate` 内标识资源
 */
export abstract class BaseResource<Kind extends string = string, Id extends string = string> {
  /**
   * 资源类型标识
   */
  public abstract readonly kind: Kind;

  /**
   * 资源在所属 `Crate` 内的唯一标识
   */
  public readonly id: Id;

  protected constructor(id: Id) {
    this.id = validateIdentifier(id, "资源标识") as Id;
  }
}
