# Safety and secrets

## Three-way planning

Cratenaut compares current desired configuration, the last successfully deployed state, and the actual managed server state

Do not treat drift as an ordinary configuration update. Investigate manual changes, external automation, interrupted deployments, and restores before considering `--overwrite-drift`

## Explicit authorization

- `--allow-destructive`: possible data loss or unusable existing data
- `--allow-unknown-change`: application-specific effect cannot be determined
- `--allow-major`: Crate major upgrade without declared compatibility
- `--allow-downgrade`: any Crate downgrade
- `--overwrite-drift`: replace actual state that differs from deployment history
- `--prune`: remove managed resources absent from current configuration
- `--force-unlock`: remove a deployment lock only after proving no deployment is active

Never infer authorization from a generic request such as “fix it”, “make it pass”, or “deploy everything”. Explain the exact reported risk and wait for explicit approval

## Secrets

Use:

```ts
secret.env("NAME");
secret.file("/secure/path");
```

Direct `secret("value")` still places plaintext in source and is for non-sensitive development values only

For encrypted envelopes, prefer key files or standard input. Ordinary command-line arguments can be exposed in shell history and process listings

Cratenaut state and `config show` mask resolved secrets, but application commands and third-party software may still leak values if they are placed in arguments or logs

## Persistent data

Before pruning, disabling persistence, changing database image major versions, or changing data layout:

1. Identify the exact managed storage directory
2. Confirm a current backup exists
3. Verify a restore procedure, not only backup creation
4. Plan application downtime and compatibility
5. Then request the specific authorization flag
