import { resolve } from "node:path";

/**
 * 统一执行 Cratenaut 的版本同步、校验与发布流程
 */
class Release {
  private readonly rootDirectory = resolve(import.meta.dir, "..");

  /**
   * 按依赖顺序排列的公开包
   */
  private readonly packages = [
    {
      name: "@cratenaut/core",
      directory: "packages/core",
      sourcePath: undefined,
    },
    {
      name: "@cratenaut/cli",
      directory: "packages/cli",
      sourcePath: "packages/cli/src/main/main.command.ts",
    },
    {
      name: "@cratenaut/caddy",
      directory: "packages/crates/caddy",
      sourcePath: "packages/crates/caddy/src/caddy.crate.ts",
    },
    {
      name: "@cratenaut/gitea",
      directory: "packages/crates/gitea",
      sourcePath: "packages/crates/gitea/src/gitea.crate.ts",
    },
    {
      name: "@cratenaut/postgres",
      directory: "packages/crates/postgres",
      sourcePath: "packages/crates/postgres/src/postgres.crate.ts",
    },
    {
      name: "@cratenaut/redis",
      directory: "packages/crates/redis",
      sourcePath: "packages/crates/redis/src/redis.crate.ts",
    },
  ] as const;

  /**
   * 根据动作参数执行发布流程
   */
  async execute(): Promise<void> {
    const [action, ...arguments_] = Bun.argv.slice(2);

    switch (action) {
      case "version":
        await this.version();
        return;
      case "sync":
        await this.sync();
        return;
      case "verify":
        await this.verify();
        return;
      case "pack":
        await this.pack();
        return;
      case "publish":
        await this.publish(arguments_);
        return;
      case "resume":
        await this.resume(arguments_);
        return;
      case "tag":
        await this.tag();
        return;
      default:
        throw new Error("请指定 version、sync、verify、pack、publish、resume 或 tag 动作");
    }
  }

  /**
   * 应用变更记录并生成可发布版本
   */
  private async version(): Promise<void> {
    if (!(await this.hasPendingChangesets())) {
      console.log("没有待发布的 Changeset，已跳过版本生成");
      return;
    }

    await this.run(["bun", "run", "changeset", "version"]);
    const version = await this.synchronizeSourceVersions();
    await this.run(["bun", "install", "--lockfile-only", "--ignore-scripts"]);
    console.log(`已生成 Cratenaut ${version} 的版本与变更日志`);
  }

  /**
   * 同步源码版本声明并刷新锁文件
   */
  private async sync(): Promise<void> {
    const version = await this.synchronizeSourceVersions();
    await this.run(["bun", "install", "--lockfile-only", "--ignore-scripts"]);
    console.log(`已同步 Cratenaut 公开包版本 ${version}`);
  }

  /**
   * 校验版本、锁文件、工作区质量与发布内容
   */
  private async verify(): Promise<void> {
    const version = await this.assertSourceVersions();
    await this.run(["bun", "install", "--frozen-lockfile", "--ignore-scripts"]);
    await this.run(["bun", "run", "check"]);
    await this.pack();
    console.log(`已完成 Cratenaut ${version} 的发布校验`);
  }

  /**
   * 使用 `bun publish --dry-run` 检查全部公开包
   */
  private async pack(): Promise<void> {
    const version = await this.assertSourceVersions();

    for (const releasePackage of this.packages) {
      await this.run(["bun", "publish", "--dry-run"], {
        cwd: resolve(this.rootDirectory, releasePackage.directory),
      });
    }

    console.log(`已完成 Cratenaut ${version} 的发布内容预演`);
  }

  /**
   * 通过 `Bun` 发布已经完整校验的公开包
   */
  private async publish(arguments_: readonly string[]): Promise<void> {
    const publishArguments = this.parsePublishArguments(arguments_);
    const version = await this.assertSourceVersions();

    await this.assertCleanGitWorktree();
    await this.verify();

    for (const releasePackage of this.packages) {
      await this.run(["bun", "publish", ...publishArguments], {
        cwd: resolve(this.rootDirectory, releasePackage.directory),
      });
    }

    await this.createAndPushVersionTag(version);
    console.log(`已发布并标记 Cratenaut ${version}`);
  }

  /**
   * 恢复同一版本未完成的发布批次
   *
   * 仅用于已经有部分包成功发布，且包版本与发布内容均未改变的情况
   *
   * 已存在的同版本包会被跳过，未发布包才会调用 `bun publish`
   */
  private async resume(arguments_: readonly string[]): Promise<void> {
    const publishArguments = this.parsePublishArguments(arguments_);
    const version = await this.assertSourceVersions();

    await this.assertCleanGitWorktree();
    await this.verify();

    for (const releasePackage of this.packages) {
      const published = await this.isPackagePublished(releasePackage.name, version);

      if (published) {
        console.log(`已跳过已发布的包：${releasePackage.name}@${version}`);
        continue;
      }

      await this.run(["bun", "publish", ...publishArguments], {
        cwd: resolve(this.rootDirectory, releasePackage.directory),
      });
    }

    await this.createAndPushVersionTag(version);
    console.log(`已恢复发布并标记 Cratenaut ${version}`);
  }

