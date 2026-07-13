import type { BonoboUiFrontendClient } from "bonobo-plugin-sdk/frontend";

/** Back-off delays after a 429, one per retry. */
const RETRY_429_DELAYS_MS = [3_000, 6_000];

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function get_error_status(error: unknown): number | undefined {
	// fetchJson rejects with an Error carrying `status` on non-ok responses.
	if (error instanceof Error && "status" in error && typeof error.status === "number") {
		return error.status;
	}
	return undefined;
}

export function get_error_message(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/**
 * `client.fetchJson` with the shared 429 back-off: a rate-limited call is retried with the
 * exact same body (including any cursor) after 3s, then 6s, then the error propagates.
 */
export async function fetch_json_with_429_retry(
	client: BonoboUiFrontendClient,
	path: string,
	body: unknown,
): Promise<unknown> {
	for (let attempt = 0; ; attempt += 1) {
		try {
			return await client.fetchJson(path, { body });
		} catch (error) {
			const delay_ms = RETRY_429_DELAYS_MS[attempt];
			if (get_error_status(error) === 429 && delay_ms !== undefined) {
				await sleep(delay_ms);
				continue;
			}
			throw error;
		}
	}
}
