# Custom Crates

Use a custom Crate for a user-owned application instead of inventing a generic application configuration outside the framework

Keep the Crate close to the application or publish it through npm, a private registry, or Gitea

## Definition

```ts
export const application = defineCrate({
  name: "application",
  version: "1.0.0",
  optionsSchema: t
    .Codec(/* encoded user input */)
    .Decode(/* defaults and normalization */)
    .Encode((options) => options),
  resources: ({ options, resource }) => [/* full resource list */],
});
```

Keep implementation in `<module>.crate.ts`. When separate declarations are genuinely needed, place them in `<module>.types.ts`

## Resources

- `resource.file`: generated configuration, scripts, certificates, or secret files
- `resource.directory`: directories with explicit ownership or permissions
- `resource.storage`: persistent data that must have stable location and backup semantics
- `resource.container`: long-running application containers
- `resource.task`: validation, migrations, or repeatable management commands

Declare a referenced resource before calling `fileRef`, `storageRef`, or `containerRef`

Do not store persistent data only in a container writable layer. Use `resource.storage`

## Options and change risks

Use TypeBox codecs to accept concise input and decode defaults. Use `Refine` for cross-field validation

Mark operational fields with `change.safe`, `change.disruptive`, `change.destructive`, `change.immutable`, or `change.unknown`. Use pure `assessChange` for conditional cross-field risk

Use `secret.schema(t.String(...))` for secrets. Do not put resolved secret values in ids, commands, logs, or descriptions

Crate versions describe the deployment contract. Removing options, renaming resources, changing persistent layouts, or changing existing option meaning generally requires a major version