  /**
   * 为当前统一版本创建并推送 `Git` 发布标签
   *
   * 用于发布完成后补做标签，或恢复因标签推送中断的发布批次
   */
  private async tag(): Promise<void> {
    const version = await this.assertSourceVersions();

    await this.assertCleanGitWorktree();
    await this.createAndPushVersionTag(version);
    console.log(`已创建并推送 Cratenaut ${version} 的发布标签`);
  }

  /**
   * 为已提交的发布版本创建并推送统一 `Git` 标签
   */
  private async createAndPushVersionTag(version: string): Promise<void> {
    const tagName = `v${version}`;
    const hasLocalTag = await this.hasLocalGitTag(tagName);

    if (hasLocalTag) {
      await this.assertVersionTagPointsToHead(tagName);
    }

    if (!hasLocalTag && (await this.hasRemoteGitTag(tagName))) {
      throw new Error(`远程已存在 ${tagName}，但本地没有该标签。请先检查标签指向后再恢复`);
    }

    if (!hasLocalTag) {
      await this.run(["git", "tag", "--annotate", tagName, "--message", `Release ${tagName}`]);
      console.log(`已创建发布标签：${tagName}`);
    }

    await this.run(["git", "push", "origin", tagName]);
    console.log(`已推送发布标签：${tagName}`);
  }

  /**
   * 从 npm 公共注册表检查指定版本是否已经发布
   */
  private async isPackagePublished(packageName: string, version: string): Promise<boolean> {
    const packagePath = encodeURIComponent(packageName);
    const versionPath = encodeURIComponent(version);
    const response = await fetch(`https://registry.npmjs.org/${packagePath}/${versionPath}`);

    if (response.status === 404) {
      return false;
    }

    if (!response.ok) {
      throw new Error(`无法检查 npm 包版本 ${packageName}@${version}：${response.status} ${response.statusText}`);
    }

    return true;
  }

  /**
   * 确保当前工作区没有尚未提交的发布内容
   *
   * 发布标签必须指向包含版本与变更日志的提交
   */
  private async assertCleanGitWorktree(): Promise<void> {
    const status = await this.readCommandOutput(["git", "status", "--porcelain"]);

    if (status.length > 0) {
      throw new Error("Git 工作区存在未提交的变更。请先提交版本与变更日志，再执行发布或打标签");
    }
  }

  /**
   * 判断本地是否存在指定发布标签
   */
  private async hasLocalGitTag(tagName: string): Promise<boolean> {
    const exitCode = await this.getCommandExitCode(["git", "show-ref", "--verify", "--quiet", `refs/tags/${tagName}`]);

    if (exitCode === 0) {
      return true;
    }

    if (exitCode === 1) {
      return false;
    }

    throw new Error(`无法检查本地 Git 标签 ${tagName}（退出码 ${exitCode}）`);
  }

  /**
   * 判断远程仓库是否存在指定发布标签
   */
  private async hasRemoteGitTag(tagName: string): Promise<boolean> {
    const exitCode = await this.getCommandExitCode([
      "git",
      "ls-remote",
      "--exit-code",
      "--tags",
      "--refs",
      "origin",
      `refs/tags/${tagName}`,
    ]);

    if (exitCode === 0) {
      return true;
    }

    if (exitCode === 2) {
      return false;
    }

    throw new Error(`无法检查远程 Git 标签 ${tagName}（退出码 ${exitCode}）`);
  }

  /**
   * 确保已有发布标签正好指向当前提交
   */
  private async assertVersionTagPointsToHead(tagName: string): Promise<void> {
    const [headCommit, taggedCommit] = await Promise.all([
      this.readCommandOutput(["git", "rev-parse", "HEAD"]),
      this.readCommandOutput(["git", "rev-list", "-n", "1", tagName]),
    ]);

    if (headCommit !== taggedCommit) {
      throw new Error(`本地标签 ${tagName} 没有指向当前提交，拒绝继续发布`);
    }
  }

  /**
   * 读取并验证所有公开包的统一版本
   */
  private async readVersion(): Promise<string> {
    const versions = await Promise.all(
      this.packages.map(async (releasePackage) => {
        const manifestPath = resolve(this.rootDirectory, releasePackage.directory, "package.json");
        const manifest = (await Bun.file(manifestPath).json()) as {
          readonly name?: unknown;
          readonly version?: unknown;
        };

        if (manifest.name !== releasePackage.name) {
          throw new Error(`包清单名称不匹配：${manifestPath}`);
        }

        if (typeof manifest.version !== "string" || manifest.version.length === 0) {
          throw new Error(`包清单缺少有效版本：${manifestPath}`);
        }

        return manifest.version;
      }),
    );
    const uniqueVersions = [...new Set(versions)];
    const [version] = uniqueVersions;

    if (uniqueVersions.length !== 1 || version === undefined) {
      throw new Error(`公开包版本必须一致，当前版本为：${versions.join(", ")}`);
    }

    return version;
  }

