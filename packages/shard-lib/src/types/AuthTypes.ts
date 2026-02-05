export type ByteArray = ReturnType<Uint8Array["slice"]>;

export type AuthInfo =
  | { type: "None" }
  | { type: "Basic"; username: string; password: string }
  | { type: "Bearer"; token: string };

export interface DockerResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  dockerBody(): Promise<ByteArray>;
  dockerJson(): Promise<unknown>;
  dockerErrors(): Promise<Array<RegistryError>>;
  dockerThrowable(baseMsg: string): Promise<Error>;
}

export interface RegistryError {
  code?: string;
  message: string;
  detail?: string;
}

export interface RequestUrlParam {
  url: string;
  method?: string;
  contentType?: string;
  body?: string | ArrayBuffer;
  headers?: Record<string, string>;
  throw?: boolean;
}

export interface RequestUrlResponse {
  status: number;
  headers: Record<string, string>;
  arrayBuffer: ArrayBuffer;
  json: unknown;
  text: string;
}
