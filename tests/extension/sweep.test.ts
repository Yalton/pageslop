import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KEEP_KEY, withKeptFlag } from "../../extension/keep.js";
import { DEFAULTS } from "../../extension/settings.js";
import {
	ERROR_BADGE_COLOR,
	runSweep,
	stashTab,
} from "../../extension/sweep.js";

const NOW = Date.UTC(2026, 9, 3, 12, 0, 0);
const HOUR = 3_600_000;
const SERVER = "https://slop.example.org";

type FakeTab = {
	id: number;
	windowId: number;
	url: string;
	title: string;
	pinned: boolean;
	active: boolean;
	audible: boolean;
	incognito: boolean;
	lastAccessed: number;
};

function idleTab(
	id: number,
	url: string,
	extra: Partial<FakeTab> = {},
): FakeTab {
	return {
		id,
		windowId: 1,
		url,
		title: `T${id}`,
		pinned: false,
		active: false,
		audible: false,
		incognito: false,
		lastAccessed: NOW - 10 * HOUR,
		...extra,
	};
}

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

// Echoes every posted URL back in `saved`, like a healthy server.
function echoFetch() {
	return vi.fn(async (_url: string, init: RequestInit) => {
		const body = JSON.parse(init.body as string) as { tabs: { url: string }[] };
		return json({ saved: body.tabs.map((t) => t.url), rejected: [] });
	});
}

type Opts = {
	tabs?: FakeTab[];
	settings?: Record<string, unknown>;
	fetch?: (url: string, init: RequestInit) => Promise<Response>;
	// What getTab returns at close time. An Error value makes getTab reject.
	current?: Record<number, FakeTab | Error>;
	force?: boolean;
	// Tab IDs marked "keep", and IDs whose mark read rejects.
	kept?: number[];
	keptReadFails?: number[];
};

// Stand-in for browser.sessions, read through the real withKeptFlag.
function fakeSessions(kept: number[], failing: number[]) {
	return {
		getTabValue: vi.fn(async (id: number, key: string) => {
			if (failing.includes(id)) throw new Error(`Invalid tab ID: ${id}`);
			return key === KEEP_KEY && kept.includes(id) ? true : undefined;
		}),
	};
}

// biome-ignore lint/suspicious/noExplicitAny: test double bag
function makeDeps(opts: Opts = {}): Record<string, any> {
	const tabs = opts.tabs ?? [
		idleTab(1, "https://a.com/1"),
		idleTab(2, "https://b.com/2"),
	];
	const current = opts.current ?? {};
	const sessions = fakeSessions(opts.kept ?? [], opts.keptReadFails ?? []);
	return {
		queryTabs: vi.fn(async () => tabs),
		getTab: vi.fn(async (id: number) => {
			const override = current[id];
			if (override instanceof Error) throw override;
			if (override) return override;
			const found = tabs.find((t) => t.id === id);
			if (!found) throw new Error(`Invalid tab ID: ${id}`);
			return found;
		}),
		removeTabs: vi.fn(async (_ids: number[]) => {}),
		fetch: opts.fetch ?? echoFetch(),
		getSettings: vi.fn(async () => ({
			...DEFAULTS,
			serverUrl: SERVER,
			token: "ps_test",
			enabled: true,
			...opts.settings,
		})),
		setBadge: vi.fn(async (_text: string, _color?: string) => {}),
		recordError: vi.fn(async (_message: string) => {}),
		recordSuccess: vi.fn(async (_stashed: number) => {}),
		withKeptFlag: vi.fn((list: FakeTab[]) => withKeptFlag(sessions, list)),
		now: () => NOW,
		force: opts.force,
	};
}

const closedIds = (deps: ReturnType<typeof makeDeps>) =>
	deps.removeTabs.mock.calls.flatMap((call: [number[]]) => call[0]);

