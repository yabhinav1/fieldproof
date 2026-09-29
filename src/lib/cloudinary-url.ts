/**
 * Same string as `TRANSFORMS.thumbnail` on the server, which records this exact derivation in
 * provenance when an asset is ingested. Keep the two in step.
 */
export const THUMBNAIL = "c_fill,g_auto,w_400,h_300/f_auto,q_auto";

/** Cover image of a project card, which is about twice as wide as a grid thumbnail. */
export const PROJECT_COVER = "c_fill,g_auto,w_960,h_510/f_auto,q_auto";

const UPLOAD_SEGMENT = "/image/upload/";

/**
 * Turns an original Cloudinary delivery URL into a derived one. Grids must not load originals:
 * field photos are several megabytes each. Anything that is not a Cloudinary upload URL is
 * returned untouched.
 */
export function cloudinaryVariant(url: string, transformation: string): string {
    const at = url.indexOf(UPLOAD_SEGMENT);

    if (at === -1 || !url.startsWith("https://res.cloudinary.com/")) {
        return url;
    }

    const head = url.slice(0, at + UPLOAD_SEGMENT.length);
    const tail = url.slice(at + UPLOAD_SEGMENT.length);

    return `${head}${transformation}/${tail}`;
}

export function thumbnailUrl(url: string): string {
    return cloudinaryVariant(url, THUMBNAIL);
}
