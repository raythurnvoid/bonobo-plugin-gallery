import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { BonoboUiFrontendClient } from "bonobo-plugin-sdk/frontend";
import { afterEach, expect, test, vi } from "vitest";
import { App, FileDetail, GalleryTile } from "./app";
import { LIST_PAGE_BUDGET, type FilesListItem } from "./list-scan";
import type { MediaUrlManager } from "./media-urls";

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

function make_client(fetchJson: unknown): BonoboUiFrontendClient {
	return { fetchJson } as unknown as BonoboUiFrontendClient;
}

afterEach(cleanup);

test("a capped empty scan keeps Load more and does not show the empty state", async () => {
	let pages_served = 0;
	const fetchJson = vi.fn(async () => {
		pages_served += 1;
		return { items: [], cursor: `c${pages_served}`, isDone: false };
	});
	render(<App client={make_client(fetchJson)} />);

	await waitFor(() => expect(fetchJson).toHaveBeenCalledTimes(LIST_PAGE_BUDGET));
	expect(await screen.findByRole("button", { name: "Load more" })).toBeTruthy();
	expect(screen.queryByText("No images or videos yet.")).toBeNull();
});

test("a completed empty scan shows the empty state and no Load more", async () => {
	const fetchJson = vi.fn(async () => ({ items: [], cursor: null, isDone: true }));
	render(<App client={make_client(fetchJson)} />);

	expect(await screen.findByText("No images or videos yet.")).toBeTruthy();
	expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
	expect(fetchJson).toHaveBeenCalledTimes(1);
});

test("a first-load list failure shows an alert whose Retry resumes the scan", async () => {
	let calls = 0;
	const fetchJson = vi.fn(async (_path: string) => {
		calls += 1;
		if (calls === 1) {
			throw Object.assign(new Error("service unavailable"), { status: 500 });
		}
		return { items: [media_item("a1")], cursor: null, isDone: true };
	});
	render(<App client={make_client(fetchJson)} />);

	const alert = await screen.findByRole("alert");
	expect(alert.textContent).toContain("service unavailable");
	expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();

	fireEvent.click(screen.getByRole("button", { name: "Retry" }));
	expect(await screen.findByText("a1.png")).toBeTruthy();
	expect(screen.queryByRole("alert")).toBeNull();
	// The rendered tile mints a download-url through the same client; count list calls only.
	expect(fetchJson.mock.calls.filter((call) => call[0] === "/api/v1/files/list")).toHaveLength(2);
});

test("a rejected initial thumbnail request shows the failed placeholder with a working Retry", async () => {
	const media = {
		get_url: vi.fn().mockRejectedValueOnce(Object.assign(new Error("service unavailable"), { status: 500 })),
		get_fresh_url: vi.fn().mockResolvedValueOnce({ url: "u1", expiresAt: 1 }),
	};
	const { container } = render(<GalleryTile item={media_item("n1")} media={media as unknown as MediaUrlManager} />);

	const retry = await screen.findByRole("button", { name: "Retry n1.png" });
	expect(container.querySelector(".tile-placeholder.is-failed")).toBeTruthy();

	fireEvent.click(retry);
	const img = await screen.findByRole("img", { name: "n1.png" });
	expect(img.getAttribute("src")).toBe("u1");
});