describe("runSweep: success", () => {
	it("posts selected tabs, closes confirmed ones, clears the badge and records success", async () => {
		const deps = makeDeps();
		const result = await runSweep(deps);

		expect(result).toEqual({ stashed: 2 });
		expect(deps.fetch).toHaveBeenCalledTimes(1);
		const [url, init] = deps.fetch.mock.calls[0];
		expect(url).toBe(`${SERVER}/api/stash`);
		expect(init.method).toBe("POST");
		expect(init.headers.Authorization).toBe("Bearer ps_test");
		const closedAt = new Date(NOW).toISOString();
		expect(JSON.parse(init.body)).toEqual({
			tabs: [
				{ url: "https://a.com/1", title: "T1", closedAt },
				{ url: "https://b.com/2", title: "T2", closedAt },
			],
		});
		expect(closedIds(deps)).toEqual([1, 2]);
		expect(deps.setBadge).toHaveBeenCalledWith("");
		expect(deps.setBadge).not.toHaveBeenCalledWith("!", expect.anything());
		expect(deps.recordSuccess).toHaveBeenCalledWith(2);
		expect(deps.recordError).not.toHaveBeenCalled();
	});

	it("omits an empty title from the payload", async () => {
		const deps = makeDeps({
			tabs: [idleTab(1, "https://a.com/", { title: "" })],
		});
		await runSweep(deps);
		expect(JSON.parse(deps.fetch.mock.calls[0][1].body).tabs[0]).toEqual({
			url: "https://a.com/",
			closedAt: new Date(NOW).toISOString(),
		});
	});

	it("does not call the server when nothing is selected, and still records success", async () => {
		const deps = makeDeps({
			tabs: [idleTab(1, "https://a.com/", { lastAccessed: NOW - HOUR })],
		});
		expect(await runSweep(deps)).toEqual({ stashed: 0 });
		expect(deps.fetch).not.toHaveBeenCalled();
		expect(deps.removeTabs).not.toHaveBeenCalled();
		expect(deps.setBadge).toHaveBeenCalledWith("");
		expect(deps.recordSuccess).toHaveBeenCalledWith(0);
	});

	it("closes only the tabs whose URL the server saved", async () => {
		const fetch = vi.fn(async () =>
			json({
				saved: ["https://a.com/1"],
				rejected: [{ url: "https://b.com/2", reason: "x" }],
			}),
		);
		const deps = makeDeps({ fetch });
		expect(await runSweep(deps)).toEqual({ stashed: 1 });
		expect(closedIds(deps)).toEqual([1]);
	});

	it("closes every selected tab that shares a saved URL", async () => {
		const tabs = [
			idleTab(1, "https://a.com/same"),
			idleTab(2, "https://a.com/same"),
		];
		const fetch = vi.fn(async () =>
			json({ saved: ["https://a.com/same"], rejected: [] }),
		);
		const deps = makeDeps({ tabs, fetch });
		expect(await runSweep(deps)).toEqual({ stashed: 2 });
		expect(closedIds(deps)).toEqual([1, 2]);
	});

	it("compares URLs byte-for-byte (trailing slash and fragment)", async () => {
		const tabs = [
			idleTab(1, "https://a.com/page/"),
			idleTab(2, "https://a.com/page#x"),
		];
		const fetch = vi.fn(async () =>
			json({ saved: ["https://a.com/page"], rejected: [] }),
		);
		const deps = makeDeps({ tabs, fetch });
		expect(await runSweep(deps)).toEqual({ stashed: 0 });
		expect(deps.removeTabs).not.toHaveBeenCalled();
	});

	it("posts in batches of 100", async () => {
		const tabs = Array.from({ length: 150 }, (_, i) =>
			idleTab(i + 1, `https://a.com/${i + 1}`, {
				lastAccessed: NOW - 10 * HOUR - (150 - i),
			}),
		);
		const deps = makeDeps({ tabs });
		expect(await runSweep(deps)).toEqual({ stashed: 150 });
		expect(deps.fetch).toHaveBeenCalledTimes(2);
		expect(JSON.parse(deps.fetch.mock.calls[0][1].body).tabs).toHaveLength(100);
		expect(JSON.parse(deps.fetch.mock.calls[1][1].body).tabs).toHaveLength(50);
		expect(closedIds(deps)).toHaveLength(150);
	});
});

