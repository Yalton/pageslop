import { beforeEach, describe, expect, it } from "vitest";
import { hostMatches, selectTabsToStash } from "../../extension/select-tabs.js";
import { DEFAULTS } from "../../extension/settings.js";

const NOW = Date.UTC(2026, 9, 3, 12, 0, 0);
const MIN = 60_000;
const HOUR = 3_600_000;

type FakeTab = {
	id: number;
	windowId: number;
	url?: string;
	title: string;
	pinned: boolean;
	active: boolean;
	audible: boolean;
	incognito: boolean;
	lastAccessed?: number;
	kept?: boolean;
};

let nextId = 1;
beforeEach(() => {
	nextId = 1;
});

function tab(overrides: Partial<FakeTab> = {}): FakeTab {
	const id = overrides.id ?? nextId++;
	return {
		id,
		windowId: 1,
		url: `https://example.net/${id}`,
		title: `Tab ${id}`,
		pinned: false,
		active: false,
		audible: false,
		incognito: false,
		lastAccessed: NOW - HOUR,
		...overrides,
	};
}

const idle = (overrides: Partial<FakeTab> = {}) =>
	tab({ lastAccessed: NOW - 10 * HOUR, ...overrides });
const base = {
	...DEFAULTS,
	serverUrl: "https://slop.example.org",
	token: "ps_test",
};
const ids = (tabs: { id: number }[]) => tabs.map((t) => t.id);

describe("protection rules", () => {
	it.each([
		["pinned", { pinned: true }],
		["kept", { kept: true }],
		["active", { active: true }],
		["audible", { audible: true }],
		["incognito", { incognito: true }],
		["about: page", { url: "about:blank" }],
		["file: page", { url: "file:///home/me/a.html" }],
		["moz-extension: page", { url: "moz-extension://abc/popup.html" }],
		["unparseable url", { url: "not a url" }],
		["missing url", { url: undefined }],
		["server origin", { url: "https://slop.example.org/dashboard/revisit" }],
	])("never selects a %s tab, even when idle", (_name, overrides) => {
		expect(selectTabsToStash([idle(overrides)], base, NOW)).toEqual([]);
	});

	it("does not protect a different port or scheme on the server host", () => {
		const tabs = [
			idle({ url: "https://slop.example.org:8443/x" }),
			idle({ url: "http://slop.example.org/x" }),
		];
		expect(ids(selectTabsToStash(tabs, base, NOW))).toEqual([1, 2]);
	});

	it("selects plain http and https tabs", () => {
		const tabs = [
			idle({ url: "http://a.com/" }),
			idle({ url: "https://b.com/" }),
		];
		expect(ids(selectTabsToStash(tabs, base, NOW))).toEqual([1, 2]);
	});

	it("selects an idle tab whose kept flag is false", () => {
		expect(ids(selectTabsToStash([idle({ kept: false })], base, NOW))).toEqual([
			1,
		]);
	});
});

describe("excludeDomains", () => {
	it("matches the exact host and any subdomain, nothing else", () => {
		const tabs = [
			idle({ url: "https://example.com/a" }),
			idle({ url: "https://www.example.com/b" }),
			idle({ url: "https://a.b.EXAMPLE.com/c" }),
			idle({ url: "https://notexample.com/d" }),
			idle({ url: "https://example.com.evil.net/e" }),
		];
		const settings = { ...base, excludeDomains: ["EXAMPLE.com"] };
		expect(ids(selectTabsToStash(tabs, settings, NOW))).toEqual([4, 5]);
	});

	it("accepts the options textarea string form", () => {
		const tabs = [
			idle({ url: "https://a.com/" }),
			idle({ url: "https://b.com/" }),
		];
		expect(
			ids(selectTabsToStash(tabs, { ...base, excludeDomains: "a.com\n" }, NOW)),
		).toEqual([2]);
	});

	it("hostMatches requires a dot boundary", () => {
		expect(hostMatches("example.com", "example.com")).toBe(true);
		expect(hostMatches("docs.example.com", "example.com")).toBe(true);
		expect(hostMatches("badexample.com", "example.com")).toBe(false);
	});
});

describe("idle pass", () => {
	it("uses a strict boundary at idleHours", () => {
		const tabs = [
			tab({ lastAccessed: NOW - 6 * HOUR }),
			tab({ lastAccessed: NOW - 6 * HOUR - 1 }),
		];
		expect(ids(selectTabsToStash(tabs, base, NOW))).toEqual([2]);
	});

	it("treats a missing lastAccessed as now, so the tab is not idle", () => {
		expect(
			selectTabsToStash([tab({ lastAccessed: undefined })], base, NOW),
		).toEqual([]);
	});

	it("falls back to default idleHours and maxTabs for garbage settings", () => {
		const tabs = [
			tab({ lastAccessed: NOW - 5 * HOUR }),
			tab({ lastAccessed: NOW - 7 * HOUR }),
		];
		const settings = { ...base, idleHours: "abc", maxTabs: -4 };
		expect(ids(selectTabsToStash(tabs, settings, NOW))).toEqual([2]);
	});
});

