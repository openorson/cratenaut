# Custom Crate

Cratenaut 没有提供通用的 `app` Crate。用户自己的应用应当拥有一个能准确表达其镜像、文件、端口、持久化数据和变更风险的自定义 Crate

本示例中的 `hello.crate.ts` 定义了一个静态站点部署单元，`naut.config.ts` 创建并部署它的实例

```bash
bun install
bun run plan
bun run deploy
curl http://localhost:8080
```

实际项目可以把 Crate 与应用代码放在一起，也可以发布到 npm、公司私有仓库或 Gitea 包注册表，供多个部署项目复用