test("tile image renews once per failure episode, then offers manual Retry; a successful load resets the budget", async () => {
	const media = {
		get_url: vi.fn().mockResolvedValue({ url: "u1", expiresAt: 1 }),
		get_fresh_url: vi
			.fn()
			.mockResolvedValueOnce({ url: "u2", expiresAt: 2 }) // automatic renewal
			.mockResolvedValueOnce({ url: "u3", expiresAt: 3 }) // manual Retry
			.mockResolvedValueOnce({ url: "u4", expiresAt: 4 }), // automatic renewal after reset
	};
	render(<GalleryTile item={media_item("n1")} media={media as unknown as MediaUrlManager} />);

	const img = await screen.findByRole("img", { name: "n1.png" });
	expect(img.getAttribute("src")).toBe("u1");

	// Expired URL: a load error triggers exactly one automatic renewal.
	fireEvent.error(img);
	await waitFor(() => expect(img.getAttribute("src")).toBe("u2"));
	expect(media.get_fresh_url).toHaveBeenCalledTimes(1);

	// The renewed URL fails too: terminal for this episode — manual Retry appears.
	fireEvent.error(img);
	const retry = await screen.findByRole("button", { name: "Retry n1.png" });
	expect(media.get_fresh_url).toHaveBeenCalledTimes(1);

	// Manual Retry mints again; a successful load resets the episode budget.
	fireEvent.click(retry);
	const renewed_img = await screen.findByRole("img", { name: "n1.png" });
	await waitFor(() => expect(renewed_img.getAttribute("src")).toBe("u3"));
	fireEvent.load(renewed_img);
	fireEvent.error(renewed_img);
	await waitFor(() => expect(renewed_img.getAttribute("src")).toBe("u4"));
	expect(media.get_fresh_url).toHaveBeenCalledTimes(3);
});

test("detail video restores time and paused state after renewal and survives a rejected play()", async () => {
	const media = {
		get_url: vi.fn(),
		get_fresh_url: vi
			.fn()
			.mockResolvedValueOnce({ url: "v1", expiresAt: 1 })
			.mockResolvedValueOnce({ url: "v2", expiresAt: 2 }),
	};
	const item: FilesListItem = { ...media_item("n1"), name: "clip.mp4", contentType: "video/mp4" };
	const play = vi.fn(() => Promise.reject(new Error("autoplay blocked")));
	const { container } = render(<FileDetail nodeId="n1" item={item} media={media as unknown as MediaUrlManager} />);

	await waitFor(() => expect(container.querySelector("video")).toBeTruthy());
	const video = container.querySelector("video");
	if (!video) {
		throw new Error("video missing");
	}
	Object.defineProperty(video, "play", { value: play, configurable: true });
	Object.defineProperty(video, "currentTime", { value: 0, writable: true, configurable: true });
	Object.defineProperty(video, "paused", { get: () => false, configurable: true });

	// Initial open: metadata loads → autoplay attempted; the rejected play() is caught.
	fireEvent.loadedMetadata(video);
	expect(play).toHaveBeenCalledTimes(1);

	// Mid-playback URL expiry: position/paused are captured, the URL renews, and both are
	// restored once the replacement's metadata loads.
	video.currentTime = 42;
	fireEvent.error(video);
	await waitFor(() => expect(video.getAttribute("src")).toBe("v2"));
	video.currentTime = 0; // the failed replacement load reset the position
	fireEvent.loadedMetadata(video);
	expect(video.currentTime).toBe(42);
	expect(play).toHaveBeenCalledTimes(2); // was playing → resumed; rejection swallowed
});

test("detail image failure past the episode budget shows an alert with a working Retry", async () => {
	const media = {
		get_url: vi.fn(),
		get_fresh_url: vi
			.fn()
			.mockResolvedValueOnce({ url: "u1", expiresAt: 1 })
			.mockResolvedValueOnce({ url: "u2", expiresAt: 2 })
			.mockResolvedValueOnce({ url: "u3", expiresAt: 3 }),
	};
	const { container } = render(
		<FileDetail nodeId="n1" item={media_item("n1")} media={media as unknown as MediaUrlManager} />,
	);

	await waitFor(() => expect(container.querySelector("img")).toBeTruthy());
	const img = container.querySelector("img");
	if (!img) {
		throw new Error("img missing");
	}
	fireEvent.error(img); // automatic renewal
	await waitFor(() => expect(img.getAttribute("src")).toBe("u2"));
	fireEvent.error(img); // episode exhausted → alert + manual Retry

	const alert = await screen.findByRole("alert");
	expect(alert.textContent).toContain("Failed to load media");
	fireEvent.click(screen.getByRole("button", { name: "Retry" }));
	await waitFor(() => {
		const renewed_img = container.querySelector("img");
		expect(renewed_img?.getAttribute("src")).toBe("u3");
	});
});