describe("runSweep: Review Focus #3, failures close nothing", () => {
	function expectFailed(
		deps: ReturnType<typeof makeDeps>,
		result: unknown,
		fragment: string,
	) {
		expect(result).toEqual({ error: expect.stringContaining(fragment) });
		expect(deps.removeTabs).not.toHaveBeenCalled();
		expect(deps.setBadge).toHaveBeenCalledWith("!", ERROR_BADGE_COLOR);
		expect(deps.recordError).toHaveBeenCalledWith(
			expect.stringContaining(fragment),
		);
		expect(deps.recordSuccess).not.toHaveBeenCalled();
	}

	it("server down (network error)", async () => {
		const deps = makeDeps({
			fetch: vi.fn(async () => {
				throw new TypeError("NetworkError when attempting to fetch resource.");
			}),
		});
		expectFailed(deps, await runSweep(deps), "Network error");
	});

	it("500 response", async () => {
		const deps = makeDeps({
			fetch: vi.fn(async () => new Response("boom", { status: 500 })),
		});
		expectFailed(deps, await runSweep(deps), "500");
	});

	it("401 response", async () => {
		const deps = makeDeps({
			fetch: vi.fn(async () => json({ error: "Unauthorized" }, 401)),
		});
		expectFailed(deps, await runSweep(deps), "401");
	});

	it("200 with an HTML body (login redirect)", async () => {
		const deps = makeDeps({
			fetch: vi.fn(
				async () => new Response("<html>login</html>", { status: 200 }),
			),
		});
		expectFailed(deps, await runSweep(deps), "Invalid response");
	});

	it("200 with JSON but no saved array", async () => {
		const deps = makeDeps({ fetch: vi.fn(async () => json({ ok: true })) });
		expectFailed(deps, await runSweep(deps), "Invalid response");
	});

	it("an exception from storage", async () => {
		const deps = makeDeps();
		deps.getSettings = vi.fn(async () => {
			throw new Error("storage exploded");
		});
		expectFailed(deps, await runSweep(deps), "storage exploded");
		expect(deps.fetch).not.toHaveBeenCalled();
	});

	it("a failing second batch leaves its tabs open; the confirmed first batch is closed", async () => {
		const tabs = Array.from({ length: 150 }, (_, i) =>
			idleTab(i + 1, `https://a.com/${i + 1}`, {
				lastAccessed: NOW - 10 * HOUR - (150 - i),
			}),
		);
		const echo = echoFetch();
		let call = 0;
		const fetch = vi.fn(async (url: string, init: RequestInit) => {
			call += 1;
			if (call === 2) return new Response("boom", { status: 503 });
			return echo(url, init);
		});
		const deps = makeDeps({ tabs, fetch });
		const result = await runSweep(deps);
		expect(result).toEqual({ error: "Server returned 503" });
		expect(closedIds(deps)).toHaveLength(100);
		expect(closedIds(deps)).toEqual(tabs.slice(0, 100).map((t) => t.id));
		expect(deps.setBadge).toHaveBeenCalledWith("!", ERROR_BADGE_COLOR);
	});
});

describe("runSweep: Review Focus #4, tabs that changed after selection", () => {
	it("keeps a tab open when it navigated to another URL", async () => {
		const deps = makeDeps({
			current: { 2: idleTab(2, "https://elsewhere.com/") },
		});
		expect(await runSweep(deps)).toEqual({ stashed: 1 });
		expect(closedIds(deps)).toEqual([1]);
	});

	it("keeps a tab open when it became active", async () => {
		const deps = makeDeps({
			current: { 1: idleTab(1, "https://a.com/1", { active: true }) },
		});
		expect(await runSweep(deps)).toEqual({ stashed: 1 });
		expect(closedIds(deps)).toEqual([2]);
	});

	it("keeps a tab open when it became pinned", async () => {
		const deps = makeDeps({
			current: { 1: idleTab(1, "https://a.com/1", { pinned: true }) },
		});
		expect(await runSweep(deps)).toEqual({ stashed: 1 });
		expect(closedIds(deps)).toEqual([2]);
	});

	it("skips a tab that no longer exists", async () => {
		const deps = makeDeps({ current: { 1: new Error("Invalid tab ID: 1") } });
		expect(await runSweep(deps)).toEqual({ stashed: 1 });
		expect(closedIds(deps)).toEqual([2]);
	});
});

