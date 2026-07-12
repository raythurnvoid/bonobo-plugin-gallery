import type { BonoboUiFrontendClient } from "bonobo-plugin-sdk/frontend";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** Gallery page size: each "Load more" accumulates this many new items. */
const PAGE_SIZE = 12;
/** Signed URLs are re-requested when they are this close to `expiresAt`. */
const URL_EXPIRY_MARGIN_MS = 60_000;
/** Thumbnail download-url requests in flight at once. */
const MAX_CONCURRENT_URL_REQUESTS = 4;
/** Back-off delays after a 429 from `/api/v1/files/download-url`, one per retry. */
const URL_RETRY_DELAYS_MS = [3_000, 6_000];

type FilesListItem = {
	path: string;
	name: string;
	kind: "file" | "folder";
	nodeId: string;
	contentType: string | null;
	updatedAt: number;
};

type FilesListResponse = {
	items: FilesListItem[];
	cursor: string | null;
	isDone: boolean;
};

type FilesDownloadUrlResponse = {
	fileNodeId: string;
	url: string;
	expiresAt: number;
};

type Route = { view: "grid" } | { view: "file"; nodeId: string };

function parse_route(hash: string): Route {
	const match = /^#\/file\/(.+)$/.exec(hash);
	if (match) {
		return { view: "file", nodeId: decodeURIComponent(match[1]) };
	}
	return { view: "grid" };
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function get_error_status(error: unknown): number | undefined {
	// fetchJson rejects with an Error carrying `status` on non-ok responses.
	if (error instanceof Error && "status" in error && typeof error.status === "number") {
		return error.status;
	}
	return undefined;
}

function get_error_message(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

type MediaUrlManager = {
	get_url(nodeId: string): Promise<string>;
	get_fresh_url(nodeId: string): Promise<string>;
};

function create_media_url_manager(client: BonoboUiFrontendClient): MediaUrlManager {
	const cache = new Map<string, { url: string; expiresAt: number }>();
	const pending = new Map<string, Promise<string>>();
	const waiters: Array<() => void> = [];
	let active_requests = 0;

	function acquire_slot(): Promise<void> {
		if (active_requests < MAX_CONCURRENT_URL_REQUESTS) {
			active_requests += 1;
			return Promise.resolve();
		}
		return new Promise((resolve) => waiters.push(resolve));
	}

	function release_slot(): void {
		const next = waiters.shift();
		if (next) {
			// The slot transfers to the waiter; active_requests stays constant.
			next();
		} else {
			active_requests -= 1;
		}
	}

	async function request_download_url(nodeId: string): Promise<{ url: string; expiresAt: number }> {
		for (let attempt = 0; ; attempt += 1) {
			try {
				const response = (await client.fetchJson("/api/v1/files/download-url", {
					body: { fileNodeId: nodeId },
				})) as FilesDownloadUrlResponse;
				cache.set(nodeId, { url: response.url, expiresAt: response.expiresAt });
				return response;
			} catch (error) {
				const delay_ms = URL_RETRY_DELAYS_MS[attempt];
				if (get_error_status(error) === 429 && delay_ms !== undefined) {
					await sleep(delay_ms);
					continue;
				}
				throw error;
			}
		}
	}

	return {
		// Thumbnails: cached per node, deduped, limited concurrency.
		get_url(nodeId) {
			const cached = cache.get(nodeId);
			if (cached && Date.now() < cached.expiresAt - URL_EXPIRY_MARGIN_MS) {
				return Promise.resolve(cached.url);
			}
			const in_flight = pending.get(nodeId);
			if (in_flight) {
				return in_flight;
			}
			const request = (async () => {
				await acquire_slot();
				try {
					const media = await request_download_url(nodeId);
					return media.url;
				} finally {
					release_slot();
					pending.delete(nodeId);
				}
			})();
			pending.set(nodeId, request);
			return request;
		},
		// Detail view: always mint a fresh URL so playback never starts on a near-expiry link.
		async get_fresh_url(nodeId) {
			const media = await request_download_url(nodeId);
			return media.url;
		},
	};
}

export function App(props: { client: BonoboUiFrontendClient }) {
	const media = useMemo(() => create_media_url_manager(props.client), [props.client]);
	const [route, setRoute] = useState<Route>(() => parse_route(window.location.hash));
	const [items, setItems] = useState<FilesListItem[]>([]);
	const [isDone, setIsDone] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	// Pagination state the async loader reads and writes; a ref keeps it exact
	// across renders and makes the loader single-flight.
	const pagingRef = useRef<{ cursor: string | null; isDone: boolean; loading: boolean }>({
		cursor: null,
		isDone: false,
		loading: false,
	});

	useEffect(() => {
		const handle_hash_change = () => setRoute(parse_route(window.location.hash));
		window.addEventListener("hashchange", handle_hash_change);
		return () => window.removeEventListener("hashchange", handle_hash_change);
	}, []);

	const load_more = useCallback(async () => {
		const paging = pagingRef.current;
		if (paging.loading || paging.isDone) {
			return;
		}
		paging.loading = true;
		setLoading(true);
		setError(null);
		// The server post-filters each page by contentTypePrefixes, so a page may
		// come back short or even empty while isDone is still false — keep
		// following the cursor until a full gallery page accumulates or the
		// listing is done.
		const fresh: FilesListItem[] = [];
		try {
			while (fresh.length < PAGE_SIZE && !paging.isDone) {
				const page = (await props.client.fetchJson("/api/v1/files/list", {
					body: {
						recursive: true,
						limit: PAGE_SIZE,
						cursor: paging.cursor,
						contentTypePrefixes: ["image/", "video/"],
					},
				})) as FilesListResponse;
				fresh.push(...page.items);
				paging.cursor = page.cursor;
				paging.isDone = page.isDone;
			}
		} catch (error) {
			setError(get_error_message(error));
		} finally {
			// Keep partial progress: the cursor already advanced past these items.
			if (fresh.length > 0) {
				setItems((prev) => [...prev, ...fresh]);
			}
			setIsDone(paging.isDone);
			paging.loading = false;
			setLoading(false);
		}
	}, [props.client]);

	useEffect(() => {
		void load_more();
	}, [load_more]);

	if (route.view === "file") {
		const item = items.find((candidate) => candidate.nodeId === route.nodeId);
		return <FileDetail nodeId={route.nodeId} item={item} media={media} />;
	}

	return (
		<div className="gallery">
			<header className="gallery-header">
				<h1>Gallery</h1>
			</header>
			{items.length > 0 ? (
				<div className="gallery-grid">
					{items.map((item) => (
						<GalleryTile key={item.nodeId} item={item} media={media} />
					))}
				</div>
			) : null}
			{loading ? <div className="gallery-status">Loading…</div> : null}
			{error !== null ? (
				<div className="gallery-status is-error">
					<span>{error}</span>
					<button className="button" onClick={() => void load_more()}>
						Retry
					</button>
				</div>
			) : null}
			{!loading && error === null && isDone && items.length === 0 ? (
				<div className="gallery-status">No images or videos yet.</div>
			) : null}
			{!isDone && !loading && error === null ? (
				<div className="gallery-more">
					<button className="button" onClick={() => void load_more()}>
						Load more
					</button>
				</div>
			) : null}
			{items.length > 0 ? (
				<div className="gallery-count">
					{items.length} item{items.length === 1 ? "" : "s"}
				</div>
			) : null}
		</div>
	);
}

function GalleryTile(props: { item: FilesListItem; media: MediaUrlManager }) {
	const [url, setUrl] = useState<string | null>(null);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		let cancelled = false;
		props.media.get_url(props.item.nodeId).then(
			(url) => {
				if (!cancelled) {
					setUrl(url);
				}
			},
			() => {
				if (!cancelled) {
					setFailed(true);
				}
			},
		);
		return () => {
			cancelled = true;
		};
	}, [props.item.nodeId, props.media]);

	const is_video = props.item.contentType !== null && props.item.contentType.startsWith("video/");

	return (
		<a className="tile" href={`#/file/${encodeURIComponent(props.item.nodeId)}`}>
			{url === null ? (
				<span className={failed ? "tile-placeholder is-failed" : "tile-placeholder"} />
			) : is_video ? (
				<>
					<video className="tile-media" src={url} preload="metadata" muted />
					<span className="tile-play" aria-hidden="true">
						▶
					</span>
				</>
			) : (
				<img className="tile-media" src={url} alt={props.item.name} loading="lazy" />
			)}
			<span className="tile-name">{props.item.name}</span>
		</a>
	);
}

function FileDetail(props: { nodeId: string; item: FilesListItem | undefined; media: MediaUrlManager }) {
	const [url, setUrl] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		setUrl(null);
		setError(null);
		props.media.get_fresh_url(props.nodeId).then(
			(url) => {
				if (!cancelled) {
					setUrl(url);
				}
			},
			(error: unknown) => {
				if (!cancelled) {
					setError(get_error_message(error));
				}
			},
		);
		return () => {
			cancelled = true;
		};
	}, [props.nodeId, props.media]);

	const item = props.item;
	const is_video = item !== undefined && item.contentType !== null && item.contentType.startsWith("video/");

	return (
		<div className="viewer">
			<div className="viewer-topbar">
				<a className="viewer-back" href="#/">
					← Gallery
				</a>
				{item !== undefined ? (
					<div className="viewer-titles">
						<div className="viewer-name">{item.name}</div>
						<div className="viewer-meta">
							{item.contentType ?? "unknown type"} · {item.path} · {new Date(item.updatedAt).toLocaleString()}
						</div>
					</div>
				) : null}
			</div>
			<div className="viewer-stage">
				{error !== null ? (
					<div className="viewer-status is-error">{error}</div>
				) : url === null ? (
					<div className="viewer-status">Loading…</div>
				) : is_video ? (
					<video src={url} controls autoPlay />
				) : (
					<img src={url} alt={item !== undefined ? item.name : ""} />
				)}
			</div>
		</div>
	);
}
