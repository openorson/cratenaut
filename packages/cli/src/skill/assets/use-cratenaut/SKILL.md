---
name: use-cratenaut
description: Use Cratenaut in application and infrastructure projects to initialize or edit naut.config.ts, choose official crates, define custom crates, validate configuration, inspect deployment plans, deploy to local or SSH servers, manage container lifecycle, inspect status and logs, handle secrets, and diagnose drift or change risks. Use when the user asks to deploy or manage services with Cratenaut. Do not use for developing the Cratenaut framework repository itself.
---

# Use Cratenaut

Help the user describe, review, and operate Docker deployments through Cratenaut without bypassing its safety model

## Start by understanding the project

1. Read the current `naut.config.ts` or the file explicitly selected by the user
2. Inspect `package.json` and installed `@cratenaut/*` versions
3. Identify the intended project, server, Crate instance, and environment
4. Ask only for information that cannot be derived safely, such as the real SSH host or public domain

Do not search parent directories for a configuration file. Cratenaut intentionally uses only the current directory unless `--config` or `--global` is provided

## Use the normal workflow

1. Modify the typed configuration with the smallest necessary change
2. Run `naut config validate`
3. Run `naut doctor` when the server or runtime environment is new or uncertain
4. Run `naut plan` for the exact selected server and Crate scope
5. Summarize additions, replacements, removals, drift, version changes, and risk reasons
6. Deploy only when the user requested deployment and all required high-risk authorizations are explicit
7. Verify with `naut status` and, when needed, `naut logs`

Prefer interactive selection when working with the user in a terminal. In automation, provide `--server`, `--crate`, or `--all` explicitly

## Keep the model concrete

A Crate is a reusable deployment unit definition. It packages a service's validated options, containers, files, persistent storage, tasks, health checks, and change risks

A Crate instance is one configured deployment of that definition on a server. It has a stable `id`, optional `description`, and its own options and managed data

Do not describe Crates as packages alone, running containers, or hidden dependency nodes

## Protect high-risk operations

Never add any of these flags merely to make a command succeed:

- `--allow-destructive`
- `--allow-unknown-change`
- `--allow-major`
- `--allow-downgrade`
- `--overwrite-drift`
- `--prune`
- `--force-unlock`

When a plan requires one, state the exact resource, the reported reason, likely service or data impact, and available safer preparation. Wait for explicit user authorization for that risk

`--yes` skips ordinary confirmation only. It does not authorize high-risk changes

## Handle secrets safely

Prefer `secret.env` or `secret.file`. Never write production secrets directly into configuration, chat, logs, command arguments, or committed example files

Prefer `--secret-key-file` or `--secret-key-stdin` for encrypted envelopes. Do not pass decryption keys as ordinary command-line values

## Read references only when needed

- Read `references/configuration.md` for configuration, selection, server, directory, and naming rules
- Read `references/commands.md` for exact workflow and command options
- Read `references/official-crates.md` before configuring an official Crate
- Read `references/custom-crates.md` when the user needs to deploy their own application or publish a Crate
- Read `references/safety-and-secrets.md` for risk authorization, drift, version changes, pruning, locks, or secrets