describe("runSweep: skip conditions and settings", () => {
	it("does nothing when disabled", async () => {
		const deps = makeDeps({ settings: { enabled: false } });
		expect(await runSweep(deps)).toEqual({ stashed: 0, skipped: "disabled" });
		expect(deps.queryTabs).not.toHaveBeenCalled();
		expect(deps.fetch).not.toHaveBeenCalled();
	});

	it('treats enabled: "true" (a string) as disabled', async () => {
		const deps = makeDeps({ settings: { enabled: "true" } });
		expect(await runSweep(deps)).toEqual({ stashed: 0, skipped: "disabled" });
	});

	it.each([
		["token", { token: "" }],
		["server URL", { serverUrl: "" }],
		["valid server URL", { serverUrl: "not a url" }],
	])("does nothing without a %s, even when forced", async (_name, settings) => {
		const deps = makeDeps({ settings, force: true });
		expect(await runSweep(deps)).toEqual({
			stashed: 0,
			skipped: "unconfigured",
		});
		expect(deps.fetch).not.toHaveBeenCalled();
	});

	it("does nothing while paused", async () => {
		const deps = makeDeps({ settings: { pausedUntil: NOW + 1000 } });
		expect(await runSweep(deps)).toEqual({ stashed: 0, skipped: "paused" });
		expect(deps.fetch).not.toHaveBeenCalled();
	});

	it("runs once the pause has passed", async () => {
		const deps = makeDeps({ settings: { pausedUntil: NOW - 1 } });
		expect(await runSweep(deps)).toEqual({ stashed: 2 });
	});

	it("force bypasses disabled and paused", async () => {
		const deps = makeDeps({
			settings: { enabled: false, pausedUntil: NOW + HOUR },
			force: true,
		});
		expect(await runSweep(deps)).toEqual({ stashed: 2 });
	});

	it("uses defaults for garbage idleHours and maxTabs", async () => {
		const tabs = [
			idleTab(1, "https://a.com/", { lastAccessed: NOW - 5 * HOUR }),
			idleTab(2, "https://b.com/", { lastAccessed: NOW - 7 * HOUR }),
		];
		const deps = makeDeps({
			tabs,
			settings: { idleHours: -3, maxTabs: "abc" },
		});
		expect(await runSweep(deps)).toEqual({ stashed: 1 });
		expect(closedIds(deps)).toEqual([2]);
	});

	it("refuses to start a second sweep while one is running", async () => {
		let release: (r: Response) => void = () => {};
		const pending = new Promise<Response>((resolve) => {
			release = resolve;
		});
		const first = makeDeps({ fetch: vi.fn(() => pending) });
		const firstRun = runSweep(first);

		const second = makeDeps();
		expect(await runSweep(second)).toEqual({ stashed: 0, skipped: "busy" });
		expect(second.queryTabs).not.toHaveBeenCalled();

		release(
			json({ saved: ["https://a.com/1", "https://b.com/2"], rejected: [] }),
		);
		expect(await firstRun).toEqual({ stashed: 2 });

		// The lock is released afterwards.
		expect(await runSweep(makeDeps())).toEqual({ stashed: 2 });
	});
});

