// Tests never touch real services. Cloudinary credentials are fake so URL building works offline;
// no Anthropic or Voyage keys means AI paths are skipped or asserted to fail cleanly.
process.env.DATABASE_URL = "";
process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
process.env.CLOUDINARY_API_KEY = "123456789012345";
process.env.CLOUDINARY_API_SECRET = "test-secret";
process.env.CLOUDINARY_URL = "";
process.env.ANTHROPIC_API_KEY = "";
process.env.VOYAGE_API_KEY = "";
