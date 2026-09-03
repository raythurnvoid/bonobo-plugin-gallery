import type { BonoboClient } from "bonobo-plugin-sdk/frontend";
import { afterEach, expect, test, vi } from "vitest";
import { create_list_scan, LIST_PAGE_BUDGET, LIST_SCAN_LIMIT, PAGE_SIZE, type FilesListItem } from "./list-scan";

function media_item(nodeId: string): FilesListItem {
	return {
		path: `/media/${nodeId}.png`,
		name: `${nodeId}.png`,
		kind: "file",
		// The route answers a branded files_nodes id. Brand the fixture once here.
		nodeId: nodeId as FilesListItem["nodeId"],
		contentType: "image/png",
		updatedAt: 0,
		status: "ready",
		size: 1024,
	};
}

function media_items(count: number, prefix: string): FilesListItem[] {
	return Array.from({ length: count }, (_, index) => media_item(`${prefix}${index}`));
}

function make_client(fetchJson: unknown): BonoboClient {
	return { fetchJson } as unknown as BonoboClient;
}

afterEach(() => {
	vi.useRealTimers();
});

test("sparse workspace: one click follows the cursor with wide file-only pages, no excessive requests", async () => {
	// Six short filtered pages, 2 media in total: one click should need exactly 6 requests.
	let pages_served = 0;
	const fetchJson = vi.fn(async (_path: string, _body: Record<string, unknown>) => {
		pages_served += 1;
		return {
			status: 200,
			body: {
				items: media_items(2, `p${pages_served}-`),
				cursor: pages_served === 6 ? "" : `c${pages_served}`,
				isDone: pages_served === 6,
			},
		};
	});
	const scan = create_list_scan(make_client(fetchJson));

	const result = await scan.load_next();

	expect(fetchJson).toHaveBeenCalledTimes(6);
	expect(result.items).toHaveLength(PAGE_SIZE);
	expect(result.errorMessage).toBeNull();
	expect(scan.has_more()).toBe(false);
	expect(fetchJson.mock.calls[0][1]).toEqual({
		recursive: true,
		limit: LIST_SCAN_LIMIT,
		scanLimit: 10_000,
		// The request cursor starts null; only the answer's cursor is always a string.
		cursor: null,
		kind: "file",
		contentTypePrefixes: ["image/", "video/"],
	});
	expect(fetchJson.mock.calls.map((call) => call[1].cursor)).toEqual([null, "c1", "c2", "c3", "c4", "c5"]);
});

test("429 retries the same cursor and does not consume the page budget", async () => {
	vi.useFakeTimers();
	let served_429 = false;
	let pages_served = 0;
	const fetchJson = vi.fn(async (_path: string, _body: Record<string, unknown>) => {
		if (!served_429) {
			served_429 = true;
			// A declared 429 is an answer now, not a throw. The shared back-off still swallows it.
			return { status: 429, body: { message: "rate limited", retryAfterMs: 1_000 } };
		}
		pages_served += 1;
		return { status: 200, body: { items: [], cursor: `c${pages_served}`, isDone: false } };
	});
	const scan = create_list_scan(make_client(fetchJson));

	const result_promise = scan.load_next();
	await vi.advanceTimersByTimeAsync(3_000);
	const result = await result_promise;

	// 1 retried 429 + the full budget of successfully advanced pages.
	expect(fetchJson).toHaveBeenCalledTimes(1 + LIST_PAGE_BUDGET);
	expect(pages_served).toBe(LIST_PAGE_BUDGET);
	// The 429 and its retry used the same cursor.
	expect(fetchJson.mock.calls[0][1].cursor).toBeNull();
	expect(fetchJson.mock.calls[1][1].cursor).toBeNull();
	// Capped empty scan: nothing exposed, but the scan is not complete.
	expect(result.items).toHaveLength(0);
	expect(result.errorMessage).toBeNull();
	expect(scan.has_more()).toBe(true);
});

