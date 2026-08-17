import { defineCommand, runCommand, showUsage } from "citty";

import { completionCommand } from "../commands/completion/completion.command";
import { configCommand } from "../commands/config/config.command";
import { deployCommand } from "../commands/deploy/deploy.command";
import { doctorCommand } from "../commands/doctor/doctor.command";
import { downCommand } from "../commands/down/down.command";
import { execCommand } from "../commands/exec/exec.command";
import { historyCommand } from "../commands/history/history.command";
import { initCommand } from "../commands/init/init.command";
import { logsCommand } from "../commands/logs/logs.command";
import { planCommand } from "../commands/plan/plan.command";
import { renderCommand } from "../commands/render/render.command";
import { restartCommand } from "../commands/restart/restart.command";
import { secretCommand } from "../commands/secret/secret.command";
import { skillCommand } from "../commands/skill/skill.command";
import { statusCommand } from "../commands/status/status.command";
import { uiCommand } from "../commands/ui/ui.command";
import { upCommand } from "../commands/up/up.command";

/**
 * `Cratenaut` 命令行入口
 */
export const mainCommand = defineCommand({
  meta: {
    name: "naut",
    version: "0.1.0",
    description: "声明式、多服务器、可审查的 Docker 部署工具",
  },
  subCommands: {
    init: initCommand,
    config: configCommand,
    doctor: doctorCommand,
    plan: planCommand,
    deploy: deployCommand,
    status: statusCommand,
    up: upCommand,
    down: downCommand,
    restart: restartCommand,
    logs: logsCommand,
    exec: execCommand,
    history: historyCommand,
    render: renderCommand,
    secret: secretCommand,
    skill: skillCommand,
    ui: uiCommand,
    completion: completionCommand,
  },
});

/**
 * 运行命令并把异常交给统一诊断层
 */
export async function runCli(rawArgs: readonly string[]): Promise<void> {
  if (rawArgs.length === 0) {
    await showUsage(mainCommand);
    return;
  }

  const separator = rawArgs.indexOf("--");
  const cliArgs = separator === -1 ? rawArgs : rawArgs.slice(0, separator);

  if (cliArgs.includes("--version")) {
    console.log("0.0.1");
    return;
  }

  if (cliArgs.includes("--help") || cliArgs.includes("-h")) {
    let command = mainCommand;
    let parent: typeof mainCommand | undefined;

    for (const value of cliArgs) {
      if (value.startsWith("-")) {
        continue;
      }

      const commands = command.subCommands as Readonly<Record<string, typeof mainCommand>> | undefined;
      const child = commands?.[value];

      if (child === undefined) {
        break;
      }

      parent = command;
      command = child;
    }

    await showUsage(command, parent);
    return;
  }

  await runCommand(mainCommand, { rawArgs: [...rawArgs] });
}
