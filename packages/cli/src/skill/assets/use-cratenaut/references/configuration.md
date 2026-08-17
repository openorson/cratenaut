# Configuration

## Sources

- Default: `./naut.config.ts` in the current directory only
- Explicit: `--config <path>`
- User-level: `--global`, fixed at `~/.cratenaut/naut.config.ts`

Do not combine `--config` and `--global`

## Shape

```ts
export default defineConfig({
  project: "commerce",
  servers: [
    {
      id: "production",
      description: "Production application server",
      connection: {
        kind: "ssh",
        host: "server.example.com",
        user: "deploy",
      },
      crates: [gateway, database],
    },
  ],
});
```

Keep `project`, server `id`, Crate instance `id`, and resource ids stable. Renaming them can appear as removal and recreation rather than an in-place rename

Use `description` for human context instead of changing an id

## Servers

Local connections use `{ kind: "local" }`

SSH connections support `host`, `user`, `port`, `identityFile`, `proxyJump`, and `connectTimeout`

Local managed root defaults to `<config-directory>/.cratenaut/managed`. Remote root defaults to `/var/lib/cratenaut`. A server may override `root`, but changing it after deployment is a migration

## Networking

Containers on one configured server join `cratenaut-<project>-<server>`

Container names are `cratenaut-<project>-<server>-<crate-id>-<resource-id>`

The stable network alias is `<crate-id>-<resource-id>`, such as `database-server:5432`

Do not infer startup readiness or hidden dependencies from array order. Services should tolerate temporary unavailability and use health checks or retry behavior
