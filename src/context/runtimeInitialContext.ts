import { InitialContext } from '../core/models/initialContext';

let _runtimeInitialContext: InitialContext | undefined = undefined;

export function setGlobalRuntimeInitialContext(ctx: InitialContext | undefined) {
  _runtimeInitialContext = ctx;
}

export function getGlobalRuntimeInitialContext(): InitialContext | undefined {
  return _runtimeInitialContext;
}

export default { setGlobalRuntimeInitialContext, getGlobalRuntimeInitialContext };
