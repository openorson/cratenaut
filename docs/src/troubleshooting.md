# 故障排查

先使用详细模式重现问题：

```bash
naut doctor --all --verbose
naut plan --all --verbose
```

错误信息中的 `CRN_*` 诊断编号可以稳定定位错误类型。报告问题时请保留编号，但应删除主机地址、用户名、文件路径和敏感值

## 找不到配置

Cratenaut 只检查当前目录的 `naut.config.ts`，不会向父目录搜索

```bash
pwd
naut config path
naut config validate
```

不在配置目录时使用 `--config`，或使用 `--global`

## Docker 不可用

本地检查：

```bash
docker version
docker info
```

远程检查：

```bash
ssh deploy@server.example.com docker version
```

如果必须使用 `sudo docker`，应调整服务器 Docker 权限或部署用户，而不是把交互式 `sudo` 隐藏进配置

## SSH 连接失败

使用与配置相同的用户、端口和密钥手工验证：

```bash
ssh -p 22 -i ~/.ssh/id_ed25519 deploy@server.example.com
```

确认主机密钥、跳板机、文件权限和 SSH Agent。Cratenaut 不会绕过 SSH 的主机身份验证

## 端口已被占用

查看占用：

```bash
docker ps --format '{{.Names}}\t{{.Ports}}'
```

修改 Crate 发布端口前先运行 `naut plan`。端口变化通常需要重建容器，属于中断性变更

## 检测到状态漂移

不要立即添加 `--overwrite-drift`。先使用 Docker 和托管目录检查服务器上发生了什么，并与最近部署历史对比：

```bash
naut history --server production
naut status --server production --all
```

只有确认配置是正确来源，且服务器上的手工变化可以覆盖时，才授权覆盖漂移

## 容器不健康

```bash
naut status --crate <id>
naut logs --crate <id> --resource server --tail 200
```

检查镜像架构、挂载文件、环境变量、依赖服务地址和健康检查命令。部署顺序不是服务就绪保证，应用应对短暂连接失败进行重试

## 遗留部署锁

部署锁用于阻止两个部署同时修改相同服务器。出现锁时先确认：

- 没有另一个 `naut deploy` 正在运行
- CI 中没有并发部署任务
- 上一次部署已经结束或异常退出

确认后才可以使用 `naut deploy --force-unlock`

## 获取帮助

仍无法解决时，在 [GitHub Issues](https://github.com/openorson/cratenaut/issues) 提交：

- Cratenaut、Bun、Docker 和操作系统版本
- 诊断编号与已遮蔽敏感信息的完整错误
- 最小配置或可复现示例
- `naut doctor` 与 `naut plan` 的相关输出
