import { defineCommand } from "citty";

import { diagnostics } from "../../diagnostic/diagnostic.catalog";
import { createOutput } from "../../output/output.instance";
import { detectSkillTarget, inspectSkillInstall, installSkill } from "../../skill/skill.install";
import type { TSkillTarget } from "../../skill/skill.types";

/**
 * 安装 `Cratenaut` 智能体技能
 */
export const skillCommand = defineCommand({
  meta: { name: "skill", description: "安装 Cratenaut AI Skill" },
  args: {
    target: {
      type: "enum",
      options: ["codex", "claude", "cursor"],
      description: "目标智能体",
    },
    global: {
      type: "boolean",
      alias: "g",
      description: "安装到用户级技能目录",
    },
    directory: {
      type: "string",
      alias: "d",
      description: "项目级安装的目标目录",
      valueHint: "path",
    },
    force: {
      type: "boolean",
      description: "覆盖已有的不同技能内容",
    },
    "dry-run": {
      type: "boolean",
      description: "只显示安装计划，不写入文件",
    },
    json: { type: "boolean", description: "输出 JSON" },
    plain: { type: "boolean", description: "禁用交互和 ANSI 样式" },
    verbose: { type: "boolean", alias: "v", description: "输出详细错误堆栈" },
  },
  run: async ({ args }) => {
    const output = createOutput(args);

    if (args.global === true && args.directory !== undefined) {
      throw diagnostics.CRN_CLI_6002();
    }

    const directory = args.directory ?? process.cwd();
    const detectedTarget = await detectSkillTarget(directory);
    const target =
      args.target === undefined
        ? output.mode === "interactive"
          ? await output.select<TSkillTarget>(
              "选择要安装 Cratenaut Skill 的智能体",
              [
                { value: "codex", label: "Codex", hint: ".agents/skills" },
                { value: "claude", label: "Claude Code", hint: ".claude/skills" },
                { value: "cursor", label: "Cursor", hint: ".cursor/skills" },
              ],
              detectedTarget ?? "codex",
            )
          : undefined
        : (args.target as TSkillTarget);

    if (target === undefined) {
      throw diagnostics.CRN_CLI_1004();
    }

    const options = {
      target,
      global: args.global,
      directory,
    };
    const plan = await inspectSkillInstall(options);

    if (args["dry-run"] === true) {
      output.data({ ...plan, dryRun: true });
      return;
    }

    let overwrite = args.force === true;

    if (plan.action === "update" && !overwrite) {
      if (output.mode !== "interactive") {
        throw diagnostics.CRN_CLI_6001({ path: plan.path });
      }

      overwrite = await output.confirm(`技能目录“${plan.path}”已经存在不同内容，是否更新`, false);

      if (!overwrite) {
        throw diagnostics.CRN_CLI_9001();
      }
    }

    output.intro("安装 Cratenaut AI Skill");
    const result = await installSkill(options, overwrite);

    if (result.action === "unchanged") {
      output.success(`技能已经是最新版本：${result.path}`);
    } else {
      output.success(`${result.action === "create" ? "已安装" : "已更新"}技能：${result.path}`);
    }

    output.outro("AI 助手现在可以按照 Cratenaut 的安全工作流帮助管理部署");
  },
});
