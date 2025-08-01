/* eslint-disable @typescript-eslint/no-explicit-any */

import { Disposable } from 'vs/base/common/lifecycle';

export interface ExecutionContextDelegate {}
export class ExecutionContext {
  constructor() {}
}

export class JSHandle extends Disposable {
  constructor() {
    super();
  }
}
