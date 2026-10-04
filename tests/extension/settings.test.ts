import { describe, expect, it } from "vitest";
import {
	DEFAULTS,
	loadSettings,
	normalizeSettings,
	saveSettings,
	serverOrigin,
} from "../../extension/settings.js";

function fakeStorage(initial: Record<string, unknown> = {}) {
	const data: Record<string, unknown> = { ...initial };
	return {
		data,
		async get(_keys: unknown) {
			return { ...data };
		},
		async set(obj: Record<string, unknown>) {
			Object.assign(data, obj);
		},
	};
}

describe("DEFAULTS", () => {
	it("has the spec defaults", () => {
		expect(DEFAULTS).toEqual({
			serverUrl: "",
			token: "",
			enabled: false,
			idleHours: 6,
			maxTabs: 25,
			excludeDomains: [],
			pausedUntil: 0,
			lastSweep: null,
		});
	});

	it("is frozen", () => {
		expect(Object.isFrozen(DEFAULTS)).toBe(true);
		expect(Object.isFrozen(DEFAULTS.excludeDomains)).toBe(true);
	});
});

describe("normalizeSettings: non-object input", () => {
	it.each([
		undefined,
		null,
		"x",
		42,
		[],
		true,
	])("returns defaults for %p", (raw) => {
		expect(normalizeSettings(raw)).toEqual(DEFAULTS);
	});

	it("returns a fresh excludeDomains array, not the frozen default", () => {
		const s = normalizeSettings({});
		expect(s.excludeDomains).not.toBe(DEFAULTS.excludeDomains);
		s.excludeDomains.push("a.com");
		expect(DEFAULTS.excludeDomains).toEqual([]);
	});

	it("drops unknown keys", () => {
		expect(normalizeSettings({ evil: 1, idleHours: 3 })).toEqual({
			...DEFAULTS,
			idleHours: 3,
		});
	});
});

describe("normalizeSettings: idleHours", () => {
	it.each([
		-1,
		0,
		Number.NaN,
		Number.POSITIVE_INFINITY,
		9000,
		"abc",
		"",
		"-4",
		"1e3",
		null,
		{},
		[],
		true,
	])("falls back to 6 for %p", (value) => {
		expect(normalizeSettings({ idleHours: value }).idleHours).toBe(6);
	});

	it.each([
		[12, 12],
		["12", 12],
		[" 3 ", 3],
		["0.5", 0.5],
		[0.02, 0.02],
		[8760, 8760],
	])("accepts %p as %p", (value, expected) => {
		expect(normalizeSettings({ idleHours: value }).idleHours).toBe(expected);
	});
});

describe("normalizeSettings: maxTabs", () => {
	it.each([
		-5,
		0,
		0.5,
		Number.NaN,
		20000,
		"abc",
		"",
		"1e3",
		null,
	])("falls back to 25 for %p", (value) => {
		expect(normalizeSettings({ maxTabs: value }).maxTabs).toBe(25);
	});

	it.each([
		[10, 10],
		["40", 40],
		[12.7, 12],
		["12.7", 12],
		[1, 1],
	])("accepts %p as %p", (value, expected) => {
		expect(normalizeSettings({ maxTabs: value }).maxTabs).toBe(expected);
	});
});

describe("normalizeSettings: enabled", () => {
	it("is true only for boolean true", () => {
		expect(normalizeSettings({ enabled: true }).enabled).toBe(true);
		expect(normalizeSettings({ enabled: "true" }).enabled).toBe(false);
		expect(normalizeSettings({ enabled: 1 }).enabled).toBe(false);
		expect(normalizeSettings({ enabled: false }).enabled).toBe(false);
	});
});

