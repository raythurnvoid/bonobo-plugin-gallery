import type { BonoboUiFrontendClient } from "bonobo-plugin-sdk/frontend";
import { afterEach, expect, test, vi } from "vitest";
import { fetch_json_with_429_retry } from "./retry";

function make_client(fetchJson: unknown): BonoboUiFrontendClient {
	return { fetchJson } as unknown as BonoboUiFrontendClient;
}

function rate_limited(): Error {
	return Object.assign(new Error("rate limited"), { status: 429 });
}

afterEach(() => {
	vi.useRealTimers();
});

test("a 429 retries after 3s, a second after 6s, with the same body each time", async () => {
	vi.useFakeTimers();
	const fetchJson = vi
		.fn()
		.mockRejectedValueOnce(rate_limited())
		.mockRejectedValueOnce(rate_limited())
		.mockResolvedValueOnce({ ok: true });

	const result_promise = fetch_json_with_429_retry(make_client(fetchJson), "/api/v1/files/list", { cursor: "c1" });

	await vi.advanceTimersByTimeAsync(2_999);
	expect(fetchJson).toHaveBeenCalledTimes(1);
	await vi.advanceTimersByTimeAsync(1);
	expect(fetchJson).toHaveBeenCalledTimes(2);
	await vi.advanceTimersByTimeAsync(5_999);
	expect(fetchJson).toHaveBeenCalledTimes(2);
	await vi.advanceTimersByTimeAsync(1);
	expect(fetchJson).toHaveBeenCalledTimes(3);
	expect(await result_promise).toEqual({ ok: true });
	expect(fetchJson.mock.calls.map((call) => call[1].body)).toEqual([
		{ cursor: "c1" },
		{ cursor: "c1" },
		{ cursor: "c1" },
	]);
});

test("a third consecutive 429 propagates the error", async () => {
	vi.useFakeTimers();
	const fetchJson = vi.fn().mockRejectedValue(rate_limited());

	const result_promise = fetch_json_with_429_retry(make_client(fetchJson), "/api/v1/files/list", {});
	const expectation = expect(result_promise).rejects.toThrow("rate limited");
	await vi.advanceTimersByTimeAsync(9_000);
	await expectation;
	expect(fetchJson).toHaveBeenCalledTimes(3);
});

test("a non-429 error propagates immediately without retrying", async () => {
	const fetchJson = vi.fn().mockRejectedValue(Object.assign(new Error("service unavailable"), { status: 500 }));

	await expect(fetch_json_with_429_retry(make_client(fetchJson), "/api/v1/files/list", {})).rejects.toThrow(
		"service unavailable",
	);
	expect(fetchJson).toHaveBeenCalledTimes(1);
});
