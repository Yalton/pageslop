import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	KEEP_KEY,
	KEPT_URLS_KEY,
	countKept,
	createMenuGuard,
	keepUrlKey,
	loadKeptUrls,
	refreshKeptUrls,
	setKept,
	setKeptUrls,
	targetTabs,
	withKeptFlag,
} from "../../extension/keep.js";

type FakeTab = { id: number; windowId: number; url: string };

const tab = (id: number, windowId = 1): FakeTab => ({
	id,
	windowId,
	url: `https://example.net/${id}`,
});
const ids = (tabs: { id: number }[]) => tabs.map((t) => t.id);

// In-memory stand-in for browser.sessions. `failing` IDs make getTabValue reject,
// like a tab that closed mid-sweep.
function fakeSessions(kept: number[] = [], failing: number[] = []) {
	const store = new Map<string, unknown>();
	for (const id of kept) store.set(`${id}/${KEEP_KEY}`, true);
	return {
		store,
		setTabValue: vi.fn(async (id: number, key: string, value: unknown) => {
			store.set(`${id}/${key}`, value);
		}),
		removeTabValue: vi.fn(async (id: number, key: string) => {
			store.delete(`${id}/${key}`);
		}),
		getTabValue: vi.fn(async (id: number, key: string) => {
			if (failing.includes(id)) throw new Error(`Invalid tab ID: ${id}`);
			return store.get(`${id}/${key}`);
		}),
	};
}

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
	warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
	warn.mockRestore();
});

describe("KEEP_KEY", () => {
	it('is "kept"', () => {
		expect(KEEP_KEY).toBe("kept");
	});
});

describe("setKept", () => {
	it("sets the value to true for every ID", async () => {
		const sessions = fakeSessions();
		await setKept(sessions, [1, 2, 3], true);
		expect(sessions.setTabValue).toHaveBeenCalledTimes(3);
		expect(sessions.setTabValue).toHaveBeenCalledWith(1, "kept", true);
		expect(sessions.setTabValue).toHaveBeenCalledWith(2, "kept", true);
		expect(sessions.setTabValue).toHaveBeenCalledWith(3, "kept", true);
		expect(sessions.removeTabValue).not.toHaveBeenCalled();
	});

	it("removes the value for every ID when kept is false", async () => {
		const sessions = fakeSessions([1, 2, 3]);
		await setKept(sessions, [1, 3], false);
		expect(sessions.removeTabValue).toHaveBeenCalledWith(1, "kept");
		expect(sessions.removeTabValue).toHaveBeenCalledWith(3, "kept");
		expect(sessions.setTabValue).not.toHaveBeenCalled();
		expect([...sessions.store.keys()]).toEqual(["2/kept"]);
	});

	it("does nothing for an empty ID list", async () => {
		const sessions = fakeSessions();
		await setKept(sessions, [], true);
		expect(sessions.setTabValue).not.toHaveBeenCalled();
	});

	it("rejects when a write fails, so the caller can log it", async () => {
		const sessions = fakeSessions();
		sessions.setTabValue = vi.fn(async () => {
			throw new Error("Invalid tab ID: 9");
		});
		await expect(setKept(sessions, [9], true)).rejects.toThrow(
			"Invalid tab ID",
		);
	});
});

