import type { BonoboUiFrontendClient } from "bonobo-plugin-sdk/frontend";
import { fetch_json_with_429_retry } from "./retry";

/** Signed URLs are re-requested when they are this close to `expiresAt`. */
export const URL_EXPIRY_MARGIN_MS = 60_000;
/** Download-url requests in flight at once — initial loads and renewals share the pool. */
export const MAX_CONCURRENT_URL_REQUESTS = 4;

export type MediaUrl = { url: string; expiresAt: number };

type FilesDownloadUrlResponse = {
	fileNodeId: string;
	url: string;
	expiresAt: number;
};

export type MediaUrlManager = {
	/** Thumbnails: cached per node, deduped, limited concurrency. */
	get_url(nodeId: string): Promise<MediaUrl>;
	/**
	 * Detail view and post-failure renewals: always mints a fresh URL (the cached one is
	 * near-expiry, demonstrably failing, or about to back long playback) — still deduped
	 * against any in-flight request for the node and bounded by the same four-slot pool.
	 */
	get_fresh_url(nodeId: string): Promise<MediaUrl>;
};

export function create_media_url_manager(client: BonoboUiFrontendClient): MediaUrlManager {
	const cache = new Map<string, MediaUrl>();
	const pending = new Map<string, Promise<MediaUrl>>();
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

	// Every download-url request — initial loads and renewals alike — funnels through here:
	// same four-slot pool, same per-node in-flight promise, same 3s/6s 429 back-off.
	function request_download_url(nodeId: string): Promise<MediaUrl> {
		const in_flight = pending.get(nodeId);
		if (in_flight) {
			return in_flight;
		}
		const request = (async () => {
			await acquire_slot();
			try {
				const response = (await fetch_json_with_429_retry(client, "/api/v1/files/download-url", {
					fileNodeId: nodeId,
				})) as FilesDownloadUrlResponse;
				const media = { url: response.url, expiresAt: response.expiresAt };
				cache.set(nodeId, media);
				return media;
			} finally {
				release_slot();
				pending.delete(nodeId);
			}
		})();
		pending.set(nodeId, request);
		return request;
	}

	return {
		get_url(nodeId) {
			const cached = cache.get(nodeId);
			if (cached && Date.now() < cached.expiresAt - URL_EXPIRY_MARGIN_MS) {
				return Promise.resolve(cached);
			}
			return request_download_url(nodeId);
		},
		get_fresh_url(nodeId) {
			return request_download_url(nodeId);
		},
	};
}
