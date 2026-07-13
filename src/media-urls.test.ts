import type { BonoboUiFrontendClient } from "bonobo-plugin-sdk/frontend";
import { expect, test, vi } from "vitest";
import { create_media_url_manager, MAX_CONCURRENT_URL_REQUESTS } from "./media-urls";

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
	return { fileNodeId: nodeId, url, expiresAt };
}

function make_manager() {
	const gates: Array<{ nodeId: string; gate: Deferred }> = [];
	const fetchJson = vi.fn((_path: string, init: { body: { fileNodeId: string } }) => {
		const gate = deferred();
		gates.push({ nodeId: init.body.fileNodeId, gate });
		return gate.promise;
	});
	const media = create_media_url_manager({ fetchJson } as unknown as BonoboUiFrontendClient);
	return { media, fetchJson, gates };
}

test("initial requests and renewals share the four-slot pool", async () => {
	const { media, fetchJson, gates } = make_manager();

	const requests = [
		media.get_url("n1"),
		media.get_url("n2"),
		media.get_url("n3"),
		// Renewal-style calls go through the exact same pool as initial thumbnails.
		media.get_fresh_url("n4"),
		media.get_url("n5"),
		media.get_fresh_url("n6"),
	];
	await flush_microtasks();
	expect(fetchJson).toHaveBeenCalledTimes(MAX_CONCURRENT_URL_REQUESTS);

	gates[0].gate.resolve(download_url_response("n1", "u1", Date.now() + 600_000));
	await flush_microtasks();
	expect(fetchJson).toHaveBeenCalledTimes(5);
	expect(gates[4].nodeId).toBe("n5");

	gates[1].gate.resolve(download_url_response("n2", "u2", Date.now() + 600_000));
	await flush_microtasks();
	expect(fetchJson).toHaveBeenCalledTimes(6);

	for (const pending of gates.slice(2)) {
		pending.gate.resolve(download_url_response(pending.nodeId, `u-${pending.nodeId}`, Date.now() + 600_000));
	}
	const resolved = await Promise.all(requests);
	expect(resolved[0].url).toBe("u1");
	expect(resolved[3].url).toBe("u-n4");
});

test("same-node requests are deduplicated across get_url and get_fresh_url", async () => {
	const { media, fetchJson, gates } = make_manager();

	const first = media.get_url("n1");
	const second = media.get_url("n1");
	const renewal = media.get_fresh_url("n1");
	await flush_microtasks();
	expect(fetchJson).toHaveBeenCalledTimes(1);

	gates[0].gate.resolve(download_url_response("n1", "u1", Date.now() + 600_000));
	const resolved = await Promise.all([first, second, renewal]);
	expect(resolved.map((media_url) => media_url.url)).toEqual(["u1", "u1", "u1"]);
});

test("get_url serves a fresh cache without a request; get_fresh_url always re-mints", async () => {
	const { media, fetchJson, gates } = make_manager();

	const first = media.get_url("n1");
	await flush_microtasks();
	gates[0].gate.resolve(download_url_response("n1", "u1", Date.now() + 600_000));
	await first;

	// Fresh cache: no new request.
	const cached = await media.get_url("n1");
	expect(cached.url).toBe("u1");
	expect(fetchJson).toHaveBeenCalledTimes(1);

	// The detail view / a renewal skips the cache and mints again.
	const fresh = media.get_fresh_url("n1");
	await flush_microtasks();
	expect(fetchJson).toHaveBeenCalledTimes(2);
	gates[1].gate.resolve(download_url_response("n1", "u2", Date.now() + 600_000));
	expect((await fresh).url).toBe("u2");
});

test("a rejected request frees its pool slot and is not deduped for the next attempt", async () => {
	const { media, fetchJson, gates } = make_manager();

	const failed = media.get_url("n1");
	await flush_microtasks();
	gates[0].gate.reject(Object.assign(new Error("service unavailable"), { status: 500 }));
	await expect(failed).rejects.toThrow("service unavailable");

	// The failure released the slot and cleared the in-flight entry: a new attempt makes a
	// fresh request instead of reusing the dead promise.
	const retried = media.get_url("n1");
	await flush_microtasks();
	expect(fetchJson).toHaveBeenCalledTimes(2);
	gates[1].gate.resolve(download_url_response("n1", "u2", Date.now() + 600_000));
	expect((await retried).url).toBe("u2");
});

test("a near-expiry cached URL is re-requested by get_url", async () => {
	const { media, fetchJson, gates } = make_manager();

	const first = media.get_url("n1");
	await flush_microtasks();
	// Expires within the 60s margin: the next get_url must not reuse it.
	gates[0].gate.resolve(download_url_response("n1", "u1", Date.now() + 30_000));
	await first;

	const renewed = media.get_url("n1");
	await flush_microtasks();
	expect(fetchJson).toHaveBeenCalledTimes(2);
	gates[1].gate.resolve(download_url_response("n1", "u2", Date.now() + 600_000));
	expect((await renewed).url).toBe("u2");
});
