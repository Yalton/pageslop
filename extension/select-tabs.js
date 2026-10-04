// Pure tab selection. No browser APIs. See the spec section "Selection logic".
import { normalizeSettings, serverOrigin } from "./settings.js";

const HOUR_MS = 3_600_000;

export function hostMatches(host, domain) {
	return host === domain || host.endsWith(`.${domain}`);
}

function parseUrl(url) {
	if (typeof url !== "string") return null;
	try {
		return new URL(url);
	} catch {
		return null;
	}
}

// `settings` must already be normalized. `origin` is the server origin, or ''.
export function isProtected(tab, settings, origin) {
	if (tab.kept) return true;
	if (tab.pinned || tab.active || tab.audible || tab.incognito) return true;
	const url = parseUrl(tab.url);
	if (!url || (url.protocol !== "http:" && url.protocol !== "https:"))
		return true;
	if (origin !== "" && url.origin === origin) return true;
	const host = url.hostname.toLowerCase();
	return settings.excludeDomains.some((domain) => hostMatches(host, domain));
}

export function selectTabsToStash(tabs, rawSettings, now) {
	const settings = normalizeSettings(rawSettings);
	const origin = serverOrigin(settings.serverUrl);
	const list = Array.isArray(tabs) ? tabs : [];
	const lastOf = (tab) =>
		Number.isFinite(tab.lastAccessed) ? tab.lastAccessed : now;
	const byAge = (a, b) => lastOf(a) - lastOf(b);

	const candidates = list.filter((tab) => !isProtected(tab, settings, origin));

	// 1. Idle pass.
	const idleMs = settings.idleHours * HOUR_MS;
	const selected = new Set(
		candidates.filter((tab) => now - lastOf(tab) > idleMs),
	);

	// 2. Cap pass. Pinned and kept tabs never count; idle-selected tabs are already leaving.
	let remaining =
		list.filter((tab) => !tab.pinned && !tab.kept).length - selected.size;
	const oldestFirst = candidates
		.filter((tab) => !selected.has(tab))
		.sort(byAge);
	for (const tab of oldestFirst) {
		if (remaining <= settings.maxTabs) break;
		selected.add(tab);
		remaining -= 1;
	}

	// 3. Oldest first.
	return [...selected].sort(byAge);
}
