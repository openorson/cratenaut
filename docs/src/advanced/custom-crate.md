# 编写自定义 Crate

当需要部署自己的应用时，不必等待一个通用 `app` Crate。应用最了解自己的镜像、端口、配置文件、数据目录、健康检查和升级约束，因此应当提供一个与应用一起演进的自定义 Crate

## 什么时候需要

以下情况适合编写自定义 Crate：

- 部署公司内部服务或自己开发的应用
- 多个项目需要复用相同的部署规则
- 希望用类型限制应用配置并提供默认值
- 需要准确说明哪些配置会中断服务或破坏数据
- 希望把部署能力发布到 npm、私有注册表或 Gitea 包注册表

如果只是部署 Caddy、Gitea、PostgreSQL 或 Redis，应优先使用官方 Crate

## 完整示例

<<< ../../../examples/custom-crate/hello.crate.ts

配置文件创建这个 Crate 的实例：

<<< ../../../examples/custom-crate/naut.config.ts

## 定义与实例的区别

`defineCrate` 返回的是工厂和部署规则，不会立即创建任何资源：

```ts
export const hello = defineCrate({
  name: "hello",
  version: "1.0.0",
  resources: () => [],
});
```

调用工厂才会创建配置中的实例：

```ts
const website = hello({
  id: "website",
  description: "公司欢迎页",
});
```

一个定义可以在不同服务器或不同项目中创建多个实例

## 使用 TypeBox 描述选项

Cratenaut 从 `optionsSchema` 同时获得：

- TypeScript 静态类型
- 运行时结构校验
- 默认值解码
- 敏感字段位置
- 字段变化的风险规则

推荐使用 `Codec` 把用户填写的简洁输入解码成资源函数需要的完整配置：

```ts
optionsSchema: t.Codec(
  t.Object({
    port: change.disruptive(t.Optional(t.Integer({ minimum: 1, maximum: 65_535 })), { reason: "修改端口会重建容器" }),
  }),
)
  .Decode((options) => ({ port: options.port ?? 8080 }))
  .Encode((options) => options);
```

类型可以复杂，但实例配置应当保持简单。默认值、保留字段和跨字段约束应由 Crate 处理，而不是要求每个用户重复填写

## 声明资源

`resources` 是纯声明函数。它接收已经校验和解码的选项，并返回完整资源数组：

```ts
resources: ({ options, resource }) => [
  resource.file("config", { content: options.content }),
  resource.storage("data"),
  resource.container("server", {
    image: options.image,
    mounts: [
      {
        source: resource.fileRef("config"),
        target: "/app/config.json",
        readOnly: true,
      },
      {
        source: resource.storageRef("data"),
        target: "/app/data",
      },
    ],
  }),
];
```

资源数组就是声明和处理顺序。引用文件、存储或容器时，被引用资源应当先声明

## 资源选择

| 资源                 | 适用场景                                     |
| -------------------- | -------------------------------------------- |
| `resource.file`      | 配置、脚本、证书和敏感信息文件               |
| `resource.directory` | 需要明确目录权限但不属于持久化业务数据的目录 |
| `resource.storage`   | 数据库、上传文件、仓库等需要备份的持久化数据 |
| `resource.container` | 长时间运行的应用进程                         |
| `resource.task`      | 配置校验、数据迁移和可重复的管理命令         |

不要把持久化数据写入容器可写层。需要备份的数据必须通过 `resource.storage` 声明，Cratenaut 才能为它提供稳定目录

## 敏感选项

```ts
password: secret.schema(t.String({ minLength: 12 }));
```

实例配置随后可以传入普通字符串、`secret.env` 或 `secret.file`。资源函数拿到的是解析后的字符串，但不应把它放入命令参数、日志或资源标识

推荐写入权限为 `0600` 的文件，再只读挂载到容器：

```ts
resource.file("password", {
  content: options.password,
  mode: 0o600,
});
```

## 变更风险

每个有运行影响的字段都应使用 `change` 标记：

- `change.safe`：可原地应用或风险可忽略
- `change.disruptive`：会重启、重建或短暂中断服务
- `change.destructive`：可能删除数据或使已有数据不可用
- `change.immutable`：不能通过修改声明安全完成
- `change.unknown`：影响取决于外部程序或自定义值

跨字段风险使用纯函数 `assessChange`：

```ts
assessChange: ({ previousOptions, nextOptions }) => {
  if (previousOptions?.mode !== nextOptions.mode) {
    return {
      risk: "unknown",
      reason: "运行模式变更需要根据应用发布说明判断",
    };
  }
};
```

## 版本

Crate 版本描述的是部署契约，不等同于容器镜像版本。以下变化通常需要提升主版本：

- 删除或重命名选项
- 修改现有选项含义
- 改变持久化数据布局
- 重命名资源，导致已有资源被删除并重新创建
- 改变默认值并可能影响已有实例

同一主版本内能够安全升级时，可以通过 `compatibility.upgradesFrom` 声明允许范围

## 组织与复用方式

自定义 Crate 不要求发布为独立软件包。Cratenaut 只要求配置文件能够通过标准模块导入获得 Crate 工厂，具体如何组织应当由它的使用范围决定

### 在应用项目中维护

只服务于一个应用或一个部署项目时，建议把 Crate 与应用代码放在同一个仓库：

```text
application/
├── deploy/
│   └── application.crate.ts
├── naut.config.ts
└── package.json
```

这种方式让应用代码、容器镜像和部署契约在同一次变更中接受评审，也不需要额外维护软件包版本。配置文件直接使用相对路径导入：

```ts
import { application } from "./deploy/application.crate";
```

### 作为独立软件包维护

当多个项目需要共享同一套部署契约，或者 Crate 由独立团队负责维护时，再考虑提取为独立软件包。软件包可以发布到公开注册表，也可以只存在于组织内部的 npm 兼容注册表

独立软件包应把 `@cratenaut/core` 声明为兼容的对等依赖，避免项目中出现彼此隔离的 Core 运行时实例。包入口保持最小，只暴露使用者创建实例所需的 Crate 工厂和必要类型

版本号描述的是部署契约，而不只是实现代码。发布前应根据实际变化判断是否影响配置字段、资源标识、持久化数据布局或升级流程，并提供与影响程度相匹配的迁移说明和验证记录

Cratenaut 不维护额外的插件注册表或专用下载协议。模块安装和版本解析由项目使用的包管理器完成，Cratenaut 负责校验并执行导入后的部署定义
