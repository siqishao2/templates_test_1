# 模板注册表

会话工作区的应用脚手架模板。整个目录在沙箱镜像构建时被拷入
`/opt/jizao/templates/`（见 `deploy/grand-escape-sandbox/Dockerfile`），
运行期由 API 侧 `TemplateService` 经沙箱内本地拷贝灌入空工作区——
API 自身不持有模板文件。

## 目录约定（每模板一个子目录）

```
<name>/
├── template.json   # manifest：面向 LLM 的描述、版本、生命周期命令声明
│                   #   （模板身份即目录名；每个字段都须有具名消费者）
└── files/          # 模板内容的唯一事实源，init 时整体拷入工作区根
```

（镜像内额外有 `<name>/.cache/node_modules`，由镜像构建期的 warmup 生成，
不入库。）

## 维护约定

模板是手工策展的平台资产，`files/` 直接编辑：

- **改动后必须保持 `files/bun.lock` 与 `files/package.json` 一致**
  （在 `files/` 内运行 `bun install` 再提交），否则镜像 warmup 的
  `bun install --frozen-lockfile` 会构建失败。
- **模板变更者必须同步更新该模板的 `files/AGENTS.md`**——它是 Agent
  理解项目结构与规范的唯一项目级上下文来源。
- 框架升级为手动流程：改 `files/package.json` 版本 → `bun install` →
  验证构建 → 同步 AGENTS.md 中受影响的描述。
- 模板变更随沙箱镜像发版生效（重新构建 `jizao/sandboxd` 镜像）。
