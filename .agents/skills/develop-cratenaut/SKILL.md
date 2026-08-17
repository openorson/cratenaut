---
name: develop-cratenaut
description: Apply Cratenaut repository conventions when creating, editing, refactoring, reviewing, or testing TypeScript code, package layouts, Core or CLI internals, official crates, TypeBox schemas, public exports, JSDoc, resources, secrets, and deployment behavior. Use only for work inside the Cratenaut repository.
---

# Develop Cratenaut

Apply these rules before changing code in this repository

## Start with repository context

1. Read the nearest `AGENTS.md` and the relevant package manifest
2. Inspect the existing module contract and tests before editing
3. Preserve unrelated user changes in a dirty worktree
4. Distinguish public API, package-internal API, CLI presentation, and deployment runtime concerns
5. For a design proposal, first show a realistic annotated usage example and explain every field, then compare tradeoffs before implementation

## Organize files by package shape

Use `${module}.${responsibility}.ts` for source files

For a multi-module package, the immediate module directory supplies `${module}`

```text
packages/core/src/config/config.define.ts
packages/core/src/config/config.types.ts
packages/cli/src/deploy/deploy.apply.ts
```

For a single-module package, the package directory supplies `${module}` and `src` stays flat

```text
packages/crates/caddy/src/caddy.crate.ts
packages/crates/caddy/src/index.ts
```

Never introduce a redundant layout such as `packages/crates/caddy/src/caddy/caddy.crate.ts`

Create a child directory only when it represents a genuine submodule with multiple responsibilities

Keep named type declarations in `${module}.types.ts` and keep classes or runtime implementations in their responsibility files

Official crate packages are an explicit exception: keep the small `TypeBox` schema, inferred local types, and `defineCrate` implementation together in `${crate}.crate.ts`; let `index.ts` export only the crate factory

## Write predictable TypeScript contracts

- Prefix named type aliases with `T`
- Prefix interfaces with `I`
- Do not apply `T` or `I` prefixes to generic parameter names
- Combine related generic information into one structural generic when that produces clearer IDE output
- Prefer `import type` for type-only dependencies
- Infer configuration input and decoded option types from `TypeBox` instead of duplicating them manually
- Validate external configuration at its boundary and keep runtime values immutable when the surrounding contract is immutable
- Do not add a separate type file for types used only inside one small official crate implementation

Use the structural generic pattern when several generic parameters describe one concept

```ts
Type extends { name: string; optionsSchema: TSchema | undefined } = {
  name: string
  optionsSchema: TSchema | undefined
}
```

## Write Chinese JSDoc

- Add standard JSDoc to public contracts, exported values, option fields, classes, and non-obvious internal behavior
- Write comments in Chinese wherever possible
- Wrap unavoidable English terms in backticks, for example `Docker`、`TypeBox`、`SSH`
- Do not append `。` to the end of a comment sentence
- Split multiple ideas into separate paragraphs or list items
- Explain intent, invariants, safety boundaries, or surprising behavior rather than restating the code

```ts
/**
 * 容器使用的精确镜像引用
 *
 * 必须包含不可变标签，避免同一配置在不同时间产生不同结果
 */
readonly image: string
```

## Keep exports minimal

- Export from a package root only what ordinary users need to define configuration or crates
- Do not leak validators, registries, mutable state, helpers, or runtime implementation details from the root
- Expose CLI-facing Core internals through the `./internal` subpath and `src/internal/index.ts`
- Keep every barrel file narrow and intentional
- In an official crate package, export only its crate factory unless a public contract is explicitly required

## Preserve the crate model

- A crate is a versioned deployment-unit definition that converts validated options into declared resources
- Do not add hooks, outputs, implicit dependencies, or topology sorting
- Treat resource array order as declaration and processing order only
- Let users control cross-crate coordination explicitly through configuration
- Require an exact semantic version for a crate definition and use `Bun.semver` for internal comparisons
- Allow optional descriptions on crate instances and servers
- Keep resource identifiers stable because state, plans, container names, and change detection depend on them
- Reference only resources already declared in the same crate when an ordered local reference is required
- Keep custom application deployment in the framework resource model rather than adding a generic official `app` crate

