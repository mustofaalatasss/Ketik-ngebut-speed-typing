import type { SessionStore } from './session';
import type { ProblemDetails } from './types';

/** Error dari API: status HTTP dan ProblemDetails (bila ada). Status 0 = server tidak bisa dihubungi. */
export class ApiError extends Error {
  readonly status: number;
  readonly problem: ProblemDetails;

  constructor(status: number, problem: ProblemDetails) {
    super(problem.detail ?? problem.title ?? `HTTP ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.problem = problem;
  }
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export const PLAYER_TOKEN_HEADER = 'X-Player-Token';

export interface RequestOptions {
  readonly body?: unknown;
  /**
   * 'player': kirim token nickname (header X-Player-Token); bila server menjawab 401, token itu
   * tidak dikenal lagi sehingga nickname dilupakan dari browser ini.
   */
  readonly auth?: 'player';
}

export interface HttpClient {
  request<T>(method: string, path: string, options?: RequestOptions): Promise<T>;
}

async function readProblem(response: Response): Promise<ProblemDetails> {
  try {
    return (await response.json()) as ProblemDetails;
  } catch {
    return { status: response.status, title: response.statusText };
  }
}

/** Fetch wrapper murni (tanpa React): JSON, ProblemDetails, dan token pemain. */
export function createHttpClient(baseUrl: string, session: SessionStore, fetchFn: FetchLike): HttpClient {
  const send = async (method: string, path: string, body: unknown, headers: Record<string, string>): Promise<Response> => {
    const all: Record<string, string> = { ...headers };
    if (body !== undefined) all['Content-Type'] = 'application/json';
    try {
      return await fetchFn(`${baseUrl}${path}`, {
        method,
        headers: all,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError(0, { title: 'Server tidak bisa dihubungi' });
    }
  };

  const playerHeaders = (): Record<string, string> => {
    const token = session.getSnapshot().playerToken;
    return token ? { [PLAYER_TOKEN_HEADER]: token } : {};
  };

  return {
    async request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
      const { body, auth } = options;
      const response = await send(method, path, body, auth === 'player' ? playerHeaders() : {});
      if (auth === 'player' && response.status === 401) session.clearPlayer();

      if (!response.ok) throw new ApiError(response.status, await readProblem(response));
      if (response.status === 204) return undefined as T;
      return (await response.json()) as T;
    },
  };
}
