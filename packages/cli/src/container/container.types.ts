import type { IContainerSpecification } from "../specification/specification.types";

/**
 * 已选择的托管容器
 */
export interface IContainerTarget {
  readonly crateId: string;
  readonly resource: IContainerSpecification;
  readonly name: string;
}
