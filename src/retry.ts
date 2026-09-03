import type { BonoboClient } from "bonobo-plugin-sdk/frontend";
import type { BonoboHttpApi, BonoboHttpApiPath, BonoboHttpResponse } from "bonobo-plugin-sdk/http-api";

/** Back-off delays after a 429, one per retry. */
const RETRY_429_DELAYS_MS = [3_000, 6_000];

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export function get_error_message(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/**
 * `client.fetchJson` with the shared 429 back-off: a rate-limited call is retried with the
 * exact same body (including any cursor) after 3s, then 6s, then the answer is returned as it is.
 *
 * Every other status comes back for the caller to narrow on, a 5xx included. `body` is `null` when
 * the answer did not parse as JSON. Only a refused session refresh and a network failure reject,
 * because neither one produced an answer.
 */
export async function fetch_json_with_429_retry<P extends BonoboHttpApiPath>(
	client: BonoboClient,
	path: P,
	body: BonoboHttpApi[P]["POST"]["body"],
): Promise<BonoboHttpResponse<P>> {
	for (let attempt = 0; ; attempt += 1) {
		const answer = await client.fetchJson(path, body);
		const delay_ms = RETRY_429_DELAYS_MS[attempt];
		if (answer.status === 429 && delay_ms !== undefined) {
			await sleep(delay_ms);
			continue;
		}
		return answer;
	}
}