test("dense terminal page: 12 exposed, later clicks drain the buffer without new fetches", async () => {
	const fetchJson = vi.fn(async (_path: string, _body: Record<string, unknown>) => ({
		status: 200,
		body: { items: media_items(100, "n"), cursor: "", isDone: true },
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

test("dense nonterminal overflow drains before the next necessary fetch", async () => {
	let pages_served = 0;
	const fetchJson = vi.fn(async () => {
		pages_served += 1;
		if (pages_served === 1) {
			return { status: 200, body: { items: media_items(25, "a"), cursor: "c1", isDone: false } };
		}
		return { status: 200, body: { items: media_items(11, "b"), cursor: "", isDone: true } };
	});
	const scan = create_list_scan(make_client(fetchJson));

	const first = await scan.load_next();
	const second = await scan.load_next();
	expect(first.items).toHaveLength(PAGE_SIZE);
	expect(second.items).toHaveLength(PAGE_SIZE);
	expect(fetchJson).toHaveBeenCalledTimes(1);

	const third = await scan.load_next();
	expect(third.items.map((item) => item.nodeId)).toEqual([
		"a24",
		"b0",
		"b1",
		"b2",
		"b3",
		"b4",
		"b5",
		"b6",
		"b7",
		"b8",
		"b9",
		"b10",
	]);
	expect(fetchJson).toHaveBeenCalledTimes(2);
	expect(scan.has_more()).toBe(false);
});

test("a capped scan resumes from its saved cursor on the next click", async () => {
	let pages_served = 0;
	const fetchJson = vi.fn(async (_path: string, _body: Record<string, unknown>) => {
		pages_served += 1;
		if (pages_served <= LIST_PAGE_BUDGET) {
			return { status: 200, body: { items: [], cursor: `c${pages_served}`, isDone: false } };
		}
		return { status: 200, body: { items: [media_item("found")], cursor: "", isDone: true } };
	});
	const scan = create_list_scan(make_client(fetchJson));

	const capped = await scan.load_next();
	expect(capped.items).toHaveLength(0);
	expect(scan.has_more()).toBe(true);
	expect(fetchJson).toHaveBeenCalledTimes(LIST_PAGE_BUDGET);

	const resumed = await scan.load_next();
	expect(fetchJson.mock.calls[LIST_PAGE_BUDGET][1].cursor).toBe(`c${LIST_PAGE_BUDGET}`);
	expect(resumed.items.map((item) => item.nodeId)).toEqual(["found"]);
	expect(scan.has_more()).toBe(false);
});

test("items repeated across pages are deduplicated by nodeId", async () => {
	let pages_served = 0;
	const fetchJson = vi.fn(async (_path: string, _body: Record<string, unknown>) => {
		pages_served += 1;
		if (pages_served === 1) {
			return { status: 200, body: { items: media_items(6, "a"), cursor: "c1", isDone: false } };
		}
		// a5 moved past the cursor mid-pagination and comes back a second time.
		return { status: 200, body: { items: [media_item("a5"), ...media_items(7, "b")], cursor: "", isDone: true } };
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
	const fetchJson = vi.fn(async (_path: string, _body: Record<string, unknown>) => {
		pages_served += 1;
		if (pages_served === 1) {
			return { status: 200, body: { items: media_items(6, "a"), cursor: "c1", isDone: false } };
		}
		if (pages_served === 2) {
			// A network failure rejects, and the scan keeps what it already read. A 5xx no
			// longer rejects; the test below covers that one.
			throw new Error("network failure");
		}
		return { status: 200, body: { items: media_items(6, "b"), cursor: "", isDone: true } };
	});
	const scan = create_list_scan(make_client(fetchJson));

	const failed = await scan.load_next();
	expect(failed.items).toHaveLength(6);
	expect(failed.errorMessage).toBe("network failure");
	expect(scan.has_more()).toBe(true);

	const resumed = await scan.load_next();
	expect(fetchJson.mock.calls[2][1].cursor).toBe("c1");
	expect(resumed.items).toHaveLength(6);
	expect(resumed.errorMessage).toBeNull();
	expect(scan.has_more()).toBe(false);
});

test("a refused page ends the scan with the route's own sentence and keeps what it read", async () => {
	let pages_served = 0;
	const fetchJson = vi.fn(async (_path: string, _body: Record<string, unknown>) => {
		pages_served += 1;
		if (pages_served === 1) {
			return { status: 200, body: { items: media_items(6, "a"), cursor: "c1", isDone: false } };
		}
		// A declared refusal resolves now. The scan must read it, not walk past it into a body
		// that carries no items.
		return { status: 403, body: { message: "Permission denied" } };
	});
	const scan = create_list_scan(make_client(fetchJson));

	const refused = await scan.load_next();
	expect(refused.items).toHaveLength(6);
	expect(refused.errorMessage).toBe("Permission denied");
	expect(scan.has_more()).toBe(true);
	// One refusal ends this click. It is not retried like a 429.
	expect(fetchJson).toHaveBeenCalledTimes(2);
});

/** One good page, then the answer under test. Returns what the click exposed. */
async function scan_after_answer(answer: { status: number; body: null }) {
	let pages_served = 0;
	const fetchJson = vi.fn(async (_path: string, _body: Record<string, unknown>) => {
		pages_served += 1;
		if (pages_served === 1) {
			return { status: 200, body: { items: media_items(6, "a"), cursor: "c1", isDone: false } };
		}
		return answer;
	});
	const scan = create_list_scan(make_client(fetchJson));
	return await scan.load_next();
}

test("a 5xx ends the scan with a sentence naming the door, and keeps what it read", async () => {
	// Since SDK 0.18.0 a 5xx resolves like any other answer, and a gateway sends HTML, so the
	// body is null. Read as a page it would put a TypeError text in front of the member.
	const page = await scan_after_answer({ status: 502, body: null });

	expect(page.items).toHaveLength(6);
	expect(page.errorMessage).toBe("The files list door answered 502");
});

test("a 200 whose body did not parse ends the scan instead of reading an empty page", async () => {
	// The status says "here is your page" and there is none. This is the case the null check
	// catches on its own: the status guard above it lets a 200 through.
	const page = await scan_after_answer({ status: 200, body: null });

	expect(page.items).toHaveLength(6);
	expect(page.errorMessage).toBe("The files list door answered 200 with a body that is not JSON");
});

test("a 429 that outlives the back-off reaches the page as its own message", async () => {
	vi.useFakeTimers();
	// The per-principal bucket can stay drained for longer than 9s, so the answer the shared
	// back-off gives up on is a 429, and the page has to say something about it.
	const fetchJson = vi.fn(async (_path: string, _body: Record<string, unknown>) => ({
		status: 429,
		body: { message: "Rate limit exceeded", retryAfterMs: 1_000 },
	}));
	const scan = create_list_scan(make_client(fetchJson));

	const result_promise = scan.load_next();
	await vi.advanceTimersByTimeAsync(9_000);
	const result = await result_promise;

	expect(fetchJson).toHaveBeenCalledTimes(3);
	expect(result.items).toHaveLength(0);
	expect(result.errorMessage).toBe("Rate limit exceeded");
	expect(scan.has_more()).toBe(true);
});
