# Basic

这个示例在当前计算机上部署一个 Caddy 容器，并通过 `8080` 端口返回欢迎文本

## 运行

确保已经安装 Bun 和 Docker，并且 Docker 正在运行

```bash
bun install
bun run plan
bun run deploy
curl http://localhost:8080
```

预期输出：

```text
Cratenaut is ready
```

查看状态或停止容器：

```bash
bun run status
bun run down
```

Cratenaut 会在本示例目录的 `.cratenaut` 中保存本地托管数据和部署状态，该目录不应提交到版本控制