describe("runSweep: kept tabs", () => {
	let warn: ReturnType<typeof vi.spyOn>;
	beforeEach(() => {
		warn = vi.spyOn(console, "warn").mockImplementation(() => {});
	});
	afterEach(() => {
		warn.mockRestore();
	});

	const threeTabs = () => [
		idleTab(1, "https://a.com/1"),
		idleTab(2, "https://b.com/2"),
		idleTab(3, "https://c.com/3"),
	];

	it("never posts or closes a kept tab", async () => {
		const deps = makeDeps({ tabs: threeTabs(), kept: [2] });
		expect(await runSweep(deps)).toEqual({ stashed: 2 });
		expect(closedIds(deps)).toEqual([1, 3]);
		const posted = JSON.parse(deps.fetch.mock.calls[0][1].body).tabs.map(
			(t: { url: string }) => t.url,
		);
		expect(posted).toEqual(["https://a.com/1", "https://c.com/3"]);
		expect(deps.withKeptFlag).toHaveBeenCalledTimes(1);
	});

	it("closes nothing and skips the server when every idle tab is kept", async () => {
		const deps = makeDeps({ tabs: threeTabs(), kept: [1, 2, 3] });
		expect(await runSweep(deps)).toEqual({ stashed: 0 });
		expect(deps.fetch).not.toHaveBeenCalled();
		expect(deps.removeTabs).not.toHaveBeenCalled();
		expect(deps.recordSuccess).toHaveBeenCalledWith(0);
	});

	it("leaves a tab open when its mark cannot be read, and stashes the rest", async () => {
		const deps = makeDeps({ tabs: threeTabs(), keptReadFails: [1] });
		expect(await runSweep(deps)).toEqual({ stashed: 2 });
		expect(closedIds(deps)).toEqual([2, 3]);
		expect(deps.recordSuccess).toHaveBeenCalledWith(2);
		expect(deps.setBadge).not.toHaveBeenCalledWith("!", expect.anything());
		expect(warn).toHaveBeenCalled();
	});
});

describe("stashTab", () => {
	it("stashes and closes a protected (active, pinned) tab", async () => {
		const tab = idleTab(7, "https://a.com/x", {
			active: true,
			pinned: true,
			lastAccessed: NOW,
		});
		const deps = makeDeps({ tabs: [tab], settings: { enabled: false } });
		expect(await stashTab(deps, 7)).toEqual({ stashed: 1 });
		expect(closedIds(deps)).toEqual([7]);
		expect(JSON.parse(deps.fetch.mock.calls[0][1].body).tabs).toEqual([
			{
				url: "https://a.com/x",
				title: "T7",
				closedAt: new Date(NOW).toISOString(),
			},
		]);
	});

	it("stashes a kept tab anyway, without reading keep marks", async () => {
		const deps = makeDeps({ tabs: [idleTab(7, "https://a.com/x")], kept: [7] });
		expect(await stashTab(deps, 7)).toEqual({ stashed: 1 });
		expect(closedIds(deps)).toEqual([7]);
		expect(deps.withKeptFlag).not.toHaveBeenCalled();
	});

	it("refuses non-http tabs without calling the server", async () => {
		const deps = makeDeps({ tabs: [idleTab(7, "about:config")] });
		expect(await stashTab(deps, 7)).toEqual({
			error: "Only http and https pages can be stashed",
		});
		expect(deps.fetch).not.toHaveBeenCalled();
	});

	it("requires a configured server", async () => {
		const deps = makeDeps({ settings: { token: "" } });
		expect(await stashTab(deps, 1)).toEqual({
			error: "Set the server URL and token in Options first",
		});
		expect(deps.fetch).not.toHaveBeenCalled();
	});

	it("closes nothing and sets the error badge when the server fails", async () => {
		const deps = makeDeps({
			fetch: vi.fn(async () => new Response("boom", { status: 500 })),
		});
		expect(await stashTab(deps, 1)).toEqual({ error: "Server returned 500" });
		expect(deps.removeTabs).not.toHaveBeenCalled();
		expect(deps.setBadge).toHaveBeenCalledWith("!", ERROR_BADGE_COLOR);
		expect(deps.recordError).toHaveBeenCalledWith("Server returned 500");
	});

	it("keeps the tab open if it navigated while the request was in flight", async () => {
		const deps = makeDeps();
		deps.getTab = vi
			.fn()
			.mockResolvedValueOnce(idleTab(1, "https://a.com/1"))
			.mockResolvedValueOnce(idleTab(1, "https://a.com/moved"));
		expect(await stashTab(deps, 1)).toEqual({ stashed: 0 });
		expect(deps.removeTabs).not.toHaveBeenCalled();
	});
});
