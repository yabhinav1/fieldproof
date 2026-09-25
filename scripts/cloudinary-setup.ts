/**
 * One-time Cloudinary account setup:
 *  - registers the transformation presets as named transformations (t_fieldproof_*),
 *  - creates structured metadata fields so assets carry project / site / phase inside Cloudinary too.
 *
 *   npm run cloudinary:setup
 *
 * Safe to re-run; existing items are skipped.
 */
import "dotenv/config";
import { TRANSFORMS, getCloudinary } from "../src/server/cloudinary";

async function main() {
  const cld = getCloudinary();

  for (const [name, definition] of Object.entries(TRANSFORMS)) {
    const tName = `fieldproof_${name}`;
    try {
      await cld.api.create_transformation(tName, definition);
      console.log(`✓ named transformation ${tName} = ${definition}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      if (/already exists/i.test(msg)) console.log(`· ${tName} already exists`);
      else console.error(`✗ ${tName}: ${msg}`);
    }
  }

  const fields = [
    { external_id: "fp_project_id", label: "FieldProof project", type: "string" },
    { external_id: "fp_site_id", label: "FieldProof site", type: "string" },
    {
      external_id: "fp_phase",
      label: "FieldProof phase",
      type: "enum",
      datasource: { values: ["before", "during", "after", "unknown"].map((v) => ({ external_id: v, value: v })) },
    },
    { external_id: "fp_verified", label: "FieldProof verified", type: "enum", datasource: { values: [{ external_id: "true", value: "true" }, { external_id: "false", value: "false" }] } },
  ];

  for (const f of fields) {
    try {
      await cld.api.add_metadata_field(f as never);
      console.log(`✓ metadata field ${f.external_id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      if (/already exists|external id .* exists/i.test(msg)) console.log(`· ${f.external_id} already exists`);
      else console.error(`✗ ${f.external_id}: ${msg}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
