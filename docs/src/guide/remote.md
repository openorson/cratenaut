# 远程与多服务器

一份配置可以包含多台本地或 SSH 服务器，但每次命令都应明确本次操作范围

## 完整示例

<<< ../../../examples/multi-server/naut.config.ts

## SSH 前置条件

远程服务器需要：

- 已安装并运行 Docker
- 登录用户能够执行 Docker 命令
- 登录用户能够读写 Cratenaut 管理根目录
- 客户端能够通过非交互 SSH 连接

先在终端验证连接：

```bash
ssh deploy@server.example.com docker version
```

然后执行：

```bash
naut doctor --server production --all
naut plan --server production --all
```

## 不依赖当前目录的全局配置

需要从任意位置管理一组固定服务器时，可以使用：

```bash
naut init --global
naut plan --global
```

全局模式不会改变服务器目录规范，只改变本地配置与本地元数据的查找位置

## 分开配置也是合理选择

多台服务器不必写在同一个配置文件中。如果环境由不同团队管理、权限边界不同，或者发布周期互不相关，使用多个配置项目通常更清晰：

```bash
naut plan --config ./deploy/staging.config.ts --all
naut plan --config ./deploy/production.config.ts --all
```

Cratenaut 不要求所有服务或服务器组成一个全局依赖图
