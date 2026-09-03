import type { BonoboClient } from "bonobo-plugin-sdk/frontend";
import type { BonoboHttpApi } from "bonobo-plugin-sdk/http-api";
import { fetch_json_with_429_retry, get_error_message } from "./retry";

/** Gallery page size: each "Load more" exposes at most this many new tiles. */
export const PAGE_SIZE = 12;
/**
 * Files returned per list request (the server clamps to its own max). Keep this larger
 * than PAGE_SIZE so dense media pages buffer overflow for the next user action.
 */
export const LIST_SCAN_LIMIT = 100;
// Ask the generic file API to scan its largest bounded number of source files.
const LIST_SCAN_MAX_ROWS_READ = 10_000;

/**
 * Source pages one "Load more" may successfully advance before it stops and keeps the
 * cursor for the next click. 429 retries do not consume the budget.
 */
export const LIST_PAGE_BUDGET = 30;

/** Prefixes the server filters each page by; only media files come back. */
const MEDIA_CONTENT_TYPE_PREFIXES = ["image/", "video/"];

/** One listed file, as the app's own `/api/v1/files/list` route answers it. */
export type FilesListItem = BonoboHttpApi["/api/v1/files/list"]["POST"]["response"][200]["body"]["items"][number];

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

export function create_list_scan(client: BonoboClient): ListScan {
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
			// The server bounds how many source files one content-type scan reads, so a page
			// may come back short or even empty while isDone is still false. Keep following the
			// cursor until a full gallery page accumulates, the listing completes, or the
			// page budget runs out.
			try {
				for (let pages = 0; items.length < PAGE_SIZE && !source_is_done && pages < LIST_PAGE_BUDGET; pages += 1) {
					const answer = await fetch_json_with_429_retry(client, "/api/v1/files/list", {
						recursive: true,
						limit: LIST_SCAN_LIMIT,
						scanLimit: LIST_SCAN_MAX_ROWS_READ,
						cursor,
						kind: "file",
						contentTypePrefixes: MEDIA_CONTENT_TYPE_PREFIXES,
					});
					// Every status the route declares is an answer now. A refusal ends the scan with
					// its own sentence, which the catch below turns into the page-level message.
					if (answer.status !== 200) {
						throw new Error(answer.body.message);
					}
					const page = answer.body;
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
