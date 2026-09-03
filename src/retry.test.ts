import type { BonoboClient } from "bonobo-plugin-sdk/frontend";
import { afterEach, expect, test, vi } from "vitest";
import { fetch_json_with_429_retry } from "./retry";

function make_client(fetchJson: unknown): BonoboClient {
	return { fetchJson } as unknown as BonoboClient;
}

function rate_limited() {
	return { status: 429, body: { message: "rate limited", retryAfterMs: 1_000 } };
}

afterEach(() => {
	vi.useRealTimers();
});

test("a 429 retries after 3s, a second after 6s, with the same body each time", async () => {
	vi.useFakeTimers();
	const fetchJson = vi
		.fn()
		.mockResolvedValueOnce(rate_limited())
		.mockResolvedValueOnce(rate_limited())
		.mockResolvedValueOnce({ status: 200, body: { ok: true } });

	const result_promise = fetch_json_with_429_retry(make_client(fetchJson), "/api/v1/files/list", { cursor: "c1" });

	await vi.advanceTimersByTimeAsync(2_999);
	expect(fetchJson).toHaveBeenCalledTimes(1);
	await vi.advanceTimersByTimeAsync(1);
	expect(fetchJson).toHaveBeenCalledTimes(2);
	await vi.advanceTimersByTimeAsync(5_999);
	expect(fetchJson).toHaveBeenCalledTimes(2);
	await vi.advanceTimersByTimeAsync(1);
	expect(fetchJson).toHaveBeenCalledTimes(3);
	expect(await result_promise).toEqual({ status: 200, body: { ok: true } });
	expect(fetchJson.mock.calls.map((call) => call[1])).toEqual([{ cursor: "c1" }, { cursor: "c1" }, { cursor: "c1" }]);
});

test("a third consecutive 429 comes back as the answer for the caller to read", async () => {
	vi.useFakeTimers();
	const fetchJson = vi.fn().mockResolvedValue(rate_limited());

	const result_promise = fetch_json_with_429_retry(make_client(fetchJson), "/api/v1/files/list", {});
	await vi.advanceTimersByTimeAsync(9_000);
	// The retries are spent, so the refusal is handed back with its status and its wait instead of
	// being thrown. The caller decides what a 429 means for the surface it is filling.
	expect(await result_promise).toEqual(rate_limited());
	expect(fetchJson).toHaveBeenCalledTimes(3);
});

test("any other refusal comes back at once without retrying", async () => {
	const fetchJson = vi.fn().mockResolvedValue({ status: 403, body: { message: "Permission denied" } });

	expect(await fetch_json_with_429_retry(make_client(fetchJson), "/api/v1/files/list", {})).toEqual({
		status: 403,
		body: { message: "Permission denied" },
	});
	expect(fetchJson).toHaveBeenCalledTimes(1);
});

test("a rejection propagates immediately without retrying", async () => {
	// Only a refused session refresh and a network failure reject now: neither produced an
	// answer. A 5xx and a body that is not JSON resolve, and the caller reads them.
	const fetchJson = vi.fn().mockRejectedValue(new Error("network failure"));

	await expect(fetch_json_with_429_retry(make_client(fetchJson), "/api/v1/files/list", {})).rejects.toThrow("network failure");
	expect(fetchJson).toHaveBeenCalledTimes(1);
});