describe("normalizeSettings: excludeDomains", () => {
	it("cleans an array of entries", () => {
		const s = normalizeSettings({
			excludeDomains: [
				"Example.com",
				" https://www.Foo.com/path?x=1 ",
				"*.bar.com",
				".baz.org.",
				"host.io:8080",
				42,
				null,
				"",
				"example.com",
			],
		});
		expect(s.excludeDomains).toEqual([
			"example.com",
			"www.foo.com",
			"bar.com",
			"baz.org",
			"host.io",
		]);
	});

	it("keeps IPv6 literals in the bracketed form URL.hostname uses", () => {
		const s = normalizeSettings({
			excludeDomains: [
				"::1",
				"[::1]:8080",
				"http://[2001:DB8::1]/x",
				"2001:db8:0:0:0:0:0:2",
			],
		});
		expect(s.excludeDomains).toEqual([
			"[::1]",
			"[2001:db8::1]",
			"[2001:db8::2]",
		]);
	});

	it("splits a textarea string on newlines, commas and spaces", () => {
		const s = normalizeSettings({
			excludeDomains: "a.com\nB.com, c.com  d.com\n\n",
		});
		expect(s.excludeDomains).toEqual(["a.com", "b.com", "c.com", "d.com"]);
	});

	it("falls back to [] for other types", () => {
		expect(normalizeSettings({ excludeDomains: 5 }).excludeDomains).toEqual([]);
		expect(
			normalizeSettings({ excludeDomains: { a: 1 } }).excludeDomains,
		).toEqual([]);
	});
});

describe("normalizeSettings: serverUrl and token", () => {
	it.each([
		["https://slop.example.org/", "https://slop.example.org"],
		["  https://slop.example.org  ", "https://slop.example.org"],
		["http://localhost:3000", "http://localhost:3000"],
		["https://host.example/sub/", "https://host.example/sub"],
		["https://user:pw@host.example/?q=1#x", "https://host.example"],
		["ftp://host.example", ""],
		["not a url", ""],
		["", ""],
		[42, ""],
	])("normalizes serverUrl %p to %p", (value, expected) => {
		expect(normalizeSettings({ serverUrl: value }).serverUrl).toBe(expected);
	});

	it("trims the token and rejects non-strings", () => {
		expect(normalizeSettings({ token: "  ps_abc \n" }).token).toBe("ps_abc");
		expect(normalizeSettings({ token: 123 }).token).toBe("");
	});
});

describe("normalizeSettings: pausedUntil and lastSweep", () => {
	it("clamps pausedUntil", () => {
		expect(normalizeSettings({ pausedUntil: 123 }).pausedUntil).toBe(123);
		expect(normalizeSettings({ pausedUntil: -1 }).pausedUntil).toBe(0);
		expect(normalizeSettings({ pausedUntil: "abc" }).pausedUntil).toBe(0);
		expect(normalizeSettings({ pausedUntil: Number.NaN }).pausedUntil).toBe(0);
	});

	it("keeps a valid lastSweep and drops a non-string error", () => {
		expect(
			normalizeSettings({ lastSweep: { at: 5, stashed: 2 } }).lastSweep,
		).toEqual({ at: 5, stashed: 2 });
		expect(
			normalizeSettings({ lastSweep: { at: 5, stashed: 0, error: "boom" } })
				.lastSweep,
		).toEqual({
			at: 5,
			stashed: 0,
			error: "boom",
		});
		expect(
			normalizeSettings({ lastSweep: { at: 5, stashed: 0, error: 7 } })
				.lastSweep,
		).toEqual({ at: 5, stashed: 0 });
	});

	it.each([
		{ at: "x", stashed: 1 },
		{ at: 1 },
		"yesterday",
		3,
	])("rejects lastSweep %p", (value) => {
		expect(normalizeSettings({ lastSweep: value }).lastSweep).toBeNull();
	});
});

describe("serverOrigin", () => {
	it("returns the origin of a valid URL", () => {
		expect(serverOrigin("https://slop.example.org/sub")).toBe(
			"https://slop.example.org",
		);
		expect(serverOrigin("http://localhost:3000")).toBe("http://localhost:3000");
	});

	it("returns empty for empty or invalid input", () => {
		expect(serverOrigin("")).toBe("");
		expect(serverOrigin("nope")).toBe("");
	});
});

describe("loadSettings / saveSettings", () => {
	it("loads normalized settings from storage", async () => {
		const storage = fakeStorage({
			idleHours: "abc",
			maxTabs: "10",
			junk: true,
		});
		expect(await loadSettings(storage)).toEqual({ ...DEFAULTS, maxTabs: 10 });
	});

	it("merges a patch, normalizes and writes every key back", async () => {
		const storage = fakeStorage({ token: "ps_a", idleHours: 3 });
		const saved = await saveSettings(storage, {
			maxTabs: "12",
			excludeDomains: "a.com\nb.com",
		});
		expect(saved).toEqual({
			...DEFAULTS,
			token: "ps_a",
			idleHours: 3,
			maxTabs: 12,
			excludeDomains: ["a.com", "b.com"],
		});
		expect(storage.data).toMatchObject(saved);
	});
});
