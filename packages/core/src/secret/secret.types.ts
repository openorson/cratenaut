import type { StaticDecode, TCodec, TRefineAdd, TString, TUnion, TUnsafe } from "typebox";

import type { Secret } from "./secret.value";

/**
 * 直接值秘密来源
 */
export interface ISecretValueSource<Value extends string = string> {
  readonly kind: "value";
  readonly value: Value;
}

/**
 * 环境变量秘密来源
 */
export interface ISecretEnvironmentSource {
  readonly kind: "environment";
  readonly name: string;
}

/**
 * 文件秘密来源
 */
export interface ISecretFileSource {
  readonly kind: "file";
  readonly path: string;
}

/**
 * 秘密来源联合类型
 */
export type TSecretSource<Value extends string = string> =
  ISecretValueSource<Value> | ISecretEnvironmentSource | ISecretFileSource;

/**
 * 秘密信封的密钥派生信息
 */
export interface ISecretKeyDerivation {
  /**
   * 密钥派生算法
   */
  readonly algorithm: "scrypt";
  /**
   * 计算成本参数
   */
  readonly cost: number;
  /**
   * 块大小参数
   */
  readonly blockSize: number;
  /**
   * 并行参数
   */
  readonly parallelization: number;
  /**
   * 使用 `Base64URL` 表示的随机盐
   */
  readonly salt: string;
}

/**
 * 秘密信封的对称加密信息
 */
export interface ISecretCipher {
  /**
   * 对称加密算法
   */
  readonly algorithm: "aes-256-gcm";
  /**
   * 使用 `Base64URL` 表示的随机初始化向量
   */
  readonly iv: string;
  /**
   * 使用 `Base64URL` 表示的完整性验证标签
   */
  readonly authTag: string;
}

/**
 * 加密秘密信封
 */
export interface ISecretEnvelope {
  /**
   * 信封版本
   */
  readonly version: 1;
  /**
   * 密钥派生信息
   */
  readonly keyDerivation: ISecretKeyDerivation;
  /**
   * 对称加密信息
   */
  readonly cipher: ISecretCipher;
  /**
   * 使用 `Base64URL` 表示的密文
   */
  readonly ciphertext: string;
}

/**
 * 秘密解析器的同步或异步返回值
 */
export type TMaybePromise<Value> = Value | PromiseLike<Value>;

/**
 * 秘密解析器
 *
 * `@cratenaut/core` 不直接读取进程环境、文件系统或执行解密
 *
 * 这些能力由 `CLI` 运行时按当前执行环境注入
 */
export interface ISecretResolver {
  /**
   * 读取环境变量
   */
  readonly environment: (name: string) => TMaybePromise<string | undefined>;
  /**
   * 读取文本文件
   */
  readonly file: (path: string) => TMaybePromise<string>;
  /**
   * 解密加密信封
   *
   * 仅当输入值确实是加密信封时才会调用
   */
  readonly decrypt?: (envelope: ISecretEnvelope) => TMaybePromise<string>;
}

/**
 * 仅接受不透明秘密对象的 `TypeBox` 类型
 */
export type TSecretValueSchema = TRefineAdd<TUnsafe<Secret<string>>>;

/**
 * 编码阶段接受普通字符串或不透明秘密对象、解码阶段返回字符串的
 * `TypeBox Codec`
 */
export type TSecretSchema<Schema extends TString = TString> = TCodec<
  TUnion<[Schema, TSecretValueSchema]>,
  StaticDecode<Schema>
>;
