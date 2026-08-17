import { ContainerResource } from "./container/container.resource";
import type { IContainerReference, IContainerResourceOptions } from "./container/container.types";
import { validateIdentifier } from "../identifier/identifier.validate";
import { DirectoryResource } from "./directory/directory.resource";
import type { IDirectoryResourceOptions } from "./directory/directory.types";
import { FileResource } from "./file/file.resource";
import type { IFileReference, IFileResourceOptions } from "./file/file.types";
import { StorageResource } from "./storage/storage.resource";
import type { IStorageReference, IStorageResourceOptions } from "./storage/storage.types";
import { TaskResource } from "./task/task.resource";
import type { ITaskResourceOptions } from "./task/task.types";

/**
 * 资源声明上下文
 *
 * 上下文提供创建资源描述的统一入口，但不收集资源，也不决定执行顺序
 *
 * `Crate` 返回的资源数组仍然是资源清单和声明顺序的唯一来源
 */
export class ResourceContext {
  /**
   * 创建目录资源
   */
  public directory<const Id extends string>(id: Id, options: IDirectoryResourceOptions): DirectoryResource<Id> {
    return new DirectoryResource(id, options);
  }

  /**
   * 创建文件资源
   */
  public file<const Id extends string>(id: Id, options: IFileResourceOptions): FileResource<Id> {
    return new FileResource(id, options);
  }

  /**
   * 引用当前 `Crate` 内较早声明的文件资源
   */
  public fileRef<const Id extends string>(id: Id): IFileReference<Id> {
    return Object.freeze({ kind: "file", id: validateIdentifier(id, "文件引用标识") as Id });
  }

  /**
   * 创建容器资源
   */
  public container<const Id extends string>(id: Id, options: IContainerResourceOptions): ContainerResource<Id> {
    return new ContainerResource(id, options);
  }

  /**
   * 引用当前 `Crate` 内较早声明的容器资源
   */
  public containerRef<const Id extends string>(id: Id): IContainerReference<Id> {
    return Object.freeze({ kind: "container", id: validateIdentifier(id, "容器引用标识") as Id });
  }

  /**
   * 创建持久化存储资源
   */
  public storage<const Id extends string>(id: Id, options: IStorageResourceOptions = {}): StorageResource<Id> {
    return new StorageResource(id, options);
  }

  /**
   * 引用当前 `Crate` 内较早声明的持久化存储资源
   */
  public storageRef<const Id extends string>(id: Id): IStorageReference<Id> {
    return Object.freeze({ kind: "storage", id: validateIdentifier(id, "存储引用标识") as Id });
  }

  /**
   * 创建任务资源
   */
  public task<const Id extends string>(id: Id, options: ITaskResourceOptions): TaskResource<Id> {
    return new TaskResource(id, options);
  }
}