describe("withKeptFlag", () => {
	it("flags kept and unkept tabs without mutating the input", async () => {
		const tabs = [tab(1), tab(2), tab(3)];
		const result = await withKeptFlag(fakeSessions([2]), tabs);
		expect(result).toEqual([
			{ ...tabs[0], kept: false },
			{ ...tabs[1], kept: true },
			{ ...tabs[2], kept: false },
		]);
		expect(tabs[1]).not.toHaveProperty("kept");
	});

	it("reads every tab's mark with KEEP_KEY", async () => {
		const sessions = fakeSessions();
		await withKeptFlag(sessions, [tab(1), tab(2)]);
		expect(sessions.getTabValue).toHaveBeenCalledWith(1, "kept");
		expect(sessions.getTabValue).toHaveBeenCalledWith(2, "kept");
	});

	it("treats a tab whose read rejects as kept, and still flags the others", async () => {
		const result = await withKeptFlag(fakeSessions([], [2]), [
			tab(1),
			tab(2),
			tab(3),
		]);
		expect(result.map((t) => t.kept)).toEqual([false, true, false]);
		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn.mock.calls[0][0]).toContain("tab 2");
	});

	it.each([
		["undefined", undefined],
		["an object without getTabValue", {}],
	])("returns every tab unkept when sessions is %s, with one warning", async (_name, sessions) => {
		const result = await withKeptFlag(sessions, [tab(1), tab(2), tab(3)]);
		expect(result.map((t) => t.kept)).toEqual([false, false, false]);
		expect(warn).toHaveBeenCalledTimes(1);
	});

	it("returns [] for empty or non-array input", async () => {
		expect(await withKeptFlag(fakeSessions(), [])).toEqual([]);
		expect(
			await withKeptFlag(fakeSessions(), undefined as unknown as FakeTab[]),
		).toEqual([]);
	});
});

describe("countKept", () => {
	it("counts the tabs whose value is set", async () => {
		const tabs = [tab(1), tab(2), tab(3), tab(4)];
		expect(await countKept(fakeSessions([1, 3]), tabs)).toBe(2);
		expect(await countKept(fakeSessions(), tabs)).toBe(0);
		expect(await countKept(fakeSessions([1]), [])).toBe(0);
	});

	it("does not count a tab whose read rejects", async () => {
		expect(await countKept(fakeSessions([1, 2], [2]), [tab(1), tab(2)])).toBe(
			1,
		);
	});

	it("returns 0 without a sessions API", async () => {
		expect(await countKept(undefined, [tab(1)])).toBe(0);
	});
});

describe("targetTabs", () => {
	it("returns the whole selection when the clicked tab is in it, matching by id", () => {
		const highlighted = [tab(1), tab(2), tab(3)];
		// A fresh object, as menus.onClicked passes one that is not identical
		// to the tabs.query results.
		expect(ids(targetTabs(tab(2), highlighted))).toEqual([1, 2, 3]);
	});

	it("returns only the clicked tab when it is outside the selection", () => {
		const clicked = tab(9);
		expect(targetTabs(clicked, [tab(1), tab(2)])).toEqual([clicked]);
	});

	it("returns only the clicked tab for an empty or missing selection", () => {
		const clicked = tab(9);
		expect(targetTabs(clicked, [])).toEqual([clicked]);
		expect(targetTabs(clicked, undefined as unknown as FakeTab[])).toEqual([
			clicked,
		]);
	});
});

describe("createMenuGuard", () => {
	it("treats the latest shown menu as current", () => {
		const guard = createMenuGuard();
		const id = guard.open();
		expect(guard.isCurrent(id)).toBe(true);
	});

	it("drops an older menu once a newer one opens", () => {
		const guard = createMenuGuard();
		const first = guard.open();
		const second = guard.open();
		expect(guard.isCurrent(first)).toBe(false);
		expect(guard.isCurrent(second)).toBe(true);
	});

	it("drops the menu once it is hidden", () => {
		const guard = createMenuGuard();
		const id = guard.open();
		guard.close();
		expect(guard.isCurrent(id)).toBe(false);
	});
});

// In-memory stand-in for browser.storage.local.
function fakeStorage(initial: Record<string, unknown> = {}) {
	const data: Record<string, unknown> = { ...initial };
	return {
		data,
		get: vi.fn(async (key: string) =>
			key in data ? { [key]: data[key] } : {},
		),
		set: vi.fn(async (items: Record<string, unknown>) => {
			Object.assign(data, items);
		}),
	};
}

const DAY_MS = 86_400_000;

describe("keepUrlKey", () => {
	it("drops the fragment so a restored page still matches", () => {
		expect(keepUrlKey("https://example.net/a?q=1#section")).toBe(
			"https://example.net/a?q=1",
		);
	});

	it("is null for non-http pages and junk", () => {
		expect(keepUrlKey("about:blank")).toBeNull();
		expect(keepUrlKey("moz-extension://abc/popup.html")).toBeNull();
		expect(keepUrlKey("not a url")).toBeNull();
		expect(keepUrlKey(undefined)).toBeNull();
	});
});

