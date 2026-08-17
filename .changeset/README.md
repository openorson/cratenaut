# 版本发布

Cratenaut 的所有公开包使用同一语义化版本，并由 `Changesets` 统一生成版本与变更日志。

## 日常变更

提交会影响公开包的功能或行为时，执行以下命令并提交生成的变更文件：

```bash
bun run changeset
```

选择受影响的公开包和对应的版本级别。固定版本组会在发布时把全部公开包提升至同一版本，因此一次变更只需要描述实际受影响的包。

仅修改文档、内部开发工具或不影响公开包行为的内容时，不需要创建变更文件。

## 发布流程

发布负责人在发布分支上依次执行：

```bash
bun run release:version
bun run release:verify
bun run release:publish
```

`release:version` 会执行 `changeset version`、同步 CLI 与官方 Crate 源码中的版本声明，并刷新根目录 `bun.lock`。

`release:verify` 会校验统一版本、源码版本声明和锁文件，然后执行完整检查与所有公开包的发布预演。

`release:publish` 在再次验证通过后，按 Core、CLI、官方 Crate 的依赖顺序使用 `bun publish` 发布。需要预发布标签时可传入 `--tag`，例如 `bun run release:publish -- --tag next`。

如果发布在部分包成功后被中断，且没有修改版本或发布内容，执行以下命令恢复同一批次：

```bash
bun run release:resume
```

`release:resume` 会在完整校验后查询 npm 公共注册表。已经存在的同版本包会被跳过，其他包继续发布。不要在修改发布内容后使用该命令，应创建新的版本重新发布。

不要使用 `changeset publish`。该命令会直接调用 `npm publish`，而本仓库的实际打包和发布统一由 `bun publish` 完成。
