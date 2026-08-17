# Multi-server

这个示例展示同一份配置中的本地服务器和 SSH 远程服务器

只规划本地服务器：

```bash
bun run plan:local
```

连接远程服务器前，先配置真实的连接信息：

```bash
export CRATENAUT_EXAMPLE_HOST='server.example.com'
export CRATENAUT_EXAMPLE_USER='deploy'
export CRATENAUT_EXAMPLE_IDENTITY_FILE="$HOME/.ssh/id_ed25519"
bun run plan:remote
```

Cratenaut 不会因为配置中存在多台服务器就默认操作全部目标，参数和交互选择会明确本次命令的范围
