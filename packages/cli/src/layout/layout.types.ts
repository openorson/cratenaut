/**
 * 服务器项目目录布局
 */
export interface IServerLayout {
  readonly root: string;
  readonly project: string;
  readonly server: string;
  readonly base: string;
  readonly state: string;
  readonly currentState: string;
  readonly stateHistory: string;
  readonly fingerprintKey: string;
  readonly journals: string;
  readonly locks: string;
  readonly deployLock: string;
  readonly runtime: string;
  readonly deployment: string;
  readonly backups: string;
  readonly crates: string;
}

/**
 * `Crate` 目录布局
 */
export interface ICrateLayout {
  readonly base: string;
  readonly data: string;
  readonly config: string;
  readonly cache: string;
  readonly runtime: string;
}
