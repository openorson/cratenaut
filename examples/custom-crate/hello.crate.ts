import { change, defineCrate, t } from "@cratenaut/core";

/**
 * 部署一个由 `Nginx` 提供的静态欢迎页面
 *
 * 这就是一个自定义 `Crate`：它把用户选项转换为 `Cratenaut` 能够管理的文件和容器资源
 */
export const hello = defineCrate({
  name: "hello",
  version: "1.0.0",
  optionsSchema: t
    .Codec(
      t.Object(
        {
          message: change.safe(t.String({ minLength: 1 }), {
            reason: "欢迎文本可以通过替换托管文件更新",
          }),
          port: change.disruptive(t.Optional(t.Integer({ minimum: 1, maximum: 65_535 })), {
            reason: "修改发布端口会重建容器",
          }),
        },
        { additionalProperties: false },
      ),
    )
    .Decode((options) => ({ ...options, port: options.port ?? 8080 }))
    .Encode((options) => options),

  resources: ({ options, resource }) => [
    resource.file("index", {
      content: `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>Cratenaut</title><h1>${options.message}</h1></html>\n`,
      mode: 0o644,
    }),
    resource.container("server", {
      image: "nginx:1.29-alpine",
      mounts: [
        {
          source: resource.fileRef("index"),
          target: "/usr/share/nginx/html/index.html",
          readOnly: true,
        },
      ],
      ports: [{ container: 80, host: options.port }],
      healthcheck: {
        command: "wget --quiet --spider http://127.0.0.1/",
        interval: "10s",
        timeout: "5s",
        retries: 5,
      },
    }),
  ],
});
