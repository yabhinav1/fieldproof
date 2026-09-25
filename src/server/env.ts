/**
 * Central place for reading environment configuration.
 * Everything optional degrades gracefully so the backend boots with zero keys.
 */

function flag(name: string, fallback = false): boolean {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
}

export type LlmProvider = "anthropic" | "gemini";
export type EmbeddingProvider = "voyage" | "gemini";

export const env = {
  get databaseUrl() {
    return process.env.DATABASE_URL || undefined;
  },

  cloudinary: {
    get cloudName() {
      return process.env.CLOUDINARY_CLOUD_NAME || parseCloudinaryUrl()?.cloudName;
    },
    get apiKey() {
      return process.env.CLOUDINARY_API_KEY || parseCloudinaryUrl()?.apiKey;
    },
    get apiSecret() {
      return process.env.CLOUDINARY_API_SECRET || parseCloudinaryUrl()?.apiSecret;
    },
    get configured() {
      return Boolean(this.cloudName && this.apiKey && this.apiSecret);
    },
    /** Root folder in the Cloudinary media library. */
    get folder() {
      return process.env.CLOUDINARY_FOLDER || "fieldproof";
    },
    /** Auto-tagging add-on: "google_tagging" | "imagga_tagging" | "aws_rek_tagging" | "" (off). */
    get autoTagging() {
      return process.env.CLOUDINARY_AUTO_TAGGING || "";
    },
    get autoTaggingThreshold() {
      const n = Number(process.env.CLOUDINARY_AUTO_TAGGING_THRESHOLD ?? "0.6");
      return Number.isFinite(n) ? n : 0.6;
    },
    /** Cloudinary AI captioning add-on. */
    get captioning() {
      return flag("CLOUDINARY_CAPTIONING", false);
    },
  },

  anthropic: {
    get apiKey() {
      return process.env.ANTHROPIC_API_KEY || undefined;
    },
    get model() {
      return process.env.ANTHROPIC_MODEL || "claude-opus-5";
    },
  },

  gemini: {
    get apiKey() {
      return process.env.GEMINI_API_KEY || undefined;
    },
    get model() {
      return process.env.GEMINI_MODEL || "gemini-2.5-flash";
    },
    get embeddingModel() {
      return process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
    },
  },

  voyage: {
    get apiKey() {
      return process.env.VOYAGE_API_KEY || undefined;
    },
    get model() {
      return process.env.VOYAGE_MODEL || "voyage-3.5-lite";
    },
  },

  /**
   * Which model provider handles vision comparisons and report narratives.
   * Explicit LLM_PROVIDER wins; otherwise the first configured key in order anthropic, gemini.
   */
  get llmProvider(): LlmProvider | null {
    const forced = process.env.LLM_PROVIDER?.toLowerCase();
    if (forced === "anthropic" || forced === "gemini") return forced;
    if (this.anthropic.apiKey) return "anthropic";
    if (this.gemini.apiKey) return "gemini";
    return null;
  },

  /** Which provider produces search embeddings. Voyage first, then Gemini. */
  get embeddingProvider(): EmbeddingProvider | null {
    const forced = process.env.EMBEDDING_PROVIDER?.toLowerCase();
    if (forced === "voyage" || forced === "gemini") return forced;
    if (this.voyage.apiKey) return "voyage";
    if (this.gemini.apiKey) return "gemini";
    return null;
  },

  get appUrl() {
    return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  },
};

function parseCloudinaryUrl() {
  const raw = process.env.CLOUDINARY_URL;
  if (!raw) return undefined;
  // cloudinary://<api_key>:<api_secret>@<cloud_name>
  const m = raw.match(/^cloudinary:\/\/([^:]+):([^@]+)@([^/?#]+)/);
  if (!m) return undefined;
  return { apiKey: m[1], apiSecret: m[2], cloudName: m[3] };
}
