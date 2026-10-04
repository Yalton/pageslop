// Pure text helpers for the popup.

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

const SKIP_MESSAGES = {
	busy: "A sweep is already running",
	unconfigured: "Set the server URL and token in Options first",
	disabled: "Auto-close is off",
	paused: "Paused",
};

function plural(n, word) {
	return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function timeAgo(at, now) {
	const diff = Math.max(0, now - at);
	if (diff < MINUTE_MS) return "just now";
	if (diff < HOUR_MS) return `${Math.floor(diff / MINUTE_MS)} min ago`;
	if (diff < DAY_MS) return `${Math.floor(diff / HOUR_MS)} h ago`;
	return `${Math.floor(diff / DAY_MS)} d ago`;
}

export function describeLastSweep(lastSweep, now) {
	if (!lastSweep) return "No sweep yet";
	const ago = timeAgo(lastSweep.at, now);
	if (lastSweep.error) return `Last sweep failed ${ago}: ${lastSweep.error}`;
	if (lastSweep.stashed === 0) return `Last sweep ${ago}: nothing to stash`;
	return `Last sweep ${ago}: stashed ${plural(lastSweep.stashed, "tab")}`;
}

export function describeResult(result) {
	if (!result || typeof result !== "object")
		return "No response from the extension background";
	if (typeof result.error === "string") return `Failed: ${result.error}`;
	if (result.skipped && SKIP_MESSAGES[result.skipped])
		return SKIP_MESSAGES[result.skipped];
	if (result.stashed === 0) return "Nothing to stash";
	return `Stashed ${plural(result.stashed, "tab")}`;
}

export function isPaused(settings, now) {
	return settings.pausedUntil > now;
}

export function nextPausedUntil(settings, now) {
	return isPaused(settings, now) ? 0 : now + HOUR_MS;
}

// The background answers kept-count with a number. Anything else (an error,
// or an older background without the handler) is shown as unknown.
export function describeKept(count) {
	return Number.isInteger(count) && count >= 0
		? `Kept tabs: ${count}`
		: "Kept tabs: unknown";
}
