/**
 * Whether an asset belongs to a named field location.
 *
 * An asset with a `locationId` belongs to that location and no other. Assets ingested before
 * locations existed have none; those fall back to the location's site.
 */
export function assetBelongsToLocation(
    asset: { locationId?: string | null; siteId: string | null },
    location: { id: string; siteId: string | null }
): boolean {
    if (asset.locationId) {
        return asset.locationId === location.id;
    }

    return Boolean(location.siteId) && asset.siteId === location.siteId;
}
