import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch, jsonRequest } from "@/lib/api";
import { THUMBNAIL, cloudinaryVariant, thumbnailUrl } from "@/lib/cloudinary-url";
import { assetBelongsToLocation } from "@/lib/locations";
import { TRANSFORMS } from "@/server/cloudinary";

describe("cloudinaryVariant", () => {
  const original = "https://res.cloudinary.com/demo/image/upload/v1712/fieldproof/yamuna/ghat.jpg";

  it("inserts the transformation right after /upload/", () => {
    expect(thumbnailUrl(original)).toBe(
      "https://res.cloudinary.com/demo/image/upload/c_fill,g_auto,w_400,h_300/f_auto,q_auto/v1712/fieldproof/yamuna/ghat.jpg",
    );
  });

  it("leaves anything that is not a Cloudinary upload URL untouched", () => {
    for (const url of ["https://example.com/image/upload/a.jpg", "https://res.cloudinary.com/demo/video/upload/a.mp4", ""]) {
      expect(cloudinaryVariant(url, THUMBNAIL)).toBe(url);
    }
  });

  it("uses the same thumbnail the server records in provenance", () => {
    expect(THUMBNAIL).toBe(TRANSFORMS.thumbnail);
  });
});

describe("assetBelongsToLocation", () => {
  const north = { id: "north", siteId: "site-a" };

  it("matches on locationId when the asset has one", () => {
    expect(assetBelongsToLocation({ locationId: "north", siteId: "site-a" }, north)).toBe(true);
  });

  it("does not claim an asset that belongs to another location at the same site", () => {
    expect(assetBelongsToLocation({ locationId: "south", siteId: "site-a" }, north)).toBe(false);
  });

  it("falls back to the site only for assets with no location", () => {
    expect(assetBelongsToLocation({ locationId: null, siteId: "site-a" }, north)).toBe(true);
    expect(assetBelongsToLocation({ siteId: "site-b" }, north)).toBe(false);
    expect(assetBelongsToLocation({ locationId: null, siteId: null }, { id: "loose", siteId: null })).toBe(false);
  });
});

describe("apiFetch", () => {
  afterEach(() => vi.unstubAllGlobals());

  const respondWith = (body: string, status: number) =>
    vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { status })));

  it("returns data from a successful response", async () => {
    respondWith(JSON.stringify({ ok: true, data: [{ id: "p1" }] }), 200);
    await expect(apiFetch("/api/projects")).resolves.toEqual([{ id: "p1" }]);
  });

  it("throws the server's own message, which is a string in `error`", async () => {
    respondWith(JSON.stringify({ ok: false, error: "siteId does not belong to this project.", details: [{ path: "siteId" }] }), 400);

    const failure = await apiFetch("/api/assets/ingest", jsonRequest("POST", {}), "Upload failed").catch((err) => err);
    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({ message: "siteId does not belong to this project.", status: 400, details: [{ path: "siteId" }] });
  });

  it("falls back to the caller's message when the response is not JSON", async () => {
    respondWith("<html>504 Gateway Timeout</html>", 504);
    await expect(apiFetch("/api/reports", undefined, "Failed to generate report")).rejects.toThrow("Failed to generate report");
  });

  it("treats ok:false as a failure even under a 200 status", async () => {
    respondWith(JSON.stringify({ ok: false, error: "Nope" }), 200);
    await expect(apiFetch("/api/x")).rejects.toThrow("Nope");
  });
});
