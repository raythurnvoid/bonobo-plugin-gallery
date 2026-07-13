import type { BonoboUiFrontendClient } from "bonobo-plugin-sdk/frontend";
import { fetch_json_with_429_retry } from "./retry";

/** Signed URLs are re-requested when they are this close to `expiresAt`. */
export const URL_EXPIRY_MARGIN_MS = 60_000;
/** Initial batches and renewals share this four-request HTTP pool. */
export const MAX_CONCURRENT_URL_REQUESTS = 4;
/**
 * Node ids per batched download-urls call. Twelve matches one visible Gallery page and stays
 * below that route's 20-id server limit; single-node renewals use a separate route bucket.
 */
export const MAX_URL_BATCH_IDS = 12;

export type MediaUrl = { url: string; expiresAt: number };

type FilesDownloadUrlResponse = {
	fileNodeId: string;
	url: string;
	expiresAt: number;
};

type FilesDownloadUrlsResponse = {
	items: FilesDownloadUrlResponse[];
	errors: Array<{ fileNodeId: string; message: string }>;
	truncated: boolean;
};

export type MediaUrlManager = {
	/**
	 * Thumbnails and detail opens: cached per node, deduped, and coalesced with every other
	 * request from the same tick into one batched download-urls call.
	 */
	get_url(nodeId: string): Promise<MediaUrl>;
	/**
	 * Post-failure renewals and manual retries: always mints a fresh URL (the cached one is
	 * demonstrably failing or near expiry) — still deduped against any in-flight request for
	 * the node and bounded by the four-slot pool.
	 */
	get_fresh_url(nodeId: string): Promise<MediaUrl>;
};

export function create_media_url_manager(client: BonoboUiFrontendClient): MediaUrlManager {
	const cache = new Map<string, MediaUrl>();
	const pending = new Map<string, Promise<MediaUrl>>();
	const waiters: Array<() => void> = [];
	let active_requests = 0;
	// Initial loads queued for the next batched download-urls call, one entry per node.
	const batch_queue: Array<{
		nodeId: string;
		resolve: (media: MediaUrl) => void;
		reject: (error: unknown) => void;
	}> = [];
	// True from flush scheduling until the drain loop exits: at most one batched call is in
	// flight at a time, which is what bounds concurrent HTTP calls on the batched path.
	let batch_flush_active = false;

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

	// Renewals: single-node download-url request through the four-slot pool, per-node
	// in-flight promise, same 3s/6s 429 back-off.
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

	// Initial loads: the node joins the batch queue and resolves when its batch lands —
	// same per-node in-flight promise as renewals, same 3s/6s 429 back-off per batch call.
	function request_download_url_batched(nodeId: string): Promise<MediaUrl> {
		const in_flight = pending.get(nodeId);
		if (in_flight) {
			return in_flight;
		}
		const request = new Promise<MediaUrl>((resolve, reject) => {
			batch_queue.push({ nodeId, resolve, reject });
		});
		pending.set(nodeId, request);
		if (!batch_flush_active) {
			batch_flush_active = true;
			// One flush per tick: every get_url issued during the current task joins the batch.
			setTimeout(() => void flush_batch_queue(), 0);
		}
		return request;
	}

	async function flush_batch_queue(): Promise<void> {
		while (batch_queue.length > 0) {
			const entries = batch_queue.splice(0, MAX_URL_BATCH_IDS);
			await acquire_slot();
			try {
				const response = (await fetch_json_with_429_retry(client, "/api/v1/files/download-urls", {
					fileNodeIds: entries.map((entry) => entry.nodeId),
				})) as FilesDownloadUrlsResponse;
				const items_by_node_id = new Map(response.items.map((item) => [item.fileNodeId, item]));
				const errors_by_node_id = new Map(response.errors.map((item) => [item.fileNodeId, item.message]));
				for (const entry of entries) {
					pending.delete(entry.nodeId);
					const item = items_by_node_id.get(entry.nodeId);
					if (item) {
						const media = { url: item.url, expiresAt: item.expiresAt };
						cache.set(entry.nodeId, media);
						entry.resolve(media);
					} else {
						// `items` + `errors` cover every requested id; a failed id rejects only
						// its own waiter, exactly like a failed single-node call.
						entry.reject(new Error(errors_by_node_id.get(entry.nodeId) ?? "Not found"));
					}
				}
			} catch (error) {
				for (const entry of entries) {
					pending.delete(entry.nodeId);
					entry.reject(error);
				}
			} finally {
				// Initial batches and renewals share this slot so mixed work cannot exceed
				// the same four-request HTTP limit.
				release_slot();
			}
		}
		batch_flush_active = false;
	}

	return {
		get_url(nodeId) {
			const cached = cache.get(nodeId);
			if (cached && Date.now() < cached.expiresAt - URL_EXPIRY_MARGIN_MS) {
				return Promise.resolve(cached);
			}
			return request_download_url_batched(nodeId);
		},
		get_fresh_url(nodeId) {
			return request_download_url(nodeId);
		},
	};
}
