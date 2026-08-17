import type { TSchema } from "typebox";

import type { IChangeOptions, IOptionChangePolicy, TChangeRisk } from "./change.types";

const schemaPolicies = new WeakMap<object, Readonly<{ risk: TChangeRisk; reason?: string }>>();

/**
 * 记录配置类型的变更策略
 *
 * @internal
 */
export function registerChangePolicy<Schema extends TSchema>(
  schema: Schema,
  risk: TChangeRisk,
  options: IChangeOptions = {},
): Schema {
  schemaPolicies.set(schema, Object.freeze({ risk, reason: options.reason }));
  return schema;
}

/**
 * 收集配置类型中显式声明的字段变更策略
 *
 * @internal
 */
export function collectChangePolicies(schema: TSchema | undefined): readonly IOptionChangePolicy[] {
  if (schema === undefined) {
    return Object.freeze([]);
  }

  const policies: IOptionChangePolicy[] = [];
  const visited = new Set<object>();

  const visit = (value: unknown, path: string): void => {
    if (typeof value !== "object" || value === null || visited.has(value)) {
      return;
    }

    visited.add(value);

    const policy = schemaPolicies.get(value);

    if (policy !== undefined) {
      policies.push(Object.freeze({ path, ...policy }));
    }

    const record = value as Record<string, unknown>;
    const properties = record.properties;

    if (typeof properties === "object" && properties !== null) {
      for (const [key, child] of Object.entries(properties)) {
        visit(child, path === "" ? key : `${path}.${key}`);
      }
    }

    if (record.items !== undefined) {
      visit(record.items, path === "" ? "*" : `${path}.*`);
    }

    for (const keyword of ["anyOf", "allOf", "oneOf"] as const) {
      const variants = record[keyword];

      if (Array.isArray(variants)) {
        for (const variant of variants) {
          visit(variant, path);
        }
      }
    }
  };

  visit(schema, "");

  return Object.freeze(policies);
}
