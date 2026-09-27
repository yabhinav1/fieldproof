"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

type Project = {
    id: string;
    name: string;
    description?: string | null;
};

type Site = {
    id: string;
    name: string;
    description?: string | null;
};

type Location = {
    id: string;
    projectId: string;
    siteId: string | null;
    name: string;
    lat: number | null;
    lng: number | null;
};

type Asset = {
    id: string;
    projectId: string;
    siteId: string | null;
    locationId?: string | null;
    secureUrl: string;
    cloudinaryPublicId?: string | null;
    createdAt?: string | null;
    exif?: Record<string, unknown> | null;
    format: string | null;
    width: number | null;
    height: number | null;
    phase: "before" | "during" | "after" | "unknown";
    capturedAt: string | null;
    aiTags: string[];
    aiCaption: string | null;
    verified: boolean;
    lat: number | null;
    lng: number | null;
    flags: unknown[];
    hasEmbedding: boolean;
};

type SignedUpload = {
    cloudName: string;
    apiKey: string;
    timestamp: number;
    signature: string;
    folder: string;
    params: Record<string, string>;
    uploadUrl: string;
};

const phaseOptions = [
    "all",
    "before",
    "during",
    "after",
    "unknown",
] as const;

export default function GalleryPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProject, setSelectedProject] = useState("");

    const [assets, setAssets] = useState<Asset[]>([]);
    const [sites, setSites] = useState<Site[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);

    const [loadingProjects, setLoadingProjects] = useState(true);
    const [loadingAssets, setLoadingAssets] = useState(false);
    const [loadingLocations, setLoadingLocations] = useState(false);

    const [error, setError] = useState("");

    const [phase, setPhase] =
        useState<(typeof phaseOptions)[number]>("all");

    const [verification, setVerification] = useState("all");

    const [selectedLocation, setSelectedLocation] = useState("");
    const [locationSearch, setLocationSearch] = useState("");

    const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
    const [assetDetails, setAssetDetails] = useState<Asset | null>(null);
    const [loadingAssetDetails, setLoadingAssetDetails] = useState(false);

    const [deletingAsset, setDeletingAsset] = useState(false);
    const [deleteError, setDeleteError] = useState("");

    const [showUpload, setShowUpload] = useState(false);

    /*
     * Upload state
     */
    const [uploadSite, setUploadSite] = useState("");
    const [uploadLocationId, setUploadLocationId] = useState("");
    const [uploadPhase, setUploadPhase] = useState<
        "before" | "during" | "after"
    >("before");

    const [uploadLocationSearch, setUploadLocationSearch] = useState("");
    const [creatingLocation, setCreatingLocation] = useState(false);
    const [newLocationName, setNewLocationName] = useState("");

    const [uploadFiles, setUploadFiles] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState("");
    const [uploadError, setUploadError] = useState("");

    /*
     * Load projects
     */
    useEffect(() => {
        let cancelled = false;

        async function loadProjects() {
            try {
                setLoadingProjects(true);
                setError("");

                const response = await fetch("/api/projects");

                if (!response.ok) {
                    throw new Error("Failed to load projects");
                }

                const result = await response.json();

                if (!cancelled) {
                    const data: Project[] = result.data ?? [];

                    setProjects(data);

                    if (data.length > 0) {
                        setSelectedProject(data[0].id);
                    }
                }
            } catch (err) {
                if (!cancelled) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Failed to load projects"
                    );
                }
            } finally {
                if (!cancelled) {
                    setLoadingProjects(false);
                }
            }
        }

        loadProjects();

        return () => {
            cancelled = true;
        };
    }, []);

    /*
     * Load project sites
     */
    useEffect(() => {
        if (!selectedProject) {
            setSites([]);
            return;
        }

        let cancelled = false;

        async function loadSites() {
            try {
                const response = await fetch(
                    `/api/projects/${selectedProject}`
                );

                if (!response.ok) {
                    throw new Error("Failed to load project details");
                }

                const result = await response.json();

                if (!cancelled) {
                    setSites(result.data?.sites ?? []);
                }
            } catch (err) {
                if (!cancelled) {
                    setSites([]);

                    setError(
                        err instanceof Error
                            ? err.message
                            : "Failed to load project details"
                    );
                }
            }
        }

        loadSites();

        return () => {
            cancelled = true;
        };
    }, [selectedProject]);

    /*
     * Load locations
     */
    useEffect(() => {
        if (!selectedProject) {
            setLocations([]);
            setSelectedLocation("");
            return;
        }

        let cancelled = false;

        async function loadLocations() {
            try {
                setLoadingLocations(true);

                const response = await fetch(
                    `/api/locations?projectId=${selectedProject}`
                );

                if (!response.ok) {
                    throw new Error("Failed to load locations");
                }

                const result = await response.json();

                if (!cancelled) {
                    setLocations(result.data ?? []);
                }
            } catch (err) {
                if (!cancelled) {
                    setLocations([]);

                    setError(
                        err instanceof Error
                            ? err.message
                            : "Failed to load locations"
                    );
                }
            } finally {
                if (!cancelled) {
                    setLoadingLocations(false);
                }
            }
        }

        loadLocations();

        return () => {
            cancelled = true;
        };
    }, [selectedProject]);

    /*
     * Load assets
     */
    async function refreshAssets() {
        if (!selectedProject) {
            setAssets([]);
            return;
        }

        try {
            setLoadingAssets(true);
            setError("");

            const params = new URLSearchParams({
                projectId: selectedProject,
                limit: "500",
            });

            if (phase !== "all") {
                params.set("phase", phase);
            }

            if (verification !== "all") {
                params.set("verified", verification);
            }

            const response = await fetch(
                `/api/assets?${params.toString()}`
            );

            if (!response.ok) {
                throw new Error("Failed to load assets");
            }

            const result = await response.json();

            setAssets(result.data ?? []);
        } catch (err) {
            setAssets([]);

            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to load assets"
            );
        } finally {
            setLoadingAssets(false);
        }
    }

    useEffect(() => {
        refreshAssets();

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedProject, phase, verification]);

    /*
     * Visible locations
     */
    const filteredLocations = useMemo(() => {
        const query = locationSearch.trim().toLowerCase();

        return locations.filter((location) => {
            if (!query) return true;

            return location.name.toLowerCase().includes(query);
        });
    }, [locations, locationSearch]);

    /*
     * Visible assets
     */
    const visibleAssets = useMemo(() => {
        if (!selectedLocation) {
            return assets;
        }

        const location = locations.find(
            (item) => item.id === selectedLocation
        );

        return assets.filter((asset) => {
            if (asset.locationId === selectedLocation) {
                return true;
            }

            /*
             * Legacy assets may not have locationId.
             * Fall back to the location's site.
             */
            if (
                location?.siteId &&
                asset.siteId === location.siteId
            ) {
                return true;
            }

            return false;
        });
    }, [assets, selectedLocation, locations]);

    /*
     * Location asset counts
     */
    const locationAssetCounts = useMemo(() => {
        const counts = new Map<
            string,
            {
                total: number;
                before: number;
                during: number;
                after: number;
                unknown: number;
            }
        >();

        for (const asset of assets) {
            if (!asset.locationId) continue;

            const current = counts.get(asset.locationId) ?? {
                total: 0,
                before: 0,
                during: 0,
                after: 0,
                unknown: 0,
            };

            current.total += 1;
            current[asset.phase] += 1;

            counts.set(asset.locationId, current);
        }

        return counts;
    }, [assets]);

    const selectedLocationData = locations.find(
        (location) => location.id === selectedLocation
    );

    /*
     * Open asset details
     */
    async function openAsset(asset: Asset) {
        setSelectedAsset(asset);
        setAssetDetails(null);
        setDeleteError("");
        setLoadingAssetDetails(true);

        try {
            const response = await fetch(`/api/assets/${asset.id}`);

            if (!response.ok) {
                throw new Error("Failed to load asset details");
            }

            const result = await response.json();

            setAssetDetails(result.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingAssetDetails(false);
        }
    }

    /*
     * Reset upload modal
     */
    function resetUploadState() {
        setUploadSite("");
        setUploadLocationId("");
        setUploadPhase("before");
        setUploadLocationSearch("");
        setCreatingLocation(false);
        setNewLocationName("");
        setUploadFiles([]);
        setUploadProgress("");
        setUploadError("");
    }

    /*
     * Create a location
     */
    async function createLocation() {
        if (!selectedProject) return;

        const name = newLocationName.trim();

        if (!name) {
            setUploadError("Enter a location name.");
            return;
        }

        try {
            setUploadError("");
            setCreatingLocation(true);

            const response = await fetch("/api/locations", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    projectId: selectedProject,
                    siteId: uploadSite || null,
                    name,
                    lat: null,
                    lng: null,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result?.error?.message ??
                        result?.message ??
                        "Failed to create location"
                );
            }

            const location: Location = result.data;

            setLocations((current) =>
                [...current, location].sort((a, b) =>
                    a.name.localeCompare(b.name)
                )
            );

            setUploadLocationId(location.id);
            setUploadLocationSearch(location.name);
            setNewLocationName("");
            setCreatingLocation(false);
        } catch (err) {
            setUploadError(
                err instanceof Error
                    ? err.message
                    : "Failed to create location"
            );

            setCreatingLocation(false);
        }
    }

    /*
     * Upload a file to Cloudinary
     */
    async function uploadToCloudinary(
        file: File,
        signed: SignedUpload
    ): Promise<string> {
        const formData = new FormData();

        formData.append("file", file);
        formData.append("api_key", signed.apiKey);
        formData.append("timestamp", String(signed.timestamp));
        formData.append("signature", signed.signature);

        for (const [key, value] of Object.entries(signed.params ?? {})) {
            formData.append(key, value);
        }

        const response = await fetch(signed.uploadUrl, {
            method: "POST",
            body: formData,
        });

        if (!response.ok) {
            const body = await response.text();

            throw new Error(
                body || `Cloudinary upload failed for ${file.name}`
            );
        }

        const result = await response.json();

        if (!result.public_id) {
            throw new Error(
                `Cloudinary did not return a public ID for ${file.name}`
            );
        }

        return result.public_id;
    }

    /*
     * Upload evidence
     */
    async function handleUpload() {
        if (!selectedProject) {
            setUploadError("Select a project first.");
            return;
        }

        if (!uploadSite) {
            setUploadError("Select a site.");
            return;
        }

        if (!uploadLocationId) {
            setUploadError("Select or create a field location.");
            return;
        }

        if (uploadFiles.length === 0) {
            setUploadError("Select at least one image.");
            return;
        }

        try {
            setUploading(true);
            setUploadError("");
            setUploadProgress("Preparing upload...");

            const signResponse = await fetch("/api/uploads/sign", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    projectId: selectedProject,
                    siteId: uploadSite,
                }),
            });

            const signResult = await signResponse.json();

            if (!signResponse.ok) {
                throw new Error(
                    signResult?.error?.message ??
                        signResult?.message ??
                        "Failed to prepare upload"
                );
            }

            const signed: SignedUpload = signResult.data;

            const publicIds: string[] = [];

            for (
                let index = 0;
                index < uploadFiles.length;
                index += 1
            ) {
                const file = uploadFiles[index];

                setUploadProgress(
                    `Uploading ${index + 1} of ${uploadFiles.length}: ${file.name}`
                );

                const publicId = await uploadToCloudinary(
                    file,
                    signed
                );

                publicIds.push(publicId);
            }

            setUploadProgress(
                "Analyzing and organizing evidence..."
            );

            const ingestResponse = await fetch(
                "/api/assets/ingest",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        projectId: selectedProject,
                        publicIds,
                        siteId: uploadSite,
                        locationId: uploadLocationId,
                        phase: uploadPhase,
                        analyze: true,
                    }),
                }
            );

            const ingestResult = await ingestResponse.json();

            if (!ingestResponse.ok) {
                throw new Error(
                    ingestResult?.error?.message ??
                        ingestResult?.message ??
                        "Failed to ingest uploaded evidence"
                );
            }

            const summary = ingestResult.data?.summary;

            setUploadProgress(
                `Complete — ${
                    summary?.created ?? publicIds.length
                } evidence ${
                    summary?.created === 1 ? "item" : "items"
                } added.`
            );

            await refreshAssets();

            const locationResponse = await fetch(
                `/api/locations?projectId=${selectedProject}`
            );

            if (locationResponse.ok) {
                const locationResult =
                    await locationResponse.json();

                setLocations(locationResult.data ?? []);
            }

            window.setTimeout(() => {
                setShowUpload(false);
                resetUploadState();
            }, 1000);
        } catch (err) {
            setUploadError(
                err instanceof Error
                    ? err.message
                    : "Upload failed"
            );
        } finally {
            setUploading(false);
        }
    }

    /*
     * Delete evidence
     */
    async function handleDeleteAsset() {
        if (!selectedAsset) return;

        const confirmed = window.confirm(
            "Delete this evidence? This action cannot be undone."
        );

        if (!confirmed) {
            return;
        }

        try {
            setDeletingAsset(true);
            setDeleteError("");

            const response = await fetch(
                `/api/assets/${selectedAsset.id}`,
                {
                    method: "DELETE",
                }
            );

            const result = await response
                .json()
                .catch(() => null);

            if (!response.ok) {
                throw new Error(
                    result?.error?.message ??
                        result?.message ??
                        "Failed to delete evidence"
                );
            }

            setSelectedAsset(null);
            setAssetDetails(null);

            await refreshAssets();
        } catch (err) {
            setDeleteError(
                err instanceof Error
                    ? err.message
                    : "Failed to delete evidence"
            );
        } finally {
            setDeletingAsset(false);
        }
    }

    return (
        <main className="min-h-screen bg-background">
            {/* Header */}
            <section className="border-b bg-background">
                <div className="mx-auto max-w-7xl px-6 py-10">
                    <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-2xl">
                            <div className="mb-3 flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-foreground" />

                                <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                                    Evidence library
                                </span>
                            </div>

                            <h1 className="text-4xl font-semibold tracking-tight">
                                Field Gallery
                            </h1>

                            <p className="mt-3 text-base leading-7 text-muted-foreground">
                                Browse field evidence across sites,
                                inspect verification status, and trace
                                changes through each project phase.
                            </p>
                        </div>

                        <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
                            <div className="w-full sm:w-80">
                                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    Active project
                                </label>

                                <select
                                    value={selectedProject}
                                    onChange={(event) => {
                                        setSelectedProject(
                                            event.target.value
                                        );

                                        setSelectedLocation("");
                                        setLocationSearch("");
                                    }}
                                    disabled={
                                        loadingProjects ||
                                        projects.length === 0
                                    }
                                    className="h-11 w-full rounded-lg border bg-background px-3.5 text-sm font-medium outline-none transition focus:ring-2 focus:ring-ring"
                                >
                                    {loadingProjects ? (
                                        <option>
                                            Loading projects...
                                        </option>
                                    ) : projects.length === 0 ? (
                                        <option>
                                            No projects found
                                        </option>
                                    ) : (
                                        projects.map((project) => (
                                            <option
                                                key={project.id}
                                                value={project.id}
                                            >
                                                {project.name}
                                            </option>
                                        ))
                                    )}
                                </select>
                            </div>

                            <button
                                type="button"
                                onClick={() => {
                                    resetUploadState();
                                    setShowUpload(true);
                                }}
                                className="h-11 self-end rounded-lg bg-foreground px-5 text-sm font-medium text-background transition hover:opacity-90"
                            >
                                + Add evidence
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Location + filters */}
            <section className="border-b bg-background">
                <div className="mx-auto max-w-7xl px-6 py-4">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
                        <div className="relative min-w-0 flex-1 xl:max-w-xl">
                            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Field location
                            </label>

                            <div className="relative">
                                <input
                                    value={locationSearch}
                                    onChange={(event) => {
                                        setLocationSearch(
                                            event.target.value
                                        );
                                    }}
                                    onFocus={() => {
                                        if (
                                            selectedLocationData
                                        ) {
                                            setLocationSearch(
                                                selectedLocationData.name
                                            );
                                        }
                                    }}
                                    placeholder="Search or select a field location..."
                                    className="h-11 w-full rounded-lg border bg-background px-3.5 pr-20 text-sm outline-none focus:ring-2 focus:ring-ring"
                                />

                                {locationSearch && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setLocationSearch("");
                                            setSelectedLocation("");
                                        }}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground hover:text-foreground"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>

                            {locationSearch && (
                                <div className="absolute left-0 right-0 top-[4.7rem] z-30 max-h-80 overflow-y-auto rounded-xl border bg-background p-1 shadow-xl">
                                    {loadingLocations ? (
                                        <div className="px-3 py-4 text-sm text-muted-foreground">
                                            Loading locations...
                                        </div>
                                    ) : filteredLocations.length ===
                                      0 ? (
                                        <div className="px-3 py-4">
                                            <p className="text-sm font-medium">
                                                No matching locations
                                            </p>

                                            <p className="mt-1 text-xs text-muted-foreground">
                                                Create a location while
                                                adding evidence.
                                            </p>
                                        </div>
                                    ) : (
                                        filteredLocations.map(
                                            (location) => {
                                                const counts =
                                                    locationAssetCounts.get(
                                                        location.id
                                                    ) ?? {
                                                        total: 0,
                                                        before: 0,
                                                        during: 0,
                                                        after: 0,
                                                        unknown: 0,
                                                    };

                                                return (
                                                    <button
                                                        key={
                                                            location.id
                                                        }
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedLocation(
                                                                location.id
                                                            );

                                                            setLocationSearch(
                                                                location.name
                                                            );
                                                        }}
                                                        className={`w-full rounded-lg px-3 py-3 text-left transition hover:bg-muted ${
                                                            selectedLocation ===
                                                            location.id
                                                                ? "bg-muted"
                                                                : ""
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-between gap-4">
                                                            <div className="min-w-0">
                                                                <p className="truncate text-sm font-medium">
                                                                    {
                                                                        location.name
                                                                    }
                                                                </p>

                                                                <p className="mt-1 text-xs text-muted-foreground">
                                                                    {
                                                                        counts.total
                                                                    }{" "}
                                                                    evidence ·{" "}
                                                                    {
                                                                        counts.before
                                                                    }{" "}
                                                                    before ·{" "}
                                                                    {
                                                                        counts.during
                                                                    }{" "}
                                                                    during ·{" "}
                                                                    {
                                                                        counts.after
                                                                    }{" "}
                                                                    after
                                                                </p>
                                                            </div>

                                                            {selectedLocation ===
                                                                location.id && (
                                                                <span className="text-xs font-medium">
                                                                    Selected
                                                                </span>
                                                            )}
                                                        </div>
                                                    </button>
                                                );
                                            }
                                        )
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Phase filter */}
                        <div className="flex items-center gap-2">
                            <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Phase
                            </span>

                            <select
                                value={phase}
                                onChange={(event) =>
                                    setPhase(
                                        event.target
                                            .value as (typeof phaseOptions)[number]
                                    )
                                }
                                className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                            >
                                <option value="all">
                                    All phases
                                </option>

                                <option value="before">
                                    Before
                                </option>

                                <option value="during">
                                    During
                                </option>

                                <option value="after">
                                    After
                                </option>

                                <option value="unknown">
                                    Unknown
                                </option>
                            </select>
                        </div>

                        {/* Verification */}
                        <div className="flex items-center gap-2">
                            <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Verification
                            </span>

                            <select
                                value={verification}
                                onChange={(event) =>
                                    setVerification(
                                        event.target.value
                                    )
                                }
                                className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                            >
                                <option value="all">
                                    All
                                </option>

                                <option value="true">
                                    Verified
                                </option>

                                <option value="false">
                                    Unverified
                                </option>
                            </select>
                        </div>

                        <div className="ml-auto flex items-center gap-2">
                            <span className="text-sm font-medium">
                                {visibleAssets.length}
                            </span>

                            <span className="text-sm text-muted-foreground">
                                {visibleAssets.length === 1
                                    ? "asset"
                                    : "assets"}
                            </span>
                        </div>
                    </div>

                    {selectedLocationData && (
                        <div className="mt-4 flex flex-col gap-3 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                                    Selected field location
                                </p>

                                <h2 className="mt-1 text-base font-semibold">
                                    {
                                        selectedLocationData.name
                                    }
                                </h2>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {(
                                    [
                                        "before",
                                        "during",
                                        "after",
                                        "unknown",
                                    ] as const
                                ).map((currentPhase) => {
                                    const count =
                                        visibleAssets.filter(
                                            (asset) =>
                                                asset.phase ===
                                                currentPhase
                                        ).length;

                                    return (
                                        <span
                                            key={currentPhase}
                                            className="rounded-full border bg-background px-3 py-1 text-xs"
                                        >
                                            {capitalize(
                                                currentPhase
                                            )}{" "}
                                            {count}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* Content */}
            <section className="mx-auto max-w-7xl px-6 py-8">
                {error && (
                    <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                        {error}
                    </div>
                )}

                {loadingAssets ? (
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                        {Array.from({ length: 8 }).map(
                            (_, index) => (
                                <div
                                    key={index}
                                    className="aspect-[4/3] animate-pulse rounded-xl bg-muted"
                                />
                            )
                        )}
                    </div>
                ) : visibleAssets.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-12 text-center">
                        <h2 className="text-lg font-medium">
                            No evidence found
                        </h2>

                        <p className="mt-2 text-sm text-muted-foreground">
                            Try changing the project, location,
                            phase, or verification filters.
                        </p>
                    </div>
                ) : selectedLocation ? (
                    <LocationEvidence
                        assets={visibleAssets}
                        locations={locations}
                        onOpenAsset={openAsset}
                    />
                ) : (
                    <div className="space-y-12">
                        {sites.map((site) => {
                            const siteAssets =
                                visibleAssets.filter(
                                    (asset) =>
                                        asset.siteId === site.id
                                );

                            if (siteAssets.length === 0) {
                                return null;
                            }

                            return (
                                <section key={site.id}>
                                    <div className="mb-5 flex items-end justify-between">
                                        <div>
                                            <h2 className="text-xl font-semibold tracking-tight">
                                                {site.name}
                                            </h2>

                                            {site.description && (
                                                <p className="mt-1 text-sm text-muted-foreground">
                                                    {
                                                        site.description
                                                    }
                                                </p>
                                            )}
                                        </div>

                                        <span className="text-sm text-muted-foreground">
                                            {siteAssets.length}{" "}
                                            {siteAssets.length ===
                                            1
                                                ? "asset"
                                                : "assets"}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                                        {siteAssets.map(
                                            (asset) => (
                                                <AssetCard
                                                    key={asset.id}
                                                    asset={asset}
                                                    locationName={getLocationName(
                                                        asset.locationId,
                                                        locations
                                                    )}
                                                    onClick={() =>
                                                        openAsset(
                                                            asset
                                                        )
                                                    }
                                                />
                                            )
                                        )}
                                    </div>
                                </section>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* Asset details */}
            {selectedAsset && (
                <AssetDetails
                    asset={
                        assetDetails ??
                        selectedAsset
                    }
                    locationName={getLocationName(
                        (
                            assetDetails ??
                            selectedAsset
                        ).locationId,
                        locations
                    )}
                    loading={loadingAssetDetails}
                    deleting={deletingAsset}
                    deleteError={deleteError}
                    onDelete={handleDeleteAsset}
                    onClose={() => {
                        setSelectedAsset(null);
                        setAssetDetails(null);
                        setDeleteError("");
                    }}
                />
            )}

            {/* Upload modal */}
            {showUpload && (
                <UploadModal
                    sites={sites}
                    locations={locations}
                    selectedSite={uploadSite}
                    setSelectedSite={setUploadSite}
                    selectedLocationId={
                        uploadLocationId
                    }
                    setSelectedLocationId={
                        setUploadLocationId
                    }
                    uploadPhase={uploadPhase}
                    setUploadPhase={setUploadPhase}
                    locationSearch={
                        uploadLocationSearch
                    }
                    setLocationSearch={
                        setUploadLocationSearch
                    }
                    creatingLocation={
                        creatingLocation
                    }
                    setCreatingLocation={
                        setCreatingLocation
                    }
                    newLocationName={
                        newLocationName
                    }
                    setNewLocationName={
                        setNewLocationName
                    }
                    files={uploadFiles}
                    setFiles={setUploadFiles}
                    uploading={uploading}
                    progress={uploadProgress}
                    error={uploadError}
                    onCreateLocation={createLocation}
                    onUpload={handleUpload}
                    onClose={() => {
                        if (!uploading) {
                            setShowUpload(false);
                            resetUploadState();
                        }
                    }}
                />
            )}
        </main>
    );
}

/*
 * Location evidence
 */
function LocationEvidence({
    assets,
    locations,
    onOpenAsset,
}: {
    assets: Asset[];
    locations: Location[];
    onOpenAsset: (asset: Asset) => void;
}) {
    const phases = [
        {
            key: "before" as const,
            title: "Before",
            description:
                "Evidence captured before the intervention.",
        },
        {
            key: "during" as const,
            title: "During",
            description:
                "Evidence captured while work was underway.",
        },
        {
            key: "after" as const,
            title: "After",
            description:
                "Evidence captured after the intervention.",
        },
        {
            key: "unknown" as const,
            title: "Unclassified",
            description:
                "Evidence without a confirmed phase.",
        },
    ];

    return (
        <div className="space-y-12">
            {phases.map((phase) => {
                const phaseAssets = assets.filter(
                    (asset) => asset.phase === phase.key
                );

                if (phaseAssets.length === 0) {
                    return null;
                }

                return (
                    <section key={phase.key}>
                        <div className="mb-5 flex items-end justify-between">
                            <div>
                                <h2 className="text-xl font-semibold tracking-tight">
                                    {phase.title}
                                </h2>

                                <p className="mt-1 text-sm text-muted-foreground">
                                    {
                                        phase.description
                                    }
                                </p>
                            </div>

                            <span className="text-sm text-muted-foreground">
                                {phaseAssets.length}{" "}
                                {phaseAssets.length === 1
                                    ? "asset"
                                    : "assets"}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                            {phaseAssets.map((asset) => (
                                <AssetCard
                                    key={asset.id}
                                    asset={asset}
                                    locationName={getLocationName(
                                        asset.locationId,
                                        locations
                                    )}
                                    onClick={() =>
                                        onOpenAsset(asset)
                                    }
                                />
                            ))}
                        </div>
                    </section>
                );
            })}
        </div>
    );
}

/*
 * Asset card
 */
function AssetCard({
    asset,
    locationName,
    onClick,
}: {
    asset: Asset;
    locationName: string | null;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="group overflow-hidden rounded-xl border bg-card text-left transition hover:-translate-y-0.5 hover:shadow-md"
        >
            <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                <img
                    src={asset.secureUrl}
                    alt={
                        asset.aiCaption ||
                        "Field evidence"
                    }
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                />

                <div className="absolute left-3 top-3">
                    <PhaseBadge phase={asset.phase} />
                </div>

                <div className="absolute right-3 top-3">
                    <span
                        className={`rounded-full border bg-background/90 px-2 py-1 text-[11px] font-medium backdrop-blur ${
                            asset.verified
                                ? "text-foreground"
                                : "text-muted-foreground"
                        }`}
                    >
                        {asset.verified
                            ? "Verified"
                            : "Unverified"}
                    </span>
                </div>
            </div>

            <div className="p-4">
                {locationName && (
                    <p className="mb-1 truncate text-xs font-medium text-muted-foreground">
                        {locationName}
                    </p>
                )}

                <p className="line-clamp-2 text-sm font-medium">
                    {asset.aiCaption ||
                        "Field evidence"}
                </p>

                <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span>
                        {asset.capturedAt
                            ? new Date(
                                  asset.capturedAt
                              ).toLocaleDateString()
                            : "Date unavailable"}
                    </span>

                    {asset.aiTags?.length > 0 && (
                        <span>
                            {asset.aiTags.length} tags
                        </span>
                    )}
                </div>
            </div>
        </button>
    );
}

/*
 * Phase badge
 */
function PhaseBadge({
    phase,
}: {
    phase: Asset["phase"];
}) {
    const labels: Record<
        Asset["phase"],
        string
    > = {
        before: "Before",
        during: "During",
        after: "After",
        unknown: "Unknown",
    };

    return (
        <span className="rounded-full border bg-background/90 px-2.5 py-1 text-[11px] font-medium backdrop-blur">
            {labels[phase]}
        </span>
    );
}

/*
 * Upload modal
 */
function UploadModal({
    sites,
    locations,
    selectedSite,
    setSelectedSite,
    selectedLocationId,
    setSelectedLocationId,
    uploadPhase,
    setUploadPhase,
    locationSearch,
    setLocationSearch,
    creatingLocation,
    setCreatingLocation,
    newLocationName,
    setNewLocationName,
    files,
    setFiles,
    uploading,
    progress,
    error,
    onCreateLocation,
    onUpload,
    onClose,
}: {
    sites: Site[];
    locations: Location[];
    selectedSite: string;
    setSelectedSite: (
        value: string
    ) => void;
    selectedLocationId: string;
    setSelectedLocationId: (
        value: string
    ) => void;
    uploadPhase:
        | "before"
        | "during"
        | "after";
    setUploadPhase: (
        value:
            | "before"
            | "during"
            | "after"
    ) => void;
    locationSearch: string;
    setLocationSearch: (
        value: string
    ) => void;
    creatingLocation: boolean;
    setCreatingLocation: (
        value: boolean
    ) => void;
    newLocationName: string;
    setNewLocationName: (
        value: string
    ) => void;
    files: File[];
    setFiles: (
        files: File[]
    ) => void;
    uploading: boolean;
    progress: string;
    error: string;
    onCreateLocation: () => void;
    onUpload: () => void;
    onClose: () => void;
}) {
    const visibleLocations =
        locations.filter((location) => {
            if (
                selectedSite &&
                location.siteId !== selectedSite
            ) {
                return false;
            }

            if (!locationSearch.trim()) {
                return true;
            }

            return location.name
                .toLowerCase()
                .includes(
                    locationSearch
                        .trim()
                        .toLowerCase()
                );
        });

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border bg-background shadow-2xl"
                onClick={(event) =>
                    event.stopPropagation()
                }
            >
                <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-background/95 px-6 py-5 backdrop-blur">
                    <div>
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                            Evidence ingest
                        </p>

                        <h2 className="mt-1 text-xl font-semibold tracking-tight">
                            Add field evidence
                        </h2>

                        <p className="mt-1 text-sm text-muted-foreground">
                            Assign your evidence to a
                            reusable field location.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        disabled={uploading}
                        className="rounded-lg border px-3 py-1.5 text-sm transition hover:bg-muted disabled:opacity-50"
                    >
                        Close
                    </button>
                </div>

                <div className="space-y-6 p-6">
                    {/* Site */}
                    <section>
                        <label className="mb-2 block text-sm font-medium">
                            Field site
                        </label>

                        <select
                            value={selectedSite}
                            onChange={(event) => {
                                setSelectedSite(
                                    event.target.value
                                );

                                setSelectedLocationId(
                                    ""
                                );

                                setLocationSearch("");
                            }}
                            disabled={uploading}
                            className="h-11 w-full rounded-lg border bg-background px-3.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                        >
                            <option value="">
                                Select a site
                            </option>

                            {sites.map((site) => (
                                <option
                                    key={site.id}
                                    value={site.id}
                                >
                                    {site.name}
                                </option>
                            ))}
                        </select>
                    </section>

                    {/* Location */}
                    <section>
                        <label className="mb-2 block text-sm font-medium">
                            Field location
                        </label>

                        {!creatingLocation ? (
                            <>
                                <div className="relative">
                                    <input
                                        value={
                                            locationSearch
                                        }
                                        onChange={(
                                            event
                                        ) => {
                                            setLocationSearch(
                                                event.target
                                                    .value
                                            );

                                            setSelectedLocationId(
                                                ""
                                            );
                                        }}
                                        disabled={
                                            uploading ||
                                            !selectedSite
                                        }
                                        placeholder={
                                            selectedSite
                                                ? "Search or select a field location..."
                                                : "Select a site first"
                                        }
                                        className="h-11 w-full rounded-lg border bg-background px-3.5 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                                    />

                                    {selectedSite &&
                                        !selectedLocationId && (
                                            <div className="absolute left-0 right-0 top-12 z-20 max-h-56 overflow-y-auto rounded-lg border bg-background p-1 shadow-xl">
                                                {visibleLocations.length >
                                                0 ? (
                                                    visibleLocations.map(
                                                        (
                                                            location
                                                        ) => (
                                                            <button
                                                                key={
                                                                    location.id
                                                                }
                                                                type="button"
                                                                onClick={() => {
                                                                    setSelectedLocationId(
                                                                        location.id
                                                                    );

                                                                    setLocationSearch(
                                                                        location.name
                                                                    );
                                                                }}
                                                                className="w-full rounded-md px-3 py-2.5 text-left text-sm hover:bg-muted"
                                                            >
                                                                {
                                                                    location.name
                                                                }
                                                            </button>
                                                        )
                                                    )
                                                ) : (
                                                    <p className="px-3 py-3 text-sm text-muted-foreground">
                                                        No existing
                                                        location
                                                        found.
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                </div>

                                {selectedLocationId && (
                                    <div className="mt-3 flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2.5">
                                        <div>
                                            <p className="text-xs text-muted-foreground">
                                                Selected
                                                location
                                            </p>

                                            <p className="text-sm font-medium">
                                                {
                                                    locations.find(
                                                        (
                                                            location
                                                        ) =>
                                                            location.id ===
                                                            selectedLocationId
                                                    )
                                                        ?.name
                                                }
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedLocationId(
                                                    ""
                                                );

                                                setLocationSearch(
                                                    ""
                                                );
                                            }}
                                            disabled={
                                                uploading
                                            }
                                            className="text-xs font-medium text-muted-foreground hover:text-foreground"
                                        >
                                            Change
                                        </button>
                                    </div>
                                )}

                                <button
                                    type="button"
                                    onClick={() =>
                                        setCreatingLocation(
                                            true
                                        )
                                    }
                                    disabled={
                                        uploading ||
                                        !selectedSite
                                    }
                                    className="mt-3 text-sm font-medium underline underline-offset-4 disabled:opacity-50"
                                >
                                    + Create new location
                                </button>
                            </>
                        ) : (
                            <div className="rounded-xl border bg-muted/20 p-4">
                                <p className="text-sm font-medium">
                                    Create a new field
                                    location
                                </p>

                                <p className="mt-1 text-xs text-muted-foreground">
                                    Give this location a
                                    reusable name so future
                                    evidence can be assigned
                                    to it.
                                </p>

                                <input
                                    value={
                                        newLocationName
                                    }
                                    onChange={(event) =>
                                        setNewLocationName(
                                            event.target
                                                .value
                                        )
                                    }
                                    placeholder="e.g. Kudsia Ghat — North Bank"
                                    disabled={uploading}
                                    className="mt-4 h-11 w-full rounded-lg border bg-background px-3.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                                />

                                <div className="mt-3 flex gap-2">
                                    <button
                                        type="button"
                                        onClick={
                                            onCreateLocation
                                        }
                                        disabled={
                                            uploading ||
                                            !newLocationName.trim()
                                        }
                                        className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
                                    >
                                        Create location
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setCreatingLocation(
                                                false
                                            );

                                            setNewLocationName(
                                                ""
                                            );
                                        }}
                                        disabled={
                                            uploading
                                        }
                                        className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </section>

                    {/* Evidence phase */}
                    <section>
                        <label className="mb-2 block text-sm font-medium">
                            Evidence phase
                        </label>

                        <select
                            value={uploadPhase}
                            onChange={(event) =>
                                setUploadPhase(
                                    event.target
                                        .value as
                                        | "before"
                                        | "during"
                                        | "after"
                                )
                            }
                            disabled={uploading}
                            className="h-11 w-full rounded-lg border bg-background px-3.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                        >
                            <option value="before">
                                Before
                            </option>

                            <option value="during">
                                During
                            </option>

                            <option value="after">
                                After
                            </option>
                        </select>

                        <p className="mt-2 text-xs text-muted-foreground">
                            Choose the project phase this
                            evidence belongs to.
                        </p>
                    </section>

                    {/* Files */}
                    <section>
                        <label className="mb-2 block text-sm font-medium">
                            Evidence images
                        </label>

                        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center transition hover:bg-muted/30">
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                disabled={uploading}
                                className="hidden"
                                onChange={(event) => {
                                    setFiles(
                                        Array.from(
                                            event.target
                                                .files ?? []
                                        )
                                    );
                                }}
                            />

                            <span className="text-sm font-medium">
                                Choose field images
                            </span>

                            <span className="mt-1 text-xs text-muted-foreground">
                                JPG, PNG, WebP and other
                                supported image formats
                            </span>
                        </label>

                        {files.length > 0 && (
                            <div className="mt-3 rounded-lg border bg-muted/20 p-3">
                                <p className="text-sm font-medium">
                                    {files.length}{" "}
                                    {files.length === 1
                                        ? "image"
                                        : "images"}{" "}
                                    selected
                                </p>

                                <div className="mt-2 max-h-28 space-y-1 overflow-y-auto">
                                    {files.map(
                                        (file) => (
                                            <p
                                                key={`${file.name}-${file.size}`}
                                                className="truncate text-xs text-muted-foreground"
                                            >
                                                {
                                                    file.name
                                                }
                                            </p>
                                        )
                                    )}
                                </div>
                            </div>
                        )}
                    </section>

                    {/* Error */}
                    {error && (
                        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                            {error}
                        </div>
                    )}

                    {/* Progress */}
                    {progress && (
                        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                            {progress}
                        </div>
                    )}

                    {/* Action */}
                    <div className="flex justify-end gap-3 border-t pt-5">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={uploading}
                            className="rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
                        >
                            Cancel
                        </button>

                        <button
                            type="button"
                            onClick={onUpload}
                            disabled={
                                uploading ||
                                !selectedSite ||
                                !selectedLocationId ||
                                files.length === 0
                            }
                            className="rounded-lg bg-foreground px-5 py-2.5 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {uploading
                                ? "Uploading..."
                                : `Upload ${
                                      files.length > 0
                                          ? `${files.length} `
                                          : ""
                                  }evidence`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/*
 * Asset details
 */
function AssetDetails({
    asset,
    locationName,
    loading,
    deleting,
    deleteError,
    onDelete,
    onClose,
}: {
    asset: Asset;
    locationName: string | null;
    loading: boolean;
    deleting: boolean;
    deleteError: string;
    onDelete: () => void;
    onClose: () => void;
}) {
    const exif = asset.exif ?? {};

    return (
        <div
            className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="mx-auto max-w-5xl overflow-hidden rounded-2xl border bg-background shadow-2xl"
                onClick={(event) =>
                    event.stopPropagation()
                }
            >
                <div className="flex items-start justify-between gap-4 border-b px-6 py-5">
                    <div>
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                            Evidence details
                        </p>

                        <h2 className="mt-1 text-xl font-semibold tracking-tight">
                            Asset provenance
                        </h2>

                        <p className="mt-1 text-sm text-muted-foreground">
                            Inspect metadata, AI interpretation,
                            verification, and source information.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        disabled={deleting}
                        className="rounded-lg border px-3 py-1.5 text-sm transition hover:bg-muted disabled:opacity-50"
                    >
                        Close
                    </button>
                </div>

                <div className="grid gap-0 md:grid-cols-[1.15fr_0.85fr]">
                    <div className="bg-black">
                        <img
                            src={asset.secureUrl}
                            alt={
                                asset.aiCaption ||
                                "Field evidence"
                            }
                            className="max-h-[75vh] w-full object-contain"
                        />
                    </div>

                    <div className="space-y-7 p-6">
                        {loading && (
                            <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                                Loading latest asset
                                metadata...
                            </div>
                        )}

                        {/* Status */}
                        <section>
                            <div className="flex flex-wrap items-center gap-2">
                                <PhaseBadge
                                    phase={asset.phase}
                                />

                                <span
                                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                                        asset.verified
                                            ? "bg-foreground text-background"
                                            : "bg-muted text-muted-foreground"
                                    }`}
                                >
                                    {asset.verified
                                        ? "Verified evidence"
                                        : "Verification pending"}
                                </span>
                            </div>
                        </section>

                        {/* Location */}
                        {locationName && (
                            <section>
                                <SectionLabel>
                                    Field location
                                </SectionLabel>

                                <div className="mt-3 rounded-xl border bg-muted/20 p-4">
                                    <p className="text-sm font-medium">
                                        {locationName}
                                    </p>

                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Evidence assigned to
                                        this location can be
                                        compared across
                                        phases.
                                    </p>
                                </div>
                            </section>
                        )}

                        {/* AI */}
                        <section>
                            <SectionLabel>
                                AI interpretation
                            </SectionLabel>

                            <p className="mt-3 text-sm leading-6">
                                {asset.aiCaption ||
                                    "No AI-generated caption is available for this asset."}
                            </p>

                            {asset.aiTags?.length > 0 && (
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {asset.aiTags.map(
                                        (tag) => (
                                            <span
                                                key={tag}
                                                className="rounded-full border bg-muted/30 px-2.5 py-1 text-xs"
                                            >
                                                {tag}
                                            </span>
                                        )
                                    )}
                                </div>
                            )}
                        </section>

                        {/* Metadata */}
                        <section>
                            <SectionLabel>
                                Capture metadata
                            </SectionLabel>

                            <div className="mt-3 grid grid-cols-2 gap-3">
                                <MetadataItem
                                    label="Captured"
                                    value={
                                        asset.capturedAt
                                            ? formatDate(
                                                  asset.capturedAt
                                              )
                                            : "Unavailable"
                                    }
                                />

                                <MetadataItem
                                    label="Dimensions"
                                    value={
                                        asset.width &&
                                        asset.height
                                            ? `${asset.width} × ${asset.height}`
                                            : "Unavailable"
                                    }
                                />

                                <MetadataItem
                                    label="Format"
                                    value={
                                        asset.format
                                            ? asset.format.toUpperCase()
                                            : "Unavailable"
                                    }
                                />

                                <MetadataItem
                                    label="Location"
                                    value={
                                        asset.lat !=
                                            null &&
                                        asset.lng !=
                                            null
                                            ? `${asset.lat.toFixed(
                                                  5
                                              )}, ${asset.lng.toFixed(
                                                  5
                                              )}`
                                            : "Unavailable"
                                    }
                                />
                            </div>
                        </section>

                        {/* Provenance */}
                        <section>
                            <SectionLabel>
                                Provenance
                            </SectionLabel>

                            <div className="mt-3 space-y-3">
                                <ProvenanceRow
                                    label="Asset ID"
                                    value={
                                        asset.id
                                    }
                                />

                                <ProvenanceRow
                                    label="Cloudinary ID"
                                    value={
                                        asset.cloudinaryPublicId ??
                                        "Unavailable"
                                    }
                                />

                                <ProvenanceRow
                                    label="Uploaded"
                                    value={
                                        asset.createdAt
                                            ? formatDate(
                                                  asset.createdAt
                                              )
                                            : "Unavailable"
                                    }
                                />

                                <ProvenanceRow
                                    label="Embedding"
                                    value={
                                        asset.hasEmbedding
                                            ? "Available"
                                            : "Not generated"
                                    }
                                />
                            </div>

                            {asset.secureUrl && (
                                <a
                                    href={
                                        asset.secureUrl
                                    }
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-4 inline-flex text-sm font-medium underline underline-offset-4"
                                >
                                    Open original evidence ↗
                                </a>
                            )}
                        </section>

                        {/* EXIF */}
                        <section>
                            <SectionLabel>
                                EXIF metadata
                            </SectionLabel>

                            {Object.keys(exif)
                                .length === 0 ? (
                                <p className="mt-3 text-sm text-muted-foreground">
                                    No EXIF metadata is
                                    available for this
                                    asset.
                                </p>
                            ) : (
                                <div className="mt-3 space-y-2 rounded-xl border bg-muted/20 p-4">
                                    {Object.entries(
                                        exif
                                    ).map(
                                        ([
                                            key,
                                            value,
                                        ]) => (
                                            <div
                                                key={key}
                                                className="flex items-start justify-between gap-4 text-xs"
                                            >
                                                <span className="font-medium">
                                                    {key}
                                                </span>

                                                <span className="text-right text-muted-foreground">
                                                    {formatMetadataValue(
                                                        value
                                                    )}
                                                </span>
                                            </div>
                                        )
                                    )}
                                </div>
                            )}
                        </section>

                        {/* Delete */}
                        <section className="border-t pt-6">
                            <p className="text-xs font-medium uppercase tracking-[0.14em] text-destructive">
                                Danger zone
                            </p>

                            <p className="mt-2 text-sm text-muted-foreground">
                                Permanently remove this evidence
                                from the project.
                            </p>

                            {deleteError && (
                                <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                                    {deleteError}
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={onDelete}
                                disabled={deleting}
                                className="mt-4 w-full rounded-lg border border-destructive/30 px-4 py-2.5 text-sm font-medium text-destructive transition hover:bg-destructive/5 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {deleting
                                    ? "Deleting evidence..."
                                    : "Delete evidence"}
                            </button>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}

function SectionLabel({
    children,
}: {
    children: ReactNode;
}) {
    return (
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {children}
        </p>
    );
}

function MetadataItem({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {label}
            </p>

            <p className="mt-1 text-sm font-medium">
                {value}
            </p>
        </div>
    );
}

function ProvenanceRow({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {label}
            </p>

            <p className="mt-1 break-all text-xs font-medium">
                {value}
            </p>
        </div>
    );
}

function capitalize(value: string) {
    return (
        value.charAt(0).toUpperCase() +
        value.slice(1)
    );
}

function formatDate(value: string) {
    try {
        return new Intl.DateTimeFormat("en-IN", {
            dateStyle: "medium",
        }).format(new Date(value));
    } catch {
        return value;
    }
}

function formatMetadataValue(value: unknown) {
    if (value == null) {
        return "Unavailable";
    }

    if (typeof value === "object") {
        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    }

    return String(value);
}

function getLocationName(
    locationId: string | null | undefined,
    locations: Location[]
) {
    if (!locationId) {
        return null;
    }

    return (
        locations.find(
            (location) => location.id === locationId
        )?.name ?? null
    );
}