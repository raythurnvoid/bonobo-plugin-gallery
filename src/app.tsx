import type { BonoboUiFrontendClient } from "bonobo-plugin-sdk/frontend";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { create_list_scan, type FilesListItem } from "./list-scan";
import { create_media_url_manager, type MediaUrl, type MediaUrlManager } from "./media-urls";
import { get_error_message } from "./retry";

type Route = { view: "grid" } | { view: "file"; nodeId: string };

function parse_route(hash: string): Route {
	const match = /^#\/file\/(.+)$/.exec(hash);
	if (match) {
		return { view: "file", nodeId: decodeURIComponent(match[1]) };
	}
	return { view: "grid" };
}

export function App(props: { client: BonoboUiFrontendClient }) {
	const media = useMemo(() => create_media_url_manager(props.client), [props.client]);
	const scan = useMemo(() => create_list_scan(props.client), [props.client]);
	const [route, setRoute] = useState<Route>(() => parse_route(window.location.hash));
	const [items, setItems] = useState<FilesListItem[]>([]);
	const [hasMore, setHasMore] = useState(true);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	// Single-flight guard for the async loader; a ref keeps it exact across renders.
	const loadingRef = useRef(false);

	useEffect(() => {
		const handle_hash_change = () => setRoute(parse_route(window.location.hash));
		window.addEventListener("hashchange", handle_hash_change);
		return () => window.removeEventListener("hashchange", handle_hash_change);
	}, []);

	const load_more = useCallback(async () => {
		if (loadingRef.current) {
			return;
		}
		loadingRef.current = true;
		setLoading(true);
		setError(null);
		const result = await scan.load_next();
		if (result.items.length > 0) {
			setItems((prev) => [...prev, ...result.items]);
		}
		setError(result.errorMessage);
		setHasMore(scan.has_more());
		loadingRef.current = false;
		setLoading(false);
	}, [scan]);

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
			{loading ? (
				<div className="gallery-status" role="status" aria-live="polite">
					Loading…
				</div>
			) : null}
			{error !== null ? (
				<div className="gallery-status is-error" role="alert">
					<span>{error}</span>
					<button className="button" onClick={() => void load_more()}>
						Retry
					</button>
				</div>
			) : null}
			{!loading && error === null && !hasMore && items.length === 0 ? (
				<div className="gallery-status">No images or videos yet.</div>
			) : null}
			{hasMore && !loading && error === null ? (
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

/**
 * A component's signed media URL with failure recovery: one automatic renewal per failure
 * episode (`notify_load_error`), reset only by a successful load (`notify_load_success`),
 * then a manual `retry`. Initial requests coalesce into the manager's batched calls;
 * renewals go through its single-node pool — both with per-node dedup.
 */
function use_media_url(media: MediaUrlManager, nodeId: string) {
	const [mediaUrl, setMediaUrl] = useState<MediaUrl | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const autoRenewSpentRef = useRef(false);
	// Bumped when the node changes so a stale async result cannot land on the new node.
	const generationRef = useRef(0);

	const request_url = useCallback(
		(fresh: boolean) => {
			const generation = generationRef.current;
			const promise = fresh ? media.get_fresh_url(nodeId) : media.get_url(nodeId);
			promise.then(
				(media_url) => {
					if (generationRef.current === generation) {
						setMediaUrl(media_url);
						setErrorMessage(null);
					}
				},
				(error: unknown) => {
					if (generationRef.current === generation) {
						setMediaUrl(null);
						setErrorMessage(get_error_message(error));
					}
				},
			);
		},
		[media, nodeId],
	);

	useEffect(() => {
		autoRenewSpentRef.current = false;
		setMediaUrl(null);
		setErrorMessage(null);
		request_url(false);
		return () => {
			generationRef.current += 1;
		};
	}, [request_url]);

	const notify_load_success = useCallback(() => {
		autoRenewSpentRef.current = false;
	}, []);

	const notify_load_error = useCallback(() => {
		if (autoRenewSpentRef.current) {
			// The renewed URL failed to load too — stop and offer manual Retry.
			setMediaUrl(null);
			setErrorMessage("Failed to load media");
			return;
		}
		autoRenewSpentRef.current = true;
		request_url(true);
	}, [request_url]);

	const retry = useCallback(() => {
		setErrorMessage(null);
		request_url(true);
	}, [request_url]);

	return { mediaUrl, errorMessage, notify_load_success, notify_load_error, retry };
}

export function GalleryTile(props: { item: FilesListItem; media: MediaUrlManager }) {
	const media_url = use_media_url(props.media, props.item.nodeId);

	const is_video = props.item.contentType !== null && props.item.contentType.startsWith("video/");

	return (
		<div className="tile">
			<a className="tile-link" href={`#/file/${encodeURIComponent(props.item.nodeId)}`}>
				{media_url.mediaUrl === null ? (
					<span className={media_url.errorMessage !== null ? "tile-placeholder is-failed" : "tile-placeholder"} />
				) : is_video ? (
					<>
						<video
							className="tile-media"
							src={media_url.mediaUrl.url}
							preload="metadata"
							muted
							onLoadedMetadata={media_url.notify_load_success}
							onError={media_url.notify_load_error}
						/>
						<span className="tile-play" aria-hidden="true">
							▶
						</span>
					</>
				) : (
					<img
						className="tile-media"
						src={media_url.mediaUrl.url}
						alt=""
						loading="lazy"
						onLoad={media_url.notify_load_success}
						onError={media_url.notify_load_error}
					/>
				)}
				<span className="tile-name">{props.item.name}</span>
			</a>
			{media_url.errorMessage !== null ? (
				<button className="button tile-retry" aria-label={`Retry ${props.item.name}`} onClick={media_url.retry}>
					Retry
				</button>
			) : null}
		</div>
	);
}

export function FileDetail(props: { nodeId: string; item: FilesListItem | undefined; media: MediaUrlManager }) {
	// Detail view: reuse the grid's cached URL when it is comfortably before expiry; get_url
	// only mints when the entry is missing or within the 60s margin. A reused URL that turns
	// out to be dead still goes through the one-automatic-renewal fallback.
	const media_url = use_media_url(props.media, props.nodeId);
	const videoRef = useRef<HTMLVideoElement | null>(null);
	// Playback position captured when the video URL fails mid-session, restored onto the
	// renewed URL once its metadata loads.
	const restoreRef = useRef<{ currentTime: number; paused: boolean } | null>(null);

	const handle_video_error = useCallback(() => {
		const video = videoRef.current;
		if (video && Number.isFinite(video.currentTime)) {
			restoreRef.current = { currentTime: video.currentTime, paused: video.paused };
		}
		media_url.notify_load_error();
	}, [media_url.notify_load_error]);

	const handle_video_loaded_metadata = useCallback(() => {
		media_url.notify_load_success();
		const video = videoRef.current;
		if (!video) {
			return;
		}
		const restore = restoreRef.current;
		restoreRef.current = null;
		if (restore) {
			video.currentTime = restore.currentTime;
			if (!restore.paused) {
				// Autoplay of the renewed URL may be blocked; the user still has controls.
				video.play().catch(() => {});
			}
		} else {
			// First load of this view: a blocked autoplay must not surface an unhandled rejection.
			video.play().catch(() => {});
		}
	}, [media_url.notify_load_success]);

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
				{media_url.errorMessage !== null ? (
					<div className="viewer-status is-error" role="alert">
						<span>{media_url.errorMessage}</span>
						<button className="button" onClick={media_url.retry}>
							Retry
						</button>
					</div>
				) : media_url.mediaUrl === null ? (
					<div className="viewer-status" role="status" aria-live="polite">
						Loading…
					</div>
				) : is_video ? (
					<video
						ref={videoRef}
						src={media_url.mediaUrl.url}
						controls
						onLoadedMetadata={handle_video_loaded_metadata}
						onError={handle_video_error}
					/>
				) : (
					<img
						src={media_url.mediaUrl.url}
						alt={item !== undefined ? item.name : "File preview"}
						onLoad={media_url.notify_load_success}
						onError={media_url.notify_load_error}
					/>
				)}
			</div>
		</div>
	);
}
