---
layout: home

hero:
  name: Cratenaut
  text: 把 Docker 部署写成 TypeScript
  tagline: 面向本地与远程服务器，在执行前看清变更，并以幂等方式管理 Docker 工作负载
  image:
    src: /logo.svg
    alt: Cratenaut 品牌标志
  actions:
    - theme: brand
      text: 5 分钟快速开始
      link: /guide/getting-started
    - theme: alt
      text: 了解 Cratenaut
      link: /guide/why-cratenaut
    - theme: alt
      text: 查看 GitHub
      link: https://github.com/openorson/cratenaut

features:
  - title: 类型安全的部署配置
    details: 使用 TypeScript 和 TypeBox，在编辑器里获得完整提示，并在连接服务器前发现无效配置
  - title: 先计划，再执行
    details: 对比期望配置、上次部署状态和服务器实际状态，在执行前说明每一项变更及其风险
  - title: 本地与远程一致
    details: 使用相同配置管理当前计算机和 SSH 服务器，并明确选择本次命令要操作的目标
  - title: 可复用的部署单元
    details: 官方 Crate 开箱即用，自定义 Crate 可随应用项目维护，也可作为独立软件包跨项目复用
  - title: 持久化目录有边界
    details: 项目、服务器和实例拥有稳定目录，数据不会散落在不可预测的位置
  - title: 对 AI 友好且安全
    details: 一条命令安装操作 Skill，让 AI 理解工作流，同时禁止它擅自授权高风险变更
---

<div class="mission-flow">
  <div class="mission-step">
    <span>01 / DEFINE</span>
    <strong>定义</strong>
    <p>用带类型提示的配置描述服务器和部署单元</p>
  </div>
  <div class="mission-step">
    <span>02 / PLAN</span>
    <strong>计划</strong>
    <p>计算配置、历史状态与服务器实际状态的差异</p>
  </div>
  <div class="mission-step">
    <span>03 / DEPLOY</span>
    <strong>部署</strong>
    <p>确认风险后幂等地应用真正需要执行的变更</p>
  </div>
  <div class="mission-step">
    <span>04 / VERIFY</span>
    <strong>验证</strong>
    <p>检查健康状态、日志和可追溯的部署历史</p>
  </div>
</div>

<div class="concept-card">
  <h2>Crate 到底是什么？</h2>
  <p><code>crate</code> 在英语里可以表示货箱，在 Rust 里也表示代码包；在 Cratenaut 中，它有一个明确而具体的含义：<strong>一个可复用的部署单元</strong>。</p>
  <p>例如 PostgreSQL Crate 把数据库镜像、密码文件、数据目录、端口、健康检查和升级风险放在一起。用户只需填写数据库名、密码来源等业务选项，不必在每个项目中重复拼装底层 Docker 参数。</p>
  <p><strong>Cratenaut</strong> 由 <code>crate</code> 与 <code>naut</code> 组合而来。<code>naut</code> 表示航行者：它负责让这些部署单元沿着经过审查的计划，安全抵达目标服务器。</p>
</div>
