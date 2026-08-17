import { defineCommand } from "citty";

import { createOutput } from "../../output/output.instance";

const commandNames = [
  "init",
  "config",
  "doctor",
  "plan",
  "deploy",
  "status",
  "up",
  "down",
  "restart",
  "logs",
  "exec",
  "history",
  "render",
  "secret",
  "skill",
  "ui",
  "completion",
];

/**
 * 生成常用 `Shell` 的静态命令补全脚本
 */
export const completionCommand = defineCommand({
  meta: { name: "completion", description: "生成 Shell 补全脚本" },
  args: {
    shell: {
      type: "positional",
      description: "Shell 类型",
      required: true,
      options: ["bash", "zsh", "fish"],
    },
    plain: { type: "boolean", default: true },
  },
  run: ({ args }) => {
    const commands = commandNames.join(" ");
    const script =
      args.shell === "fish"
        ? commandNames.map((command) => `complete -c naut -f -a ${command}`).join("\n")
        : args.shell === "zsh"
          ? `#compdef naut cratenaut\n_arguments '1:command:(${commands})' '*::arg:->args'`
          : `_naut_complete() { COMPREPLY=( $(compgen -W '${commands}' -- "\${COMP_WORDS[1]}") ); }\ncomplete -F _naut_complete naut cratenaut`;
    createOutput(args).data(script);
  },
});
