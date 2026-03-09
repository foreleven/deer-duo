export type Bindings = {
  DB: D1Database;
  ASSETS: Fetcher;
  JWT_SECRET: string | undefined;
  AI: Ai;
};

export type JWTPayload = {
  sub: string;
  username: string;
  role: string;
  exp: number;
};