describe("loadKeptUrls", () => {
	it("is empty when nothing is stored", async () => {
		expect(await loadKeptUrls(fakeStorage())).toEqual({});
	});

	it("drops entries that are not timestamps", async () => {
		const storage = fakeStorage({
			[KEPT_URLS_KEY]: { "https://a.test/": 5, "https://b.test/": "x" },
		});
		expect(await loadKeptUrls(storage)).toEqual({ "https://a.test/": 5 });
	});

	it("is empty when the stored value is not an object", async () => {
		const storage = fakeStorage({ [KEPT_URLS_KEY]: ["https://a.test/"] });
		expect(await loadKeptUrls(storage)).toEqual({});
	});
});

describe("setKeptUrls", () => {
	it("adds URLs without their fragment, stamped with now", async () => {
		const storage = fakeStorage();
		await setKeptUrls(
			storage,
			["https://a.test/x#y", "about:blank"],
			true,
			100,
		);
		expect(storage.data[KEPT_URLS_KEY]).toEqual({ "https://a.test/x": 100 });
	});

	it("removes URLs when unticked", async () => {
		const storage = fakeStorage({
			[KEPT_URLS_KEY]: { "https://a.test/": 1, "https://b.test/": 1 },
		});
		await setKeptUrls(storage, ["https://a.test/#top"], false, 100);
		expect(storage.data[KEPT_URLS_KEY]).toEqual({ "https://b.test/": 1 });
	});
});

describe("withKeptFlag with kept URLs", () => {
	it("keeps an unmarked tab whose URL is kept, as after a restore by another add-on", async () => {
		const restored = { id: 7, windowId: 1, url: "https://example.net/7#frag" };
		const result = await withKeptFlag(fakeSessions(), [restored, tab(8)], {
			"https://example.net/7": 1,
		});
		expect(result.map((t) => t.kept)).toEqual([true, false]);
	});

	it("still uses kept URLs when browser.sessions is missing", async () => {
		const result = await withKeptFlag(undefined, [tab(1), tab(2)], {
			"https://example.net/2": 1,
		});
		expect(result.map((t) => t.kept)).toEqual([false, true]);
	});
});

describe("countKept with kept URLs", () => {
	it("counts tabs kept by mark or by URL once each", async () => {
		const count = await countKept(fakeSessions([1]), [tab(1), tab(2), tab(3)], {
			"https://example.net/1": 1,
			"https://example.net/2": 1,
		});
		expect(count).toBe(2);
	});
});

describe("refreshKeptUrls", () => {
	const now = 100 * DAY_MS;

	it("records the current URL of every marked tab", async () => {
		const storage = fakeStorage();
		await refreshKeptUrls(storage, fakeSessions([1]), [tab(1), tab(2)], now);
		expect(storage.data[KEPT_URLS_KEY]).toEqual({
			"https://example.net/1": now,
		});
	});

	it("refreshes kept URLs that are open and keeps recent closed ones", async () => {
		const storage = fakeStorage({
			[KEPT_URLS_KEY]: {
				"https://example.net/2": now - 40 * DAY_MS,
				"https://closed.test/": now - 10 * DAY_MS,
			},
		});
		await refreshKeptUrls(storage, fakeSessions(), [tab(2)], now);
		expect(storage.data[KEPT_URLS_KEY]).toEqual({
			"https://example.net/2": now,
			"https://closed.test/": now - 10 * DAY_MS,
		});
	});

	it("forgets URLs no open tab has shown for 30 days", async () => {
		const storage = fakeStorage({
			[KEPT_URLS_KEY]: { "https://old.test/": now - 31 * DAY_MS },
		});
		await refreshKeptUrls(storage, fakeSessions(), [tab(1)], now);
		expect(storage.data[KEPT_URLS_KEY]).toEqual({});
	});

	it("does not write when nothing changed", async () => {
		const storage = fakeStorage();
		await refreshKeptUrls(storage, fakeSessions(), [tab(1)], now);
		expect(storage.set).not.toHaveBeenCalled();
	});
});
