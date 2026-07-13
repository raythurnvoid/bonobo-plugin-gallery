import type { BonoboUiFrontendClient } from "bonobo-plugin-sdk/frontend";
import { afterEach, expect, test, vi } from "vitest";
import { create_list_scan, LIST_PAGE_BUDGET, LIST_SCAN_LIMIT, PAGE_SIZE, type FilesListItem } from "./list-scan";

function media_item(nodeId: string): FilesListItem {
	return {
		path: `/media/${nodeId}.png`,
		name: `${nodeId}.png`,
		kind: "file",
		nodeId,
		contentType: "image/png",
		updatedAt: 0,
	};
}

function media_items(count: number, prefix: string): FilesListItem[] {
	return Array.from({ length: count }, (_, index) => media_item(`${prefix}${index}`));
}

function make_client(fetchJson: unknown): BonoboUiFrontendClient {
	return { fetchJson } as unknown as BonoboUiFrontendClient;
}

afterEach(() => {
	vi.useRealTimers();
});

test("sparse workspace: one click follows the cursor with wide file-only pages, no excessive requests", async () => {
	// 600-file workspace, 100 files per source page, 2 media survive the server's
	// post-filter on each page: one click should need exactly 6 requests.
	let pages_served = 0;
	const fetchJson = vi.fn(async (_path: string, _init: { body: Record<string, unknown> }) => {
		pages_served += 1;
		return {
			items: media_items(2, `p${pages_served}-`),
			cursor: pages_served === 6 ? null : `c${pages_served}`,
			isDone: pages_served === 6,
		};
	});
	const scan = create_list_scan(make_client(fetchJson));

	const result = await scan.load_next();

	expect(fetchJson).toHaveBeenCalledTimes(6);
	expect(result.items).toHaveLength(PAGE_SIZE);
	expect(result.errorMessage).toBeNull();
	expect(scan.has_more()).toBe(false);
	expect(fetchJson.mock.calls[0][1].body).toEqual({
		recursive: true,
		limit: LIST_SCAN_LIMIT,
		cursor: null,
		kind: "file",
		contentTypePrefixes: ["image/", "video/"],
	});
	expect(fetchJson.mock.calls.map((call) => call[1].body.cursor)).toEqual([null, "c1", "c2", "c3", "c4", "c5"]);
});

test("429 retries the same cursor and does not consume the page budget", async () => {
	vi.useFakeTimers();
	let served_429 = false;
	let pages_served = 0;
	const fetchJson = vi.fn(async (_path: string, _init: { body: Record<string, unknown> }) => {
		if (!served_429) {
			served_429 = true;
			throw Object.assign(new Error("rate limited"), { status: 429 });
		}
		pages_served += 1;
		return { items: [], cursor: `c${pages_served}`, isDone: false };
	});
	const scan = create_list_scan(make_client(fetchJson));

	const result_promise = scan.load_next();
	await vi.advanceTimersByTimeAsync(3_000);
	const result = await result_promise;

	// 1 rejected call + the full budget of successfully advanced pages.
	expect(fetchJson).toHaveBeenCalledTimes(1 + LIST_PAGE_BUDGET);
	expect(pages_served).toBe(LIST_PAGE_BUDGET);
	// The rejected call and its retry used the same cursor.
	expect(fetchJson.mock.calls[0][1].body.cursor).toBeNull();
	expect(fetchJson.mock.calls[1][1].body.cursor).toBeNull();
	// Capped empty scan: nothing exposed, but the scan is not complete.
	expect(result.items).toHaveLength(0);
	expect(result.errorMessage).toBeNull();
	expect(scan.has_more()).toBe(true);
});

test("dense terminal page: 12 exposed, later clicks drain the buffer without new fetches", async () => {
	const fetchJson = vi.fn(async (_path: string, _init: { body: Record<string, unknown> }) => ({
		items: media_items(100, "n"),
		cursor: null,
		isDone: true,
	}));
	const scan = create_list_scan(make_client(fetchJson));

	const first = await scan.load_next();
	expect(first.items).toHaveLength(PAGE_SIZE);
	expect(fetchJson).toHaveBeenCalledTimes(1);
	expect(scan.has_more()).toBe(true);

	const exposed = [...first.items];
	for (let click = 0; click < 7; click += 1) {
		const next = await scan.load_next();
		expect(next.items).toHaveLength(PAGE_SIZE);
		exposed.push(...next.items);
	}
	const last = await scan.load_next();
	expect(last.items).toHaveLength(4);
	exposed.push(...last.items);

	expect(fetchJson).toHaveBeenCalledTimes(1);
	expect(exposed).toHaveLength(100);
	expect(new Set(exposed.map((item) => item.nodeId)).size).toBe(100);
	expect(scan.has_more()).toBe(false);

	const done = await scan.load_next();
	expect(done.items).toHaveLength(0);
	expect(fetchJson).toHaveBeenCalledTimes(1);
});

test("items repeated across pages are deduplicated by nodeId", async () => {
	let pages_served = 0;
	const fetchJson = vi.fn(async (_path: string, _init: { body: Record<string, unknown> }) => {
		pages_served += 1;
		if (pages_served === 1) {
			return { items: media_items(6, "a"), cursor: "c1", isDone: false };
		}
		// a5 moved past the cursor mid-pagination and comes back a second time.
		return { items: [media_item("a5"), ...media_items(7, "b")], cursor: null, isDone: true };
	});
	const scan = create_list_scan(make_client(fetchJson));

	const result = await scan.load_next();

	expect(result.items.map((item) => item.nodeId)).toEqual(["a0", "a1", "a2", "a3", "a4", "a5", "b0", "b1", "b2", "b3", "b4", "b5"]);
	expect(scan.has_more()).toBe(true); // b6 stays buffered
	const drained = await scan.load_next();
	expect(drained.items.map((item) => item.nodeId)).toEqual(["b6"]);
	expect(fetchJson).toHaveBeenCalledTimes(2);
	expect(scan.has_more()).toBe(false);
});

test("a failure keeps partial progress and resumes from the advanced cursor", async () => {
	let pages_served = 0;
	const fetchJson = vi.fn(async (_path: string, _init: { body: Record<string, unknown> }) => {
		pages_served += 1;
		if (pages_served === 1) {
			return { items: media_items(6, "a"), cursor: "c1", isDone: false };
		}
		if (pages_served === 2) {
			throw Object.assign(new Error("service unavailable"), { status: 500 });
		}
		return { items: media_items(6, "b"), cursor: null, isDone: true };
	});
	const scan = create_list_scan(make_client(fetchJson));

	const failed = await scan.load_next();
	expect(failed.items).toHaveLength(6);
	expect(failed.errorMessage).toBe("service unavailable");
	expect(scan.has_more()).toBe(true);

	const resumed = await scan.load_next();
	expect(fetchJson.mock.calls[2][1].body.cursor).toBe("c1");
	expect(resumed.items).toHaveLength(6);
	expect(resumed.errorMessage).toBeNull();
	expect(scan.has_more()).toBe(false);
});
