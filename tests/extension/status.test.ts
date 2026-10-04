import { describe, expect, it } from "vitest";
import {
	describeLastSweep,
	describeResult,
	isPaused,
	nextPausedUntil,
	timeAgo,
} from "../../extension/status.js";

const NOW = Date.UTC(2026, 9, 3, 12, 0, 0);
const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

describe("timeAgo", () => {
	it.each([
		[NOW, "just now"],
		[NOW - 59_000, "just now"],
		[NOW + 5_000, "just now"],
		[NOW - 5 * MIN, "5 min ago"],
		[NOW - 3 * HOUR - 10 * MIN, "3 h ago"],
		[NOW - 2 * DAY - HOUR, "2 d ago"],
	])("formats %p", (at, expected) => {
		expect(timeAgo(at, NOW)).toBe(expected);
	});
});

describe("describeLastSweep", () => {
	it("handles no sweep yet", () => {
		expect(describeLastSweep(null, NOW)).toBe("No sweep yet");
	});

	it("describes a success", () => {
		expect(describeLastSweep({ at: NOW - 5 * MIN, stashed: 3 }, NOW)).toBe(
			"Last sweep 5 min ago: stashed 3 tabs",
		);
		expect(describeLastSweep({ at: NOW - 5 * MIN, stashed: 1 }, NOW)).toBe(
			"Last sweep 5 min ago: stashed 1 tab",
		);
		expect(describeLastSweep({ at: NOW, stashed: 0 }, NOW)).toBe(
			"Last sweep just now: nothing to stash",
		);
	});

	it("describes a failure with its error", () => {
		expect(
			describeLastSweep(
				{ at: NOW - 2 * HOUR, stashed: 0, error: "Server returned 500" },
				NOW,
			),
		).toBe("Last sweep failed 2 h ago: Server returned 500");
	});
});

describe("describeResult", () => {
	it.each([
		[{ stashed: 0 }, "Nothing to stash"],
		[{ stashed: 1 }, "Stashed 1 tab"],
		[{ stashed: 4 }, "Stashed 4 tabs"],
		[{ stashed: 0, skipped: "busy" }, "A sweep is already running"],
		[
			{ stashed: 0, skipped: "unconfigured" },
			"Set the server URL and token in Options first",
		],
		[{ stashed: 0, skipped: "disabled" }, "Auto-close is off"],
		[{ stashed: 0, skipped: "paused" }, "Paused"],
		[{ error: "Server returned 500" }, "Failed: Server returned 500"],
		[undefined, "No response from the extension background"],
		["weird", "No response from the extension background"],
	])("describes %p", (result, expected) => {
		expect(describeResult(result)).toBe(expected);
	});
});

describe("pause helpers", () => {
	it("isPaused compares against now", () => {
		expect(isPaused({ pausedUntil: NOW + 1 }, NOW)).toBe(true);
		expect(isPaused({ pausedUntil: NOW }, NOW)).toBe(false);
		expect(isPaused({ pausedUntil: 0 }, NOW)).toBe(false);
	});

	it("nextPausedUntil toggles between one hour from now and 0", () => {
		expect(nextPausedUntil({ pausedUntil: 0 }, NOW)).toBe(NOW + HOUR);
		expect(nextPausedUntil({ pausedUntil: NOW + 10 * MIN }, NOW)).toBe(0);
	});
});
