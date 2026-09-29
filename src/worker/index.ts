import { Env, ExecutionContext } from './types';
import { handleWorkerRequest } from './app';

export default {
  async fetch(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
    return handleWorkerRequest(request, env);
  },
};

export { handleWorkerRequest } from './app';
export * from './types';
