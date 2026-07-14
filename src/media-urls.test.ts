import type { BonoboUiFrontendClient } from "bonobo-plugin-sdk/frontend";
import { afterEach, expect, test, vi } from "vitest";
import { create_media_url_manager, MAX_CONCURRENT_URL_REQUESTS, MAX_URL_BATCH_IDS } from "./media-urls";

type Deferred = {
	promise: Promise<unknown>;
	resolve: (value: unknown) => void;
	reject: (error: unknown) => void;
};

function deferred(): Deferred {
	let resolve_fn: ((value: unknown) => void) | undefined;
	let reject_fn: ((error: unknown) => void) | undefined;
	const promise = new Promise<unknown>((resolve, reject) => {
		resolve_fn = resolve;
		reject_fn = reject;
	});
	return {
		promise,
		resolve: (value) => resolve_fn?.(value),
		reject: (error) => reject_fn?.(error),
	};
}

function flush_microtasks(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

function download_url_response(nodeId: string, url: string, expiresAt: number) {
	return {
		items: [{ fileNodeId: nodeId, url, expiresAt }],
		errors: [],
		truncated: false,
	};
}

function download_urls_response(nodeIds: string[], expiresAt: number, failedNodeIds: string[] = []) {
	return {
		items: nodeIds
			.filter((nodeId) => !failedNodeIds.includes(nodeId))
			.map((nodeId) => ({ fileNodeId: nodeId, url: `u-${nodeId}`, expiresAt })),
		errors: failedNodeIds.map((nodeId) => ({ fileNodeId: nodeId, message: "Not found" })),
		truncated: false,
	};
}

function make_manager() {
	const calls: Array<{ path: string; body: { fileNodeIds: string[] }; gate: Deferred }> = [];
	const fetchJson = vi.fn((path: string, init: { body: { fileNodeIds: string[] } }) => {
		const gate = deferred();
		calls.push({ path, body: init.body, gate });
		return gate.promise;
	});
	const media = create_media_url_manager({ fetchJson } as unknown as BonoboUiFrontendClient);
	return { media, fetchJson, calls };
}

afterEach(() => {
	vi.useRealTimers();
});

test("get_url requests from the same tick coalesce into one batched call", async () => {
	const { media, fetchJson, calls } = make_manager();

	const requests = [media.get_url("n1"), media.get_url("n2"), media.get_url("n3")];
	await flush_microtasks();
	expect(fetchJson).toHaveBeenCalledTimes(1);
	expect(calls[0].path).toBe("/api/v1/files/download-urls");
	expect(calls[0].body.fileNodeIds).toEqual(["n1", "n2", "n3"]);

	calls[0].gate.resolve(download_urls_response(["n1", "n2", "n3"], Date.now() + 600_000));
	const resolved = await Promise.all(requests);
	expect(resolved.map((media_url) => media_url.url)).toEqual(["u-n1", "u-n2", "u-n3"]);

	// The batch populated the cache: a follow-up get_url makes no request.
	expect((await media.get_url("n2")).url).toBe("u-n2");
	expect(fetchJson).toHaveBeenCalledTimes(1);
});

test("a queue past the batch cap splits into sequential batched calls", async () => {
	const { media, fetchJson, calls } = make_manager();

	const node_ids = Array.from({ length: MAX_URL_BATCH_IDS + 1 }, (_, index) => `n${index + 1}`);
	const requests = node_ids.map((nodeId) => media.get_url(nodeId));
	await flush_microtasks();
	expect(fetchJson).toHaveBeenCalledTimes(1);
	expect(calls[0].body.fileNodeIds).toEqual(node_ids.slice(0, MAX_URL_BATCH_IDS));

	calls[0].gate.resolve(download_urls_response(node_ids.slice(0, MAX_URL_BATCH_IDS), Date.now() + 600_000));
	await flush_microtasks();
	expect(fetchJson).toHaveBeenCalledTimes(2);
	expect(calls[1].body.fileNodeIds).toEqual(node_ids.slice(MAX_URL_BATCH_IDS));

	calls[1].gate.resolve(download_urls_response(node_ids.slice(MAX_URL_BATCH_IDS), Date.now() + 600_000));
	const resolved = await Promise.all(requests);
	expect(resolved[MAX_URL_BATCH_IDS].url).toBe(`u-n${MAX_URL_BATCH_IDS + 1}`);
});

test("an id in the batch errors rejects only that node's request", async () => {
	const { media, fetchJson, calls } = make_manager();

	const ok = media.get_url("n1");
	const missing = media.get_url("n2");
	await flush_microtasks();

	calls[0].gate.resolve(download_urls_response(["n1", "n2"], Date.now() + 600_000, ["n2"]));
	expect((await ok).url).toBe("u-n1");
	await expect(missing).rejects.toThrow("Not found");

	// The failure cleared the in-flight entry: a new attempt makes a fresh batched request.
	const retried = media.get_url("n2");
	await flush_microtasks();
	expect(fetchJson).toHaveBeenCalledTimes(2);
	calls[1].gate.resolve(download_urls_response(["n2"], Date.now() + 600_000));
	expect((await retried).url).toBe("u-n2");
});

test("same-node requests are deduplicated across get_url and get_fresh_url", async () => {
	const { media, fetchJson, calls } = make_manager();

	const first = media.get_url("n1");
	const second = media.get_url("n1");
	const renewal = media.get_fresh_url("n1");
	await flush_microtasks();
	expect(fetchJson).toHaveBeenCalledTimes(1);

	calls[0].gate.resolve(download_urls_response(["n1"], Date.now() + 600_000));
	const resolved = await Promise.all([first, second, renewal]);
	expect(resolved.map((media_url) => media_url.url)).toEqual(["u-n1", "u-n1", "u-n1"]);
});

test("get_url serves a fresh cache without a request; get_fresh_url always re-mints", async () => {
	const { media, fetchJson, calls } = make_manager();

	const first = media.get_url("n1");
	await flush_microtasks();
	calls[0].gate.resolve(download_urls_response(["n1"], Date.now() + 600_000));
	await first;

	// Fresh cache: no new request.
	const cached = await media.get_url("n1");
	expect(cached.url).toBe("u-n1");
	expect(fetchJson).toHaveBeenCalledTimes(1);

	// A renewal skips the cache and mints again through a one-item batch request.
	const fresh = media.get_fresh_url("n1");
	await flush_microtasks();
	expect(fetchJson).toHaveBeenCalledTimes(2);
	expect(calls[1].path).toBe("/api/v1/files/download-urls");
	expect(calls[1].body.fileNodeIds).toEqual(["n1"]);
	calls[1].gate.resolve(download_url_response("n1", "u2", Date.now() + 600_000));
	expect((await fresh).url).toBe("u2");
});

test("renewals share the four-slot pool", async () => {
	const { media, fetchJson, calls } = make_manager();

	const requests = ["n1", "n2", "n3", "n4", "n5", "n6"].map((nodeId) => media.get_fresh_url(nodeId));
	await flush_microtasks();
	expect(fetchJson).toHaveBeenCalledTimes(MAX_CONCURRENT_URL_REQUESTS);

	calls[0].gate.resolve(download_url_response("n1", "u1", Date.now() + 600_000));
	await flush_microtasks();
	expect(fetchJson).toHaveBeenCalledTimes(5);
	expect(calls[4].body.fileNodeIds).toEqual(["n5"]);

	for (const pending of calls.slice(1, 5)) {
		const nodeId = pending.body.fileNodeIds[0];
		pending.gate.resolve(download_url_response(nodeId, `u-${nodeId}`, Date.now() + 600_000));
	}
	await flush_microtasks();
	expect(fetchJson).toHaveBeenCalledTimes(6);
	calls[5].gate.resolve(download_url_response("n6", "u-n6", Date.now() + 600_000));
	const resolved = await Promise.all(requests);
	expect(resolved[5].url).toBe("u-n6");
});

test("initial batches and renewals share one four-slot pool", async () => {
	let active_requests = 0;
	let max_active_requests = 0;
	const calls: Array<{
		path: string;
		body: { fileNodeIds: string[] };
		gate: Deferred;
	}> = [];
	const fetchJson = vi.fn((path: string, init: { body: { fileNodeIds: string[] } }) => {
		const gate = deferred();
		active_requests += 1;
		max_active_requests = Math.max(max_active_requests, active_requests);
		calls.push({ path, body: init.body, gate });
		return gate.promise.finally(() => {
			active_requests -= 1;
		});
	});
	const media = create_media_url_manager({ fetchJson } as unknown as BonoboUiFrontendClient);

	const initial = media.get_url("initial");
	const renewals = ["r1", "r2", "r3", "r4", "r5"].map((nodeId) => media.get_fresh_url(nodeId));
	await flush_microtasks();
	expect(active_requests).toBe(MAX_CONCURRENT_URL_REQUESTS);
	expect(max_active_requests).toBe(MAX_CONCURRENT_URL_REQUESTS);

	for (let index = 0; index < 2; index += 1) {
		const call = calls[index];
		const nodeId = call.body.fileNodeIds[0];
		call.gate.resolve(download_url_response(nodeId, `u-${nodeId}`, Date.now() + 600_000));
		await flush_microtasks();
		expect(active_requests).toBe(MAX_CONCURRENT_URL_REQUESTS);
		expect(max_active_requests).toBe(MAX_CONCURRENT_URL_REQUESTS);
	}

	const batch = calls.find((call) => call.body.fileNodeIds[0] === "initial");
	expect(batch?.body.fileNodeIds).toEqual(["initial"]);
	for (const call of calls.filter((candidate) => candidate !== batch)) {
		const nodeId = call.body.fileNodeIds[0];
		if (nodeId === "r1" || nodeId === "r2") {
			continue;
		}
		call.gate.resolve(download_url_response(nodeId, `u-${nodeId}`, Date.now() + 600_000));
	}
	batch?.gate.resolve(download_urls_response(["initial"], Date.now() + 600_000));

	const resolved = await Promise.all([initial, ...renewals]);
	expect(resolved.map((item) => item.url)).toEqual(["u-initial", "u-r1", "u-r2", "u-r3", "u-r4", "u-r5"]);
	expect(max_active_requests).toBe(MAX_CONCURRENT_URL_REQUESTS);
});

test("a failed batched call rejects its nodes and is not deduped for the next attempt", async () => {
	const { media, fetchJson, calls } = make_manager();

	const failed = media.get_url("n1");
	await flush_microtasks();
	calls[0].gate.reject(Object.assign(new Error("service unavailable"), { status: 500 }));
	await expect(failed).rejects.toThrow("service unavailable");

	// The failure cleared the in-flight entry: a new attempt makes a fresh request instead
	// of reusing the dead promise.
	const retried = media.get_url("n1");
	await flush_microtasks();
	expect(fetchJson).toHaveBeenCalledTimes(2);
	calls[1].gate.resolve(download_urls_response(["n1"], Date.now() + 600_000));
	expect((await retried).url).toBe("u-n1");
});

test("a near-expiry cached URL is re-requested by get_url", async () => {
	const { media, fetchJson, calls } = make_manager();

	const first = media.get_url("n1");
	await flush_microtasks();
	// Expires within the 60s margin: the next get_url must not reuse it.
	calls[0].gate.resolve(download_urls_response(["n1"], Date.now() + 30_000));
	await first;

	const renewed = media.get_url("n1");
	await flush_microtasks();
	expect(fetchJson).toHaveBeenCalledTimes(2);
	calls[1].gate.resolve(download_urls_response(["n1"], Date.now() + 600_000));
	expect((await renewed).url).toBe("u-n1");
});

test("a rate-limited batched call retries with the same ids", async () => {
	vi.useFakeTimers();
	const { media, fetchJson, calls } = make_manager();

	const requests = [media.get_url("n1"), media.get_url("n2")];
	await vi.advanceTimersByTimeAsync(0);
	expect(fetchJson).toHaveBeenCalledTimes(1);

	calls[0].gate.reject(Object.assign(new Error("rate limited"), { status: 429, retryAfterMs: 3_000 }));
	await vi.advanceTimersByTimeAsync(3_000);
	expect(fetchJson).toHaveBeenCalledTimes(2);
	expect(calls[1].body.fileNodeIds).toEqual(["n1", "n2"]);

	calls[1].gate.resolve(download_urls_response(["n1", "n2"], Date.now() + 600_000));
	const resolved = await Promise.all(requests);
	expect(resolved.map((media_url) => media_url.url)).toEqual(["u-n1", "u-n2"]);
});