Keep the current official crate scope intentional

- Implement `caddy`、`gitea`、`postgres` and `redis`
- Do not restore official `app`、`site` or `nginx` crates
- Keep `backup` as a design placeholder until restore consistency, retention, locking, and storage-provider contracts are settled

## Prefer platform capabilities

- Prefer stable `Bun` runtime APIs and standard library capabilities before adding a dependency
- Add a package only when it materially improves correctness, portability, or user experience
- Use `Bun.semver` for semantic-version work
- The project may use the `Bun` Markdown API without a compatibility wrapper unless a concrete problem appears
- Keep `nostics` limited to structured diagnostics and do not let it replace the shared CLI presenter or Core logger

## Model resources and secrets safely

- Represent each resource kind with a concrete class extending `BaseResource`
- Put resource interfaces and named types in `${resource}.types.ts`
- Use `ResourceContext` as the declaration context exposed to crate resource factories
- Keep resource construction declarative; perform side effects only in CLI runtime execution
- Use secret wrappers or references for sensitive option values
- Never place plaintext secrets in logs, plans, state snapshots, fingerprints, container arguments, or shell history
- Prefer managed secret files with restrictive permissions over environment variables when the target software supports files
- Use keyed, non-reversible fingerprints when secret changes must participate in change detection
- Do not implement or assume `Bun.secrets` until the project explicitly adopts it

## Preserve deployment behavior

- Support `Docker` only; do not introduce a container-engine abstraction or `Podman` branches
- Support local and `SSH` servers under the same deployment model
- Make resource application idempotent and skip work when desired, previous, and actual state agree
- Compare desired configuration, last applied state, and actual server state before mutation
- Classify changes as safe, disruptive, unknown, destructive, or immutable when semantics are known
- Treat unknown semantic changes conservatively and allow a crate-specific assessment only through an explicit contract
- Use exact image tags and surface image changes as potentially disruptive
- Keep generated runtime artifacts internal; do not make generated Compose files the public contract
- Do not infer dependencies merely because crate instances appear in the same configuration

Use the managed server layout already defined by the CLI

```text
<root>/projects/<project>/servers/<server>/
  state/
  locks/
  journals/
  runtime/
  backups/
  crates/
```

Use `/var/lib/cratenaut` as the default remote root and `<config>/.cratenaut/managed` as the default local root

Use `cratenaut-<project>-<server>-<crate>-<resource>` for managed container names

## Keep CLI interaction consistent

- Prefer interactive operation and selection controls over free-form input
- Let an explicitly supplied option skip only its corresponding prompt
- Validate both prompt answers and non-interactive options
- Keep command output, status, progress, success, warning, cancellation, and failure presentation behind the shared presenter
- Use `@clack/prompts` only for CLI interaction and use the Core logger for library, crate, and runtime logging
- Without `--global`, resolve configuration only from the current directory and never walk upward
- With `--global`, resolve configuration from `~/.cratenaut/.cratenaut`
- Let an explicit `--config` path take precedence
- Keep commands suitable for automation through complete non-interactive options and stable exit behavior

## Verify proportionally to risk

1. Format changed source with the repository formatter
2. Run the affected package type check
3. Run focused tests for the changed behavior
4. Run the workspace test suite when shared contracts or runtime behavior change
5. Cover defaults, valid input, invalid input, cross-field rules, idempotency, change classification, and secret redaction where applicable
6. Report checks that actually ran and distinguish them from behavior requiring a live `Docker` or `SSH` environment

Before finishing, confirm that file placement, filenames, named types, JSDoc, exports, security boundaries, and tests all follow this skill
