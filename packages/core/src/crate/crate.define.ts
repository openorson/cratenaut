import { semver } from "bun";
import type { TSchema } from "typebox";
import Compile from "typebox/compile";

import { collectChangePolicies } from "../change/change.policy";
import { validateDescription, validateIdentifier } from "../identifier/identifier.validate";
import type { ICrateRuntimeState } from "../internal/internal.types";
import { ResourceContext } from "../resource/resource.context";
import { collectSecretSchemaPaths } from "../secret/secret.schema";
import { registerCrateRuntimeState } from "./crate.internal";
import type {
  ICrate,
  ICrateChangeAssessment,
  ICrateDefinition,
  ICrateInstance,
  IDefineCrate,
  TCrateInstanceArgs,
  TCrateResourceContext,
} from "./crate.types";

const resourceContext = Object.freeze(new ResourceContext());
const semanticVersionPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const rangeVersionPattern =
  /^(?:(?:0|[1-9]\d*)|[xX*])(?:\.(?:(?:0|[1-9]\d*)|[xX*])){0,2}(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

/**
 * 严格校验完整的语义化版本
 */
function isSemanticVersion(value: string): boolean {
  const match = semanticVersionPattern.exec(value);

  if (match === null) {
    return false;
  }

  return !(match[4] ?? "")
    .split(".")
    .some((identifier) => /^\d+$/.test(identifier) && identifier.length > 1 && identifier.startsWith("0"));
}

/**
 * 校验交给 `Bun.semver` 判断的版本范围语法
 */
function isSemanticVersionRange(value: string): boolean {
  if (value.trim() === "") {
    return false;
  }

  return value.split("||").every((branch) => {
    const normalized = branch.trim();
    const hyphen = normalized.match(/^(\S+)\s+-\s+(\S+)$/);

    if (hyphen !== null) {
      return isSemanticVersion(hyphen[1]!) && isSemanticVersion(hyphen[2]!);
    }

    return normalized.split(/\s+/).every((token) => {
      const version = token.replace(/^(?:\^|~|>=|<=|>|<|=)/, "");

      if (version === "*" || /[xX*]/.test(version)) {
        return rangeVersionPattern.test(version);
      }

      const coreSegments = version.split(/[+-]/, 1)[0]!.split(".");
      return coreSegments.length === 3 ? isSemanticVersion(version) : rangeVersionPattern.test(version);
    });
  });
}

/**
 * 收集两个值之间变化的字段路径
 */
function collectChangedPaths(previous: unknown, next: unknown, path = ""): readonly string[] {
  if (Object.is(previous, next)) {
    return [];
  }

  if (
    typeof previous !== "object" ||
    previous === null ||
    typeof next !== "object" ||
    next === null ||
    Array.isArray(previous) !== Array.isArray(next)
  ) {
    return [path];
  }

  const previousRecord = previous as Record<string, unknown>;
  const nextRecord = next as Record<string, unknown>;
  const keys = new Set([...Object.keys(previousRecord), ...Object.keys(nextRecord)]);
  const changed: string[] = [];

  for (const key of keys) {
    const childPath = path === "" ? key : `${path}.${key}`;
    changed.push(...collectChangedPaths(previousRecord[key], nextRecord[key], childPath));
  }

  return changed;
}

/**
 * 校验语义化版本和兼容范围
 */
function validateVersion(definition: ICrateDefinition): void {
  try {
    if (!isSemanticVersion(definition.version)) {
      throw new TypeError("版本必须使用完整的语义化版本格式");
    }

    semver.order(definition.version, definition.version);

    for (const range of definition.compatibility?.upgradesFrom ?? []) {
      if (!isSemanticVersionRange(range)) {
        throw new TypeError(`版本兼容范围“${range}”格式无效`);
      }

      semver.satisfies(definition.version, range);
    }
  } catch (error) {
    throw new TypeError(`Crate“${definition.name}”的语义化版本或兼容范围无效`, { cause: error });
  }
}

/**
 * 创建 `Crate` 定义
 */
function defineCrateImplementation<
  const Name extends string = string,
  const Version extends string = string,
  const OptionsSchema extends TSchema | undefined = undefined,
>(
  definition: ICrateDefinition<Name, Version, OptionsSchema>,
): ICrate<{ name: Name; version: Version; optionsSchema: OptionsSchema }> {
  if (typeof definition !== "object" || definition === null) {
    throw new TypeError("Crate 定义必须是对象");
  }

  if (typeof definition.resources !== "function") {
    throw new TypeError("Crate 资源声明必须是函数");
  }

  if (definition.assessChange !== undefined && typeof definition.assessChange !== "function") {
    throw new TypeError("Crate 配置变更评估器必须是函数");
  }

  if (
    definition.compatibility !== undefined &&
    (typeof definition.compatibility !== "object" ||
      definition.compatibility === null ||
      (definition.compatibility.upgradesFrom !== undefined &&
        (!Array.isArray(definition.compatibility.upgradesFrom) ||
          definition.compatibility.upgradesFrom.some((range) => typeof range !== "string"))))
  ) {
    throw new TypeError("Crate 版本兼容规则格式无效");
  }

  validateIdentifier(definition.name, "Crate 名称");
  validateVersion(definition);

  const compatibility =
    definition.compatibility === undefined
      ? undefined
      : Object.freeze({
          ...definition.compatibility,
          upgradesFrom:
            definition.compatibility.upgradesFrom === undefined
              ? undefined
              : Object.freeze([...definition.compatibility.upgradesFrom]),
        });
  const normalizedDefinition = Object.freeze({ ...definition, compatibility });
  const optionsValidator =
    normalizedDefinition.optionsSchema === undefined ? undefined : Compile(normalizedDefinition.optionsSchema);
  const runtimeState: ICrateRuntimeState = Object.freeze({
    optionChangePolicies: collectChangePolicies(normalizedDefinition.optionsSchema),
    secretOptionPaths: collectSecretSchemaPaths(normalizedDefinition.optionsSchema),
    compatibility: normalizedDefinition.compatibility,
    decodeOptions: (options: unknown) =>
      optionsValidator === undefined ? undefined : optionsValidator.Decode(options),
    createResources: (id: string, options: unknown) =>
      normalizedDefinition.resources({
        id,
        options,
        resource: resourceContext,
      } as TCrateResourceContext<string, { name: Name; version: Version; optionsSchema: OptionsSchema }>),
    assessChange: (previousOptions: unknown, nextOptions: unknown) => {
      if (normalizedDefinition.assessChange === undefined || previousOptions === undefined) {
        return Object.freeze([]);
      }

      const result = normalizedDefinition.assessChange({
        previousOptions,
        nextOptions,
        changedPaths: Object.freeze([...collectChangedPaths(previousOptions, nextOptions)]),
      } as never);

      if (result === undefined) {
        return Object.freeze([]);
      }

      const assessments = (Array.isArray(result) ? result : [result]) as readonly ICrateChangeAssessment[];

      return Object.freeze(assessments.map((item) => Object.freeze({ ...item })));
    },
  });

  const crate = <const Id extends string = string>(
    args: TCrateInstanceArgs<Id, { name: Name; version: Version; optionsSchema: OptionsSchema }>,
  ): ICrateInstance<Id, { name: Name; version: Version; optionsSchema: OptionsSchema }> => {
    if (typeof args !== "object" || args === null) {
      throw new TypeError("Crate 实例化参数必须是对象");
    }

    validateIdentifier(args.id, "Crate 实例标识");
    const description = validateDescription(args.description, `Crate 实例“${args.id}”的描述`);
    const inputOptions = "options" in args ? args.options : undefined;
    const options = optionsValidator === undefined ? undefined : optionsValidator.Parse(inputOptions);
    const instance = Object.freeze({
      id: args.id,
      description,
      name: normalizedDefinition.name,
      version: normalizedDefinition.version,
      options,
    }) as ICrateInstance<Id, { name: Name; version: Version; optionsSchema: OptionsSchema }>;

    registerCrateRuntimeState(instance, runtimeState);

    return instance;
  };

  Object.defineProperty(crate, "definition", {
    configurable: false,
    enumerable: true,
    value: normalizedDefinition,
    writable: false,
  });

  return Object.freeze(crate) as ICrate<{
    name: Name;
    version: Version;
    optionsSchema: OptionsSchema;
  }>;
}

export const defineCrate: IDefineCrate = defineCrateImplementation;
