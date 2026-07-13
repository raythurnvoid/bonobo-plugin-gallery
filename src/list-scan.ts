import type { BonoboUiFrontendClient } from "bonobo-plugin-sdk/frontend";
import { fetch_json_with_429_retry, get_error_message } from "./retry";

/** Gallery page size: each "Load more" exposes at most this many new tiles. */
export const PAGE_SIZE = 12;
/**
 * Files scanned per list request (the server clamps to its own max). Much larger than
 * PAGE_SIZE because the server post-filters by contentTypePrefixes over an unfiltered
 * scan: sparse-media trees would otherwise need one request per 12 files and trip the
 * per-route rate limit before a single gallery page fills.
 */
export const LIST_SCAN_LIMIT = 100;
/**
 * Source pages one "Load more" may successfully advance before it stops and keeps the
 * cursor for the next click. 429 retries do not consume the budget.
 */
export const LIST_PAGE_BUDGET = 30;

/** Prefixes the server filters each page by; only media files come back. */
const MEDIA_CONTENT_TYPE_PREFIXES = ["image/", "video/"];

export type FilesListItem = {
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

export type ListScan = {
	/**
	 * One "Load more" click: drains buffered overflow items first, then follows the cursor
	 * (at most LIST_PAGE_BUDGET pages) until PAGE_SIZE new unique items are exposed or the
	 * source completes; anything fetched beyond PAGE_SIZE buffers for the next click. On a
	 * request failure the cursor and partial progress are kept and the error message is
	 * returned alongside whatever was already exposed.
	 */
	load_next(): Promise<{ items: FilesListItem[]; errorMessage: string | null }>;
	/** False only at visible completion: the source is done and nothing is buffered. */
	has_more(): boolean;
};

export function create_list_scan(client: BonoboUiFrontendClient): ListScan {
	let cursor: string | null = null;
	let source_is_done = false;
	const pending_items: FilesListItem[] = [];
	// Every nodeId ever exposed or buffered: cursor pagination is keyset over treePath, so a
	// file renamed/moved past the cursor mid-pagination can come back twice.
	const seen_node_ids = new Set<string>();

	return {
		async load_next() {
			const items = pending_items.splice(0, PAGE_SIZE);
			let error_message: string | null = null;
			// The server post-filters each page by contentTypePrefixes, so a page may come
			// back short or even empty while isDone is still false — keep following the
			// cursor until a full gallery page accumulates, the listing completes, or the
			// page budget runs out.
			try {
				for (let pages = 0; items.length < PAGE_SIZE && !source_is_done && pages < LIST_PAGE_BUDGET; pages += 1) {
					const page = (await fetch_json_with_429_retry(client, "/api/v1/files/list", {
						recursive: true,
						limit: LIST_SCAN_LIMIT,
						cursor,
						kind: "file",
						contentTypePrefixes: MEDIA_CONTENT_TYPE_PREFIXES,
					})) as FilesListResponse;
					cursor = page.cursor;
					source_is_done = page.isDone;
					for (const item of page.items) {
						if (seen_node_ids.has(item.nodeId)) {
							continue;
						}
						seen_node_ids.add(item.nodeId);
						if (items.length < PAGE_SIZE) {
							items.push(item);
						} else {
							pending_items.push(item);
						}
					}
				}
			} catch (error) {
				// Keep partial progress: the cursor already advanced past everything exposed.
				error_message = get_error_message(error);
			}
			return { items, errorMessage: error_message };
		},
		has_more() {
			return !(source_is_done && pending_items.length === 0);
		},
	};
}