  /**
   * 将包清单版本同步至 CLI 与官方 Crate 定义
   */
  private async synchronizeSourceVersions(): Promise<string> {
    const version = await this.readVersion();

    await Promise.all(
      this.packages.map(async (releasePackage) => {
        if (releasePackage.sourcePath === undefined) {
          return;
        }

        const sourcePath = resolve(this.rootDirectory, releasePackage.sourcePath);
        const source = await Bun.file(sourcePath).text();
        const pattern = this.createSourceVersionPattern(releasePackage.sourcePath);
        const matches = [...source.matchAll(pattern)];

        if (matches.length !== 1) {
          throw new Error(`无法确定唯一的源码版本声明：${sourcePath}`);
        }

        const nextSource = source.replace(pattern, `$1"${version}"`);

        if (nextSource !== source) {
          await Bun.write(sourcePath, nextSource);
        }
      }),
    );

    return version;
  }

  /**
   * 校验 CLI 与官方 Crate 的源码版本声明
   */
  private async assertSourceVersions(): Promise<string> {
    const version = await this.readVersion();

    await Promise.all(
      this.packages.map(async (releasePackage) => {
        if (releasePackage.sourcePath === undefined) {
          return;
        }

        const sourcePath = resolve(this.rootDirectory, releasePackage.sourcePath);
        const source = await Bun.file(sourcePath).text();
        const matches = [...source.matchAll(this.createSourceVersionPattern(releasePackage.sourcePath))];

        if (matches.length !== 1) {
          throw new Error(`无法确定唯一的源码版本声明：${sourcePath}`);
        }
        const [match] = matches;

        if (match === undefined || match[2] === undefined) {
          throw new Error(`无法读取源码版本声明：${sourcePath}`);
        }

        if (match[2] !== version) {
          throw new Error(`源码版本与包清单不一致：${sourcePath}（${match[2]} ≠ ${version}）`);
        }
      }),
    );

    return version;
  }

  /**
   * 解析可透传给 `bun publish` 的预发布标签
   */
  private parsePublishArguments(arguments_: readonly string[]): readonly string[] {
    const [option, tag] = arguments_;

    if (arguments_.length === 0) {
      return [];
    }

    if (arguments_.length === 2 && option === "--tag" && tag !== undefined && tag.length > 0) {
      return arguments_;
    }

    throw new Error("仅支持 --tag <标签> 参数，认证信息请使用 Bun 的交互式认证或 NPM_CONFIG_TOKEN");
  }

  /**
   * 判断是否存在由贡献者创建的待发布变更记录
   */
  private async hasPendingChangesets(): Promise<boolean> {
    const changesetDirectory = resolve(this.rootDirectory, ".changeset");

    for await (const fileName of new Bun.Glob("*.md").scan({ cwd: changesetDirectory, onlyFiles: true })) {
      if (fileName !== "README.md") {
        return true;
      }
    }

    return false;
  }

  /**
   * 创建与版本声明位置严格对应的匹配表达式
   */
  private createSourceVersionPattern(sourcePath: string): RegExp {
    if (sourcePath.endsWith("main.command.ts")) {
      return /(meta:\s*\{\s*name:\s*"naut",\s*version:\s*)"([^"]+)"/gu;
    }

    return /(defineCrate\(\{\s*name:\s*"[^"]+",\s*version:\s*)"([^"]+)"/gu;
  }

  /**
   * 读取必须成功的命令标准输出
   */
  private async readCommandOutput(command: readonly string[]): Promise<string> {
    const child = Bun.spawn([...command], {
      cwd: this.rootDirectory,
      stdout: "pipe",
      stderr: "pipe",
    });
    const [exitCode, output, errorOutput] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);

    if (exitCode !== 0) {
      throw new Error(`读取发布命令输出失败（退出码 ${exitCode}）：${command.join(" ")}\n${errorOutput.trim()}`);
    }

    return output.trim();
  }

  /**
   * 获取命令退出码并忽略其输出
   */
  private async getCommandExitCode(command: readonly string[]): Promise<number> {
    const child = Bun.spawn([...command], {
      cwd: this.rootDirectory,
      stdout: "ignore",
      stderr: "ignore",
    });

    return child.exited;
  }

  /**
   * 运行必须成功的发布子进程
   */
  private async run(command: readonly string[], options: Readonly<{ cwd?: string }> = {}): Promise<void> {
    const child = Bun.spawn([...command], {
      cwd: options.cwd ?? this.rootDirectory,
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });
    const exitCode = await child.exited;

    if (exitCode !== 0) {
      throw new Error(`发布命令执行失败（退出码 ${exitCode}）：${command.join(" ")}`);
    }
  }
}

await new Release().execute();
