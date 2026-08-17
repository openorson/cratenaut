import type { Secret } from "../secret/secret.value";
import type { ContainerResource } from "./container/container.resource";
import type { DirectoryResource } from "./directory/directory.resource";
import type { FileResource } from "./file/file.resource";
import type { StorageResource } from "./storage/storage.resource";
import type { TaskResource } from "./task/task.resource";

/**
 * 可公开保存的文本或不透明秘密值
 */
export type TResourceText = string | Secret<string>;

/**
 * `Cratenaut` 内置资源联合类型
 *
 * 运行时应通过资源的 `kind` 字段进行穷尽判断，不应依赖 `instanceof`
 */
export type TResource = DirectoryResource | FileResource | ContainerResource | StorageResource | TaskResource;

/**
 * 内置资源类型标识
 */
export type TResourceKind = TResource["kind"];
