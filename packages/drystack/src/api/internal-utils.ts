export type DrystackRequest = {
  headers: { get(name: string): string | null };
  method: string;
  url: string;
  json: () => Promise<any>;
};

export type DrystackResponse = ResponseInit & {
  body: Uint8Array | string | null;
};

export function redirect(
  to: string,
  initialHeaders?: [string, string][]
): DrystackResponse {
  return {
    body: null,
    status: 307,
    headers: [...(initialHeaders ?? []), ['Location', to]],
  };
}
