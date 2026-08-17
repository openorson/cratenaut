# Commands

## Standard sequence

```bash
naut config validate
naut doctor --server <server> --crate <crate>
naut plan --server <server> --crate <crate>
naut deploy --server <server> --crate <crate>
naut status --server <server> --crate <crate>
```

Use `--all` only when the requested scope truly includes every configured server and Crate

## Selection and output

- `--config <path>` or `--global`
- `--server <id[,id]>`
- `--crate <id[,id]>`
- `--all`
- `--yes` for ordinary confirmation only
- `--json` for newline-delimited events
- `--plain` for noninteractive human-readable output
- `--verbose` for diagnostic stacks
- `--secret-key-file <path>` or `--secret-key-stdin`

## Operation commands

- `naut status`: inspect managed containers
- `naut up`: start already deployed containers
- `naut down [--timeout <seconds>]`: stop already deployed containers
- `naut restart [--timeout <seconds>]`: restart already deployed containers
- `naut logs --resource <id> [--follow] [--tail <lines>] [--since <time>] [--until <time>] [--timestamps]`
- `naut exec --resource <id> [--interactive] [--tty] [--user <user>] [--workdir <path>] -- <command>`
- `naut history [--limit <count>]`
- `naut render --format markdown|json`

Use `crate/resource` when a resource id is ambiguous

Lifecycle commands do not apply configuration changes or create missing resources. Use `plan` and `deploy` after configuration changes

## Config and secret commands

- `naut config path`
- `naut config validate`
- `naut config show`, which masks secrets
- `naut secret encrypt --from-stdin --key-file <path> --output <path>`
- `naut secret inspect <envelope>`
- `naut secret decrypt <envelope> --key-file <path> --output <path>`
