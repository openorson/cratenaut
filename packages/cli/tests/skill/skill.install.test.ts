import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { inspectSkillInstall, installSkill, resolveSkillDirectory } from "../../src/skill/skill.install";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("技能安装", () => {
  test("解析项目级目标目录", () => {
    expect(resolveSkillDirectory({ target: "codex", directory: "/workspace/project" })).toBe(
      "/workspace/project/.agents/skills/use-cratenaut",
    );
    expect(resolveSkillDirectory({ target: "claude", directory: "/workspace/project" })).toBe(
      "/workspace/project/.claude/skills/use-cratenaut",
    );
    expect(resolveSkillDirectory({ target: "cursor", directory: "/workspace/project" })).toBe(
      "/workspace/project/.cursor/skills/use-cratenaut",
    );
  });

  test("首次安装后再次检查保持幂等", async () => {
    const directory = await createTemporaryDirectory();
    const options = { target: "codex" as const, directory };

    expect((await inspectSkillInstall(options)).action).toBe("create");

    const result = await installSkill(options);
    expect(result.action).toBe("create");
    expect(result.written).toBe(true);
    expect(await Bun.file(join(result.path, "SKILL.md")).exists()).toBe(true);
    expect((await inspectSkillInstall(options)).action).toBe("unchanged");
  });

  test("不同内容需要确认后才能更新", async () => {
    const directory = await createTemporaryDirectory();
    const options = { target: "cursor" as const, directory };
    const installed = await installSkill(options);

    await Bun.write(join(installed.path, "SKILL.md"), "modified");
    expect((await inspectSkillInstall(options)).action).toBe("update");
    await expect(installSkill(options)).rejects.toThrow("包含不同内容");

    const updated = await installSkill(options, true);
    expect(updated.action).toBe("update");
    expect((await Bun.file(join(updated.path, "SKILL.md")).text()).startsWith("---\nname: use-cratenaut")).toBe(true);
  });
});

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "cratenaut-skill-"));
  temporaryDirectories.push(directory);
  return directory;
}
