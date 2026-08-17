import type { ICrateInstance } from "../crate/crate.types";

/**
 * 本地服务器连接
 */
export interface ILocalServerConnection {
  /**
   * 连接类型
   */
  readonly kind: "local";
}

/**
 * `SSH` 服务器连接
 */
export interface ISshServerConnection {
  /**
   * 连接类型
   */
  readonly kind: "ssh";
  /**
   * 服务器主机名或地址
   */
  readonly host: string;
  /**
   * 登录用户
   */
  readonly user?: string;
  /**
   * `SSH` 端口
   *
   * @defaultValue `22`
   */
  readonly port?: number;
  /**
   * 私钥文件路径
   */
  readonly identityFile?: string;
  /**
   * 跳板机参数
   */
  readonly proxyJump?: string;
  /**
   * 连接超时秒数
   *
   * @defaultValue `10`
   */
  readonly connectTimeout?: number;
}

/**
 * 服务器连接方式
 */
export type TServerConnection = ILocalServerConnection | ISshServerConnection;

/**
 * 服务器定义
 */
export interface IServerDefinition<
  Id extends string = string,
  Crates extends readonly ICrateInstance[] = readonly ICrateInstance[],
> {
  /**
   * 服务器在项目中的唯一标识
   */
  readonly id: Id;
  /**
   * 服务器用途描述
   */
  readonly description?: string;
  /**
   * 连接方式
   */
  readonly connection: TServerConnection;
  /**
   * 服务器上的 `Cratenaut` 管理根目录
   *
   * 远程服务器默认为 `/var/lib/cratenaut`，本地服务器默认为配置目录中的 `.cratenaut/managed`
   */
  readonly root?: string;
  /**
   * 有序的 `Crate` 实例清单
   */
  readonly crates: Crates;
}

/**
 * `Cratenaut` 配置定义器
 */
export interface IDefineConfig {
  <
    const Project extends string = string,
    const Servers extends readonly IServerDefinition[] = readonly IServerDefinition[],
  >(
    definition: IConfigDefinition<Project, Servers>,
  ): IConfig<{ project: Project; servers: Servers }>;
}

/**
 * `Cratenaut` 配置
 */
export interface IConfig<
  Type extends { project: string; servers: readonly IServerDefinition[] } = {
    project: string;
    servers: readonly IServerDefinition[];
  },
> {
  /**
   * 项目标识
   */
  readonly project: Type["project"];
  /**
   * 有序的服务器清单
   */
  readonly servers: Type["servers"];
}

/**
 * `Cratenaut` 配置定义
 */
export interface IConfigDefinition<
  Project extends string = string,
  Servers extends readonly IServerDefinition[] = readonly IServerDefinition[],
> {
  /**
   * 项目标识
   */
  readonly project: Project;
  /**
   * 有序的服务器清单
   */
  readonly servers: Servers;
}
