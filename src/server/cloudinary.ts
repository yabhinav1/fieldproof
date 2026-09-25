import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { env } from "./env";

let configured = false;

/** Returns the configured Cloudinary SDK, throwing a clear error if credentials are missing. */
export function getCloudinary() {
  if (!env.cloudinary.configured) {
    throw new CloudinaryNotConfiguredError();
  }
  if (!configured) {
    cloudinary.config({
      cloud_name: env.cloudinary.cloudName,
      api_key: env.cloudinary.apiKey,
      api_secret: env.cloudinary.apiSecret,
      secure: true,
    });
    configured = true;
  }
  return cloudinary;
}

export class CloudinaryNotConfiguredError extends Error {
  constructor() {
    super("Cloudinary is not configured. Set CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET.");
    this.name = "CloudinaryNotConfiguredError";
  }
}

// ---------- upload signing (browser uploads straight to Cloudinary) ----------

export interface SignedUploadParams {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  /** Extra params the client must send unchanged, because they are part of the signature. */
  params: Record<string, string>;
  uploadUrl: string;
}

/**
 * Produces a signature so the frontend can upload directly to Cloudinary
 * (Upload Widget or a plain multipart POST) without exposing the API secret.
 */
export function signUpload(opts: { projectSlug: string; siteSlug?: string; context?: Record<string, string> }): SignedUploadParams {
  const cld = getCloudinary();
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = [env.cloudinary.folder, opts.projectSlug, opts.siteSlug].filter(Boolean).join("/");

  const params: Record<string, string> = {
    folder,
    timestamp: String(timestamp),
    // Ask Cloudinary to compute what ingest needs; avoids a second round-trip when possible.
    image_metadata: "true",
    phash: "true",
    colors: "true",
  };
  if (opts.context && Object.keys(opts.context).length) {
    params.context = Object.entries(opts.context)
      .map(([k, v]) => `${k}=${String(v).replace(/[|=]/g, " ")}`)
      .join("|");
  }

  const signature = cld.utils.api_sign_request(params, env.cloudinary.apiSecret!);

  return {
    cloudName: env.cloudinary.cloudName!,
    apiKey: env.cloudinary.apiKey!,
    timestamp,
    signature,
    folder,
    params,
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.cloudinary.cloudName}/image/upload`,
  };
}

// ---------- resource enrichment ----------

/** The subset of Cloudinary's resource payload ingest reads. Extra keys are preserved in `raw`. */
export interface CloudinaryResource {
  public_id: string;
  version?: number;
  resource_type?: string;
  secure_url: string;
  format?: string;
  width?: number;
  height?: number;
  bytes?: number;
  created_at?: string;
  tags?: string[];
  phash?: string;
  colors?: Array<[string, number]>;
  image_metadata?: Record<string, unknown>;
  context?: { custom?: Record<string, string> } | Record<string, unknown>;
  info?: {
    categorization?: Record<string, { data?: Array<{ tag: string; confidence: number }> }>;
    detection?: { captioning?: { data?: { caption?: string } } };
  };
  [key: string]: unknown;
}

/**
 * Runs the configured Cloudinary analysis add-ons on an already-uploaded asset and returns the
 * enriched resource. `explicit` re-processes in place, so this is idempotent.
 */
export async function enrichResource(publicId: string): Promise<CloudinaryResource> {
  const cld = getCloudinary();
  const options: Record<string, unknown> = {
    type: "upload",
    resource_type: "image",
    image_metadata: true,
    phash: true,
    colors: true,
  };
  if (env.cloudinary.autoTagging) {
    options.categorization = env.cloudinary.autoTagging;
    options.auto_tagging = env.cloudinary.autoTaggingThreshold;
  }
  if (env.cloudinary.captioning) {
    options.detection = "captioning";
  }
  return withAddonFallback(publicId, options, (o) => cld.uploader.explicit(publicId, o) as Promise<UploadApiResponse>);
}

function addonErrorMessage(err: unknown): string {
  const e = err as { error?: { message?: string }; message?: string };
  return e?.error?.message ?? e?.message ?? String(err);
}

function isAddonError(err: unknown): boolean {
  return /quota|limit|exceed|not (registered|subscribed|enabled)|add-?on|addon|categorization|detection|tagging|captioning/i.test(addonErrorMessage(err));
}

/**
 * Free add-on quotas are small (e.g. 50 Google taggings/month, 500 captionings/month) and each is
 * counted separately. When a call fails because of an add-on, drop only the add-on that failed and
 * retry, so the asset still lands with whatever analysis is still available; as a last resort drop
 * every add-on and keep EXIF, phash and colours.
 */
async function withAddonFallback(
  label: string,
  options: Record<string, unknown>,
  call: (o: Record<string, unknown>) => Promise<UploadApiResponse>,
): Promise<CloudinaryResource> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return (await call(options)) as unknown as CloudinaryResource;
    } catch (err) {
      const hasAddons = Boolean(options.categorization || options.detection);
      if (!isAddonError(err) || !hasAddons) throw err;
      const msg = addonErrorMessage(err);
      const taggingFailed = /tagging|categorization/i.test(msg);
      const captionFailed = /caption|detection/i.test(msg);
      if (taggingFailed && !captionFailed && options.categorization) {
        console.warn(`[cloudinary] tagging unavailable for ${label}; continuing without tags: ${msg}`);
        delete options.categorization;
        delete options.auto_tagging;
      } else if (captionFailed && !taggingFailed && options.detection) {
        console.warn(`[cloudinary] captioning unavailable for ${label}; continuing without caption: ${msg}`);
        delete options.detection;
      } else {
        console.warn(`[cloudinary] add-ons unavailable for ${label}; continuing with metadata only: ${msg}`);
        delete options.categorization;
        delete options.auto_tagging;
        delete options.detection;
      }
    }
  }
  return (await call(options)) as unknown as CloudinaryResource;
}

/** Fetches a resource with metadata without re-running add-ons. */
export async function fetchResource(publicId: string): Promise<CloudinaryResource> {
  const cld = getCloudinary();
  const res = await cld.api.resource(publicId, {
    image_metadata: true,
    phash: true,
    colors: true,
    context: true,
    tags: true,
  });
  return res as unknown as CloudinaryResource;
}

/** Server-side upload from a local path or remote URL. Used by the seed / bulk-upload script. */
export async function uploadFile(
  file: string,
  opts: { folder: string; publicId?: string; context?: Record<string, string>; tags?: string[] },
): Promise<CloudinaryResource> {
  const cld = getCloudinary();
  const options: Record<string, unknown> = {
    folder: opts.folder,
    public_id: opts.publicId,
    context: opts.context,
    tags: opts.tags,
    image_metadata: true,
    phash: true,
    colors: true,
    overwrite: false,
    unique_filename: true,
  };
  if (env.cloudinary.autoTagging) {
    options.categorization = env.cloudinary.autoTagging;
    options.auto_tagging = env.cloudinary.autoTaggingThreshold;
  }
  if (env.cloudinary.captioning) {
    options.detection = "captioning";
  }
  return withAddonFallback(file, options, (o) => cld.uploader.upload(file, o));
}

// ---------- reading AI results out of a resource ----------

export function extractAiTags(res: CloudinaryResource): string[] {
  const out = new Set<string>();
  const cats = res.info?.categorization ?? {};
  for (const provider of Object.values(cats)) {
    for (const t of provider?.data ?? []) {
      if (t?.tag) out.add(t.tag.toLowerCase());
    }
  }
  for (const t of res.tags ?? []) out.add(String(t).toLowerCase());
  return [...out];
}

export function extractCaption(res: CloudinaryResource): string | null {
  const c = res.info?.detection?.captioning?.data?.caption;
  return typeof c === "string" && c.trim() ? c.trim() : null;
}

// ---------- derived URLs (every one of these is recorded in `provenance`) ----------

export interface DerivedUrl {
  url: string;
  /** The transformation chain as a Cloudinary URL segment. */
  transformation: string;
}

/**
 * Transformation presets. Kept as plain strings so provenance is human-readable and
 * so the same string can be registered as a named transformation with `scripts/cloudinary-setup.ts`.
 */
export const TRANSFORMS = {
  thumbnail: "c_fill,g_auto,w_400,h_300/f_auto,q_auto",
  comparison: "c_fill,g_auto,w_1024,h_768/f_jpg,q_auto:good",
  analysis: "c_limit,w_1200,h_1200/f_jpg,q_auto:eco",
  reportHero: "c_fill,g_auto,w_1600,h_900/f_auto,q_auto:good",
  campaignBase: "c_fill,g_auto,w_1080,h_1080",
} as const;

export function derivedUrl(publicId: string, transformation: string): DerivedUrl {
  const cld = getCloudinary();
  const url = cld.url(publicId, { secure: true, raw_transformation: transformation });
  return { url, transformation };
}

/**
 * Builds a square campaign image: hero photo, dark gradient band, headline and org name overlays.
 * Text goes through Cloudinary's overlay encoding, so any characters are safe.
 */
export function campaignImageUrl(publicId: string, headline: string, orgName: string): DerivedUrl {
  const cld = getCloudinary();
  const transformation = [
    { crop: "fill", gravity: "auto", width: 1080, height: 1080 },
    { effect: "gradient_fade:symmetric_pad,y_-0.35", background: "black" },
    {
      overlay: { font_family: "Arial", font_size: 64, font_weight: "bold", text: headline, text_align: "left" },
      color: "white",
      gravity: "south_west",
      x: 60,
      y: 150,
      width: 960,
      crop: "fit",
    },
    {
      overlay: { font_family: "Arial", font_size: 34, text: orgName, letter_spacing: 2 },
      color: "#E6F3EC",
      gravity: "south_west",
      x: 60,
      y: 80,
    },
    { fetch_format: "jpg", quality: "auto:good" },
  ];
  const url = cld.url(publicId, { secure: true, transformation });
  // Reconstruct the string form for provenance.
  const chain = url.split("/image/upload/")[1]?.replace(`/${publicId}`, "").replace(/\/v\d+$/, "") ?? "";
  return { url, transformation: chain };
}
