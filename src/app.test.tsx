import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { BonoboUiFrontendClient } from "bonobo-plugin-sdk/frontend";
import { afterEach, expect, test, vi } from "vitest";
import { App, FileDetail, GalleryTile } from "./app";
import { LIST_PAGE_BUDGET, type FilesListItem } from "./list-scan";
import { create_media_url_manager, type MediaUrlManager } from "./media-urls";

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
	let list_calls = 0;
	const fetchJson = vi.fn(async (path: string) => {
		if (path === "/api/v1/files/download-urls") {
			return { items: [], errors: [{ fileNodeId: "a1", message: "Not found" }], truncated: false };
		}
		list_calls += 1;
		if (list_calls === 1) {
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
	// The rendered tile mints download-urls through the same client; count list calls only.
	expect(fetchJson.mock.calls.filter((call) => call[0] === "/api/v1/files/list")).toHaveLength(2);
});

test("grid tiles from one page coalesce into a single batched download-urls call", async () => {
	const download_urls_bodies: string[][] = [];
	const fetchJson = vi.fn(async (path: string, init: { body: { fileNodeIds?: string[] } }) => {
		if (path === "/api/v1/files/download-urls") {
			const node_ids = init.body.fileNodeIds ?? [];
			download_urls_bodies.push(node_ids);
			return {
				items: node_ids.map((nodeId) => ({ fileNodeId: nodeId, url: `u-${nodeId}`, expiresAt: Date.now() + 600_000 })),
				errors: [],
				truncated: false,
			};
		}
		return { items: [media_item("a1"), media_item("a2"), media_item("a3")], cursor: null, isDone: true };
	});
	render(<App client={make_client(fetchJson)} />);

	await waitFor(() => {
		for (const name of ["a1.png", "a2.png", "a3.png"]) {
			expect(screen.getByRole("link", { name })).toBeTruthy();
		}
	});
	expect(download_urls_bodies).toEqual([["a1", "a2", "a3"]]);
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
	const link = screen.getByRole("link", { name: "n1.png" });
	await waitFor(() => expect(link.querySelector("img")).toBeTruthy());
	const img = link.querySelector("img");
	if (!img) throw new Error("tile image missing");
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

	const link = screen.getByRole("link", { name: "n1.png" });
	await waitFor(() => expect(link.querySelector("img")).toBeTruthy());
	const img = link.querySelector("img");
	if (!img) throw new Error("tile image missing");
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
	await waitFor(() => expect(link.querySelector("img")).toBeTruthy());
	const renewed_img = link.querySelector("img");
	if (!renewed_img) throw new Error("renewed tile image missing");
	await waitFor(() => expect(renewed_img.getAttribute("src")).toBe("u3"));
	fireEvent.load(renewed_img);
	fireEvent.error(renewed_img);
	await waitFor(() => expect(renewed_img.getAttribute("src")).toBe("u4"));
	expect(media.get_fresh_url).toHaveBeenCalledTimes(3);
});

test("detail video restores time and paused state after renewal and survives a rejected play()", async () => {
	const media = {
		get_url: vi.fn().mockResolvedValueOnce({ url: "v1", expiresAt: 1 }),
		get_fresh_url: vi.fn().mockResolvedValueOnce({ url: "v2", expiresAt: 2 }),
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

test("detail video restores a paused position without resuming playback", async () => {
	const media = {
		get_url: vi.fn().mockResolvedValueOnce({ url: "v1", expiresAt: 1 }),
		get_fresh_url: vi.fn().mockResolvedValueOnce({ url: "v2", expiresAt: 2 }),
	};
	const item: FilesListItem = { ...media_item("n1"), name: "clip.mp4", contentType: "video/mp4" };
	const play = vi.fn(() => Promise.resolve());
	const { container } = render(<FileDetail nodeId="n1" item={item} media={media as unknown as MediaUrlManager} />);

	await waitFor(() => expect(container.querySelector("video")).toBeTruthy());
	const video = container.querySelector("video");
	if (!video) {
		throw new Error("video missing");
	}
	Object.defineProperty(video, "play", { value: play, configurable: true });
	Object.defineProperty(video, "currentTime", { value: 0, writable: true, configurable: true });
	Object.defineProperty(video, "paused", { get: () => true, configurable: true });

	// The first load still uses the detail viewer's autoplay behavior.
	fireEvent.loadedMetadata(video);
	expect(play).toHaveBeenCalledTimes(1);

	video.currentTime = 17;
	fireEvent.error(video);
	await waitFor(() => expect(video.getAttribute("src")).toBe("v2"));
	video.currentTime = 0;
	fireEvent.loadedMetadata(video);
	expect(video.currentTime).toBe(17);
	expect(play).toHaveBeenCalledTimes(1);
});

test("detail image failure past the episode budget shows an alert with a working Retry", async () => {
	const media = {
		get_url: vi.fn().mockResolvedValueOnce({ url: "u1", expiresAt: 1 }),
		get_fresh_url: vi
			.fn()
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

test("detail view reuses a fresh cached URL without minting", async () => {
	const fetchJson = vi.fn(async (_path: string, init: { body: { fileNodeIds: string[] } }) => ({
		items: init.body.fileNodeIds.map((nodeId) => ({ fileNodeId: nodeId, url: `u-${nodeId}`, expiresAt: Date.now() + 600_000 })),
		errors: [],
		truncated: false,
	}));
	const media = create_media_url_manager(make_client(fetchJson));
	// The grid warmed the cache for this node with a comfortably-before-expiry URL.
	await media.get_url("n1");
	expect(fetchJson).toHaveBeenCalledTimes(1);

	const { container } = render(<FileDetail nodeId="n1" item={media_item("n1")} media={media} />);
	await waitFor(() => expect(container.querySelector("img")?.getAttribute("src")).toBe("u-n1"));
	expect(fetchJson).toHaveBeenCalledTimes(1);
});

test("detail view re-mints when the cached URL is near expiry", async () => {
	let mint_calls = 0;
	const fetchJson = vi.fn(async (_path: string, init: { body: { fileNodeIds: string[] } }) => {
		mint_calls += 1;
		return {
			items: init.body.fileNodeIds.map((nodeId) => ({
				fileNodeId: nodeId,
				url: `u${mint_calls}-${nodeId}`,
				// The first mint lands within the 60s expiry margin; the re-mint is long-lived.
				expiresAt: mint_calls === 1 ? Date.now() + 30_000 : Date.now() + 600_000,
			})),
			errors: [],
			truncated: false,
		};
	});
	const media = create_media_url_manager(make_client(fetchJson));
	await media.get_url("n1");

	const { container } = render(<FileDetail nodeId="n1" item={media_item("n1")} media={media} />);
	await waitFor(() => expect(container.querySelector("img")?.getAttribute("src")).toBe("u2-n1"));
	expect(fetchJson).toHaveBeenCalledTimes(2);
});
