import { defineConfig } from "vitepress";

export default defineConfig({
  srcDir: "src",
  base: "/cratenaut/",
  title: "Cratenaut",
  description: "用 TypeScript 定义、审查并部署本地与远程服务器上的 Docker 工作负载",
  lang: "zh-CN",
  appearance: false,
  lastUpdated: true,
  cleanUrls: true,
  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: "/cratenaut/favicon.svg" }],
    ["meta", { name: "theme-color", content: "#ffd83d" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:title", content: "Cratenaut" }],
    [
      "meta",
      {
        property: "og:description",
        content: "用 TypeScript 定义，用计划审查，用信心部署",
      },
    ],
  ],
  themeConfig: {
    logo: { src: "/logo.svg", alt: "Cratenaut" },
    siteTitle: "Cratenaut",
    outline: { level: [2, 3], label: "本页内容" },
    docFooter: { prev: "上一页", next: "下一页" },
    lastUpdatedText: "最后更新",
    sidebarMenuLabel: "目录",
    returnToTopLabel: "返回顶部",
    langMenuLabel: "语言",
    editLink: {
      pattern: "https://github.com/openorson/cratenaut/edit/main/docs/src/:path",
      text: "在 GitHub 上改进此页",
    },
    footer: {
      message: "以 MIT 许可证发布",
      copyright: "Copyright © 2026 openorson",
    },
    search: { provider: "local" },
    socialLinks: [{ icon: "github", link: "https://github.com/openorson/cratenaut" }],
    nav: [
      { text: "指南", link: "/guide/getting-started" },
      { text: "官方 Crates", link: "/crates/" },
      { text: "自定义 Crate", link: "/advanced/custom-crate" },
      { text: "CLI", link: "/reference/cli" },
      { text: "AI Skill", link: "/ai/skill" },
      { text: "故障排查", link: "/troubleshooting" },
    ],
    sidebar: {
      "/guide/": [
        {
          text: "开始使用",
          items: [
            { text: "了解 Cratenaut", link: "/guide/why-cratenaut" },
            { text: "快速开始", link: "/guide/getting-started" },
            { text: "核心概念", link: "/guide/concepts" },
            { text: "配置项目与服务器", link: "/guide/configuration" },
          ],
        },
        {
          text: "部署",
          items: [
            { text: "计划与部署", link: "/guide/deployment" },
            { text: "远程与多服务器", link: "/guide/remote" },
            { text: "安全变更与状态漂移", link: "/guide/safety" },
            { text: "敏感信息", link: "/guide/secrets" },
          ],
        },
      ],
      "/crates/": [
        {
          text: "官方 Crates",
          items: [
            { text: "概览", link: "/crates/" },
            { text: "Caddy", link: "/crates/caddy" },
            { text: "Gitea", link: "/crates/gitea" },
            { text: "PostgreSQL", link: "/crates/postgres" },
            { text: "Redis", link: "/crates/redis" },
          ],
        },
      ],
      "/advanced/": [
        {
          text: "高级用法",
          items: [{ text: "编写自定义 Crate", link: "/advanced/custom-crate" }],
        },
      ],
      "/reference/": [
        {
          text: "参考",
          items: [
            { text: "CLI 命令", link: "/reference/cli" },
            { text: "目录与命名", link: "/reference/layout" },
          ],
        },
      ],
      "/ai/": [
        {
          text: "AI 助手",
          items: [{ text: "安装 Cratenaut Skill", link: "/ai/skill" }],
        },
      ],
    },
  },
});
