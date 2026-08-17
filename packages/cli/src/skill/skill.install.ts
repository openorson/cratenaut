import { homedir } from "node:os";
import { relative, resolve } from "node:path";
import { readdir, stat } from "node:fs/promises";

import type { ISkillInstallOptions, ISkillInstallPlan, ISkillInstallResult, TSkillTarget } from "./skill.types";

const skillName = "use-cratenaut";
const sourceDirectory = resolve(import.meta.dir, "assets", skillName);
const targetDirectories = {
  codex: { project: [".agents", "skills"], global: [".agents", "skills"] },
  claude: { project: [".claude", "skills"], global: [".claude", "skills"] },
  cursor: { project: [".cursor", "skills"], global: [".cursor", "skills"] },
} as const satisfies Record<TSkillTarget, { readonly project: readonly string[]; readonly global: readonly string[] }>;

/**
 * 解析技能安装目录
 */
export function resolveSkillDirectory(options: ISkillInstallOptions): string {
  const global = options.global === true;
  const base = global ? homedir() : resolve(options.directory ?? process.cwd());
  const segments = targetDirectories[options.target][global ? "global" : "project"];

  return resolve(base, ...segments, skillName);
}

/**
 * 根据项目中已有的智能体目录推断安装目标
 *
 * 仅在能够唯一确定时返回结果
 */
export async function detectSkillTarget(directory = process.cwd()): Promise<TSkillTarget | undefined> {
  const candidates = await Promise.all(
    (Object.keys(targetDirectories) as TSkillTarget[]).map(async (target) => {
      const root = resolve(directory, targetDirectories[target].project[0]);

      try {
        return (await stat(root)).isDirectory() ? target : undefined;
      } catch {
        return undefined;
      }
    }),
  );
  const matches = candidates.filter((target): target is TSkillTarget => target !== undefined);

  return matches.length === 1 ? matches[0] : undefined;
}

/**
 * 检查技能安装动作
 */
export async function inspectSkillInstall(options: ISkillInstallOptions): Promise<ISkillInstallPlan> {
  const path = resolveSkillDirectory(options);
  const sourceFiles = await readFiles(sourceDirectory);
  const action = (await isDirectory(path))
    ? (await matchesSource(path, sourceFiles))
      ? "unchanged"
      : "update"
    : "create";

  return Object.freeze({
    target: options.target,
    path,
    action,
    global: options.global === true,
  });
}

/**
 * 安装技能
 *
 * 更新已有不同内容时，调用方必须先完成覆盖确认
 */
export async function installSkill(options: ISkillInstallOptions, overwrite = false): Promise<ISkillInstallResult> {
  const plan = await inspectSkillInstall(options);

  if (plan.action === "unchanged") {
    return Object.freeze({ ...plan, written: false });
  }

  if (plan.action === "update" && !overwrite) {
    throw new Error(`技能目录“${plan.path}”包含不同内容`);
  }

  const sourceFiles = await readFiles(sourceDirectory);

  for (const [name, content] of sourceFiles) {
    const destination = resolve(plan.path, name);
    await Bun.write(destination, content, { createPath: true });
  }

  return Object.freeze({ ...plan, written: true });
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function readFiles(root: string, directory = root): Promise<ReadonlyMap<string, Uint8Array>> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = new Map<string, Uint8Array>();

  for (const entry of entries) {
    const path = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      const nested = await readFiles(root, path);

      for (const [name, content] of nested) {
        files.set(name, content);
      }
    } else if (entry.isFile()) {
      files.set(relative(root, path), new Uint8Array(await Bun.file(path).arrayBuffer()));
    }
  }

  return files;
}

async function matchesSource(path: string, sourceFiles: ReadonlyMap<string, Uint8Array>): Promise<boolean> {
  for (const [name, content] of sourceFiles) {
    const destination = resolve(path, name);

    if (!(await Bun.file(destination).exists())) {
      return false;
    }

    const actual = new Uint8Array(await Bun.file(destination).arrayBuffer());

    if (!actual.every((value, index) => value === content[index]) || actual.length !== content.length) {
      return false;
    }
  }

  return true;
}