describe("cap pass", () => {
	it("closes the longest-idle tabs until the count is at maxTabs", () => {
		const tabs = [
			tab({ lastAccessed: NOW - 10 * MIN }),
			tab({ lastAccessed: NOW - 50 * MIN }),
			tab({ lastAccessed: NOW - 30 * MIN }),
			tab({ lastAccessed: NOW - 20 * MIN }),
			tab({ lastAccessed: NOW - 40 * MIN }),
		];
		expect(ids(selectTabsToStash(tabs, { ...base, maxTabs: 3 }, NOW))).toEqual([
			2, 5,
		]);
	});

	it("selects nothing when the cap is already satisfied", () => {
		const tabs = [tab(), tab(), tab()];
		expect(selectTabsToStash(tabs, { ...base, maxTabs: 3 }, NOW)).toEqual([]);
	});

	it("selects nothing when every tab is protected, even far over the cap", () => {
		const tabs = [
			tab({ active: true }),
			tab({ audible: true }),
			tab({ url: "about:blank" }),
			tab({ pinned: true }),
			tab({ url: "https://slop.example.org/" }),
		];
		expect(selectTabsToStash(tabs, { ...base, maxTabs: 1 }, NOW)).toEqual([]);
	});

	it("combines the idle and cap passes without double counting", () => {
		const tabs = [
			tab({ lastAccessed: NOW - 10 * HOUR }),
			tab({ lastAccessed: NOW - 8 * HOUR }),
			tab({ lastAccessed: NOW - 30 * MIN }),
			tab({ lastAccessed: NOW - 20 * MIN }),
			tab({ lastAccessed: NOW - 10 * MIN }),
			tab({ lastAccessed: NOW - 5 * MIN }),
		];
		// 6 tabs - 2 idle = 4 remaining, above 3, so one more (the oldest fresh tab) goes.
		expect(ids(selectTabsToStash(tabs, { ...base, maxTabs: 3 }, NOW))).toEqual([
			1, 2, 3,
		]);
	});

	it("does not count pinned tabs toward the cap", () => {
		const tabs = [
			tab({ pinned: true, lastAccessed: NOW - 10 * HOUR }),
			tab({ pinned: true }),
			tab({ pinned: true }),
			tab(),
			tab(),
			tab(),
		];
		expect(selectTabsToStash(tabs, { ...base, maxTabs: 3 }, NOW)).toEqual([]);
	});

	it("does not count kept tabs toward the cap", () => {
		const tabs = [
			tab({ kept: true }),
			tab({ kept: true }),
			tab({ kept: true }),
			tab(),
			tab(),
			tab(),
		];
		expect(selectTabsToStash(tabs, { ...base, maxTabs: 3 }, NOW)).toEqual([]);
	});

	it("lets maxTabs other tabs stay open next to 10 kept tabs", () => {
		const kept = Array.from({ length: 10 }, () => tab({ kept: true }));
		// Ids 11..36; id 36 is the oldest (26 minutes).
		const others = Array.from({ length: 26 }, (_, i) =>
			tab({ lastAccessed: NOW - (i + 1) * MIN }),
		);
		expect(
			ids(selectTabsToStash([...kept, ...others], { ...base, maxTabs: 25 }, NOW)),
		).toEqual([36]);
	});

	it("leaves a pinned and kept tab out of the count once, not twice", () => {
		const tabs = [
			tab({ pinned: true, kept: true }),
			tab({ lastAccessed: NOW - 40 * MIN }),
			tab({ lastAccessed: NOW - 30 * MIN }),
			tab({ lastAccessed: NOW - 20 * MIN }),
			tab({ lastAccessed: NOW - 10 * MIN }),
		];
		// 4 countable tabs, cap 3: exactly the oldest one goes.
		expect(ids(selectTabsToStash(tabs, { ...base, maxTabs: 3 }, NOW))).toEqual([
			2,
		]);
	});

	it("counts protected unpinned tabs toward the cap but never selects them", () => {
		const tabs = [
			tab({ active: true, lastAccessed: NOW - 2 * HOUR }),
			tab({ audible: true, lastAccessed: NOW - 2 * HOUR }),
			tab({ lastAccessed: NOW - 30 * MIN }),
			tab({ lastAccessed: NOW - 20 * MIN }),
		];
		expect(ids(selectTabsToStash(tabs, { ...base, maxTabs: 3 }, NOW))).toEqual([
			3,
		]);
	});

	it("picks tabs with a missing lastAccessed last", () => {
		const tabs = [
			tab({ lastAccessed: undefined }),
			tab({ lastAccessed: NOW - 30 * MIN }),
		];
		expect(ids(selectTabsToStash(tabs, { ...base, maxTabs: 1 }, NOW))).toEqual([
			2,
		]);
	});
});

describe("output", () => {
	it("orders the result by lastAccessed ascending", () => {
		const tabs = [
			idle({ lastAccessed: NOW - 7 * HOUR }),
			idle({ lastAccessed: NOW - 9 * HOUR }),
			idle({ lastAccessed: NOW - 8 * HOUR }),
		];
		expect(ids(selectTabsToStash(tabs, base, NOW))).toEqual([2, 3, 1]);
	});

	it("does not mutate the input array", () => {
		const tabs = [
			idle({ lastAccessed: NOW - 7 * HOUR }),
			idle({ lastAccessed: NOW - 9 * HOUR }),
		];
		const before = ids(tabs);
		selectTabsToStash(tabs, base, NOW);
		expect(ids(tabs)).toEqual(before);
	});

	it("returns [] for empty or non-array input", () => {
		expect(selectTabsToStash([], base, NOW)).toEqual([]);
		expect(
			selectTabsToStash(undefined as unknown as FakeTab[], base, NOW),
		).toEqual([]);
	});
});
