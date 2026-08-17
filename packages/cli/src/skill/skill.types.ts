/**
 * 支持的智能体目标
 */
export type TSkillTarget = "codex" | "claude" | "cursor";

/**
 * 技能安装动作
 */
export type TSkillInstallAction = "create" | "update" | "unchanged";

/**
 * 技能安装选项
 */
export interface ISkillInstallOptions {
  /**
   * 目标智能体
   */
  readonly target: TSkillTarget;
  /**
   * 是否安装到用户级目录
   */
  readonly global?: boolean;
  /**
   * 项目级安装的目标项目目录
   */
  readonly directory?: string;
}

/**
 * 技能安装计划
 */
export interface ISkillInstallPlan {
  /**
   * 目标智能体
   */
  readonly target: TSkillTarget;
  /**
   * 技能目标目录
   */
  readonly path: string;
  /**
   * 预计安装动作
   */
  readonly action: TSkillInstallAction;
  /**
   * 是否为用户级安装
   */
  readonly global: boolean;
}

/**
 * 技能安装结果
 */
export interface ISkillInstallResult extends ISkillInstallPlan {
  /**
   * 是否实际写入文件
   */
  readonly written: boolean;
}
