# 目录与命名

Cratenaut 使用稳定、可预测的目录和 Docker 名称隔离项目、服务器与 Crate 实例

## 配置旁的本地信息

默认配置：

```text
project/
├── naut.config.ts
└── .cratenaut/
    └── managed/
```

`.cratenaut` 保存 Cratenaut 产生的信息，应加入 `.gitignore`

全局配置保持相同的隔离层级：

```text
~/.cratenaut/
├── naut.config.ts
└── .cratenaut/
```

## 服务器管理根目录

| 连接方式 | 默认根目录                      |
| -------- | ------------------------------- |
| 本地     | `<配置目录>/.cratenaut/managed` |
| SSH      | `/var/lib/cratenaut`            |

单台服务器的完整布局：

```text
<root>/
└── projects/<project>/servers/<server>/
    ├── state/
    │   ├── current.json
    │   ├── fingerprint.key
    │   └── history/
    ├── journals/
    ├── locks/
    │   └── deploy
    ├── runtime/
    │   └── deployment/
    ├── backups/
    └── crates/
        └── <crate-instance>/
            ├── data/
            ├── config/
            ├── cache/
            └── runtime/
```

各目录职责：

| 目录                  | 内容                         |
| --------------------- | ---------------------------- |
| `state`               | 当前状态、资源指纹和历史状态 |
| `journals`            | 部署过程记录                 |
| `locks`               | 防止并发部署的锁             |
| `runtime`             | 临时部署运行信息             |
| `backups`             | 预留的标准备份输出位置       |
| `crates/<id>/data`    | 需要长期保留和备份的数据     |
| `crates/<id>/config`  | Crate 生成的配置与敏感文件   |
| `crates/<id>/cache`   | 可以重新生成的缓存           |
| `crates/<id>/runtime` | 套接字、进程状态等运行文件   |

不要把业务数据写入 `config`、`cache` 或 `runtime`。备份工具只可能根据明确的数据语义可靠工作

## Docker 名称

服务器项目网络：

```text
cratenaut-<project>-<server>
```

容器：

```text
cratenaut-<project>-<server>-<crate-instance>-<resource>
```

网络别名：

```text
<crate-instance>-<resource>
```

例如：

```text
项目：commerce
服务器：production
实例：database
容器资源：server

网络：cratenaut-commerce-production
容器：cratenaut-commerce-production-database-server
别名：database-server
```

Docker 镜像名称由具体 Crate 选项决定，Cratenaut 不重命名或重新构建第三方镜像

## 修改标识的影响

修改项目、服务器、实例或资源标识通常会被视为删除旧资源并创建新资源，而不是重命名。对包含持久化数据的实例尤其危险

描述性文字应放入 `description`，不要通过修改稳定标识来表达用途变化
