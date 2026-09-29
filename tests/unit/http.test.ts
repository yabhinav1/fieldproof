import { afterEach, describe, expect, it, vi } from "vitest";
import { errorToResponse, notFound, param } from "@/server/http";

/** Shape Drizzle throws: a wrapper carrying the SQL, with the driver error as `cause`. */
function driverError(code: string) {
  const cause = Object.assign(new Error(`driver says ${code}`), { code });
  return Object.assign(new Error('Failed query: select "id" from "projects" where "id" = $1\nparams: secret'), { cause });
}

async function body(res: Response) {
  return (await res.json()) as { ok: boolean; error: string };
}

describe("errorToResponse", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("passes HttpError through with its status", async () => {
    const res = errorToResponse(notFound("Asset"));
    expect(res.status).toBe(404);
    expect((await body(res)).error).toBe("Asset not found");
  });

  it.each([
    ["23505", 409],
    ["23503", 409],
    ["22P02", 400],
  ])("maps Postgres %s to %i without echoing the query", async (code, status) => {
    const res = errorToResponse(driverError(code));
    expect(res.status).toBe(status);
    expect((await body(res)).error).not.toContain("select");
  });

  it("hides the message of an unexpected error in production", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("NODE_ENV", "production");
    const res = errorToResponse(driverError("XX000"));
    expect(res.status).toBe(500);
    expect((await body(res)).error).toBe("Internal server error.");
  });
});

describe("param", () => {
  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

  it("returns a UUID unchanged", async () => {
    const id = "acc78062-0358-43a1-a6e2-44f7af1793b4";
    await expect(param(ctx(id), "id")).resolves.toBe(id);
  });

  it("rejects anything else with a 400 before it reaches the database", async () => {
    await expect(param(ctx("not-a-uuid"), "id")).rejects.toMatchObject({ status: 400 });
    await expect(param(ctx(""), "id")).rejects.toMatchObject({ status: 400 });
  });
});
