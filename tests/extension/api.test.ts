import { afterEach, describe, expect, it, vi } from "vitest";
import {
	apiUrl,
	BATCH_SIZE,
	ping,
	postStash,
	REQUEST_TIMEOUT_MS,
} from "../../extension/api.js";

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

describe("apiUrl", () => {
	it("joins without double slashes", () => {
		expect(apiUrl("https://slop.example.org", "/api/stash")).toBe(
			"https://slop.example.org/api/stash",
		);
		expect(apiUrl("https://slop.example.org/", "/api/stash")).toBe(
			"https://slop.example.org/api/stash",
		);
		expect(apiUrl("https://h.example/sub", "/api/stash/ping")).toBe(
			"https://h.example/sub/api/stash/ping",
		);
	});
});

describe("postStash", () => {
	const tabs = [
		{ url: "https://a.com/", title: "A", closedAt: "2026-10-03T12:00:00.000Z" },
	];

	it("posts JSON with the bearer token and returns saved", async () => {
		const fetchFn = vi.fn(async (_url: string, _init: RequestInit) =>
			json({ saved: ["https://a.com/"], rejected: [] }),
		);
		const result = await postStash(
			fetchFn,
			"https://slop.example.org",
			"ps_x",
			tabs,
		);
		expect(result).toEqual({ ok: true, saved: ["https://a.com/"] });
		const [url, init] = fetchFn.mock.calls[0];
		expect(url).toBe("https://slop.example.org/api/stash");
		expect(init.method).toBe("POST");
		expect(init.headers).toEqual({
			"Content-Type": "application/json",
			Authorization: "Bearer ps_x",
		});
		expect(JSON.parse(init.body as string)).toEqual({ tabs });
	});

	it("reports a network error", async () => {
		const fetchFn = vi.fn(async () => {
			throw new TypeError("fetch failed");
		});
		expect(await postStash(fetchFn, "https://s.example", "ps_x", tabs)).toEqual(
			{
				ok: false,
				error: "Network error: fetch failed",
			},
		);
	});

	it("reports 401 as a token problem", async () => {
		const fetchFn = vi.fn(async () => json({ error: "Unauthorized" }, 401));
		const result = await postStash(fetchFn, "https://s.example", "ps_x", tabs);
		expect(result).toEqual({
			ok: false,
			error: expect.stringContaining("401"),
		});
		expect(result).toEqual({
			ok: false,
			error: expect.stringContaining("token"),
		});
	});

	it("reports other non-2xx statuses", async () => {
		const fetchFn = vi.fn(async () => new Response("oops", { status: 500 }));
		expect(await postStash(fetchFn, "https://s.example", "ps_x", tabs)).toEqual(
			{
				ok: false,
				error: "Server returned 500",
			},
		);
	});

	it("rejects a non-JSON body", async () => {
		const fetchFn = vi.fn(
			async () => new Response("<html>login</html>", { status: 200 }),
		);
		expect(await postStash(fetchFn, "https://s.example", "ps_x", tabs)).toEqual(
			{
				ok: false,
				error: "Invalid response from server (not JSON)",
			},
		);
	});

	it.each([
		{},
		{ saved: "https://a.com/" },
		{ saved: [1] },
		null,
	])("rejects body %p without a string saved array", async (body) => {
		const fetchFn = vi.fn(async () => json(body));
		expect(await postStash(fetchFn, "https://s.example", "ps_x", tabs)).toEqual(
			{
				ok: false,
				error: "Invalid response from server (no saved list)",
			},
		);
	});

	it("exposes the batch size", () => {
		expect(BATCH_SIZE).toBe(100);
	});
});

describe("ping", () => {
	it("returns the account email", async () => {
		const fetchFn = vi.fn(async (_url: string, _init: RequestInit) =>
			json({ ok: true, user: { email: "me@example.org" } }),
		);
		expect(await ping(fetchFn, "https://s.example/", "ps_x")).toEqual({
			ok: true,
			email: "me@example.org",
		});
		const [url, init] = fetchFn.mock.calls[0];
		expect(url).toBe("https://s.example/api/stash/ping");
		expect(init.headers).toEqual({ Authorization: "Bearer ps_x" });
	});

	it("reports 401", async () => {
		const fetchFn = vi.fn(async () => json({ error: "Unauthorized" }, 401));
		expect(await ping(fetchFn, "https://s.example", "ps_bad")).toEqual({
			ok: false,
			error: expect.stringContaining("401"),
		});
	});

	it("reports a network error", async () => {
		const fetchFn = vi.fn(async () => {
			throw new TypeError("NetworkError when attempting to fetch resource.");
		});
		expect(await ping(fetchFn, "https://s.example", "ps_x")).toEqual({
			ok: false,
			error: "Network error: NetworkError when attempting to fetch resource.",
		});
	});

	it("rejects an unexpected body", async () => {
		const fetchFn = vi.fn(async () => json({ hello: "world" }));
		expect(await ping(fetchFn, "https://s.example", "ps_x")).toEqual({
			ok: false,
			error: "Invalid response from server",
		});
	});
});

describe("request timeout", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("gives up on a server that never answers, and aborts the fetch", async () => {
		vi.useFakeTimers();
		let signal: AbortSignal | undefined;
		// Ignores the abort on purpose: the timeout must not rely on fetch honouring it.
		const fetchFn = vi.fn((_url: string, init: RequestInit) => {
			signal = init.signal ?? undefined;
			return new Promise<Response>(() => {});
		});
		const pending = postStash(fetchFn, "https://s.example", "ps_x", []);
		await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
		expect(await pending).toEqual({
			ok: false,
			error: `Network error: no answer within ${REQUEST_TIMEOUT_MS / 1000}s`,
		});
		expect(signal?.aborted).toBe(true);
	});

	it("applies to ping too", async () => {
		vi.useFakeTimers();
		const fetchFn = vi.fn(() => new Promise<Response>(() => {}));
		const pending = ping(fetchFn, "https://s.example", "ps_x");
		await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
		expect((await pending).ok).toBe(false);
	});
});
