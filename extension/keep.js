// Per-tab "keep" marks, stored with browser.sessions so they survive restarts
// and session restore. The sessions API is injected, as settings.js takes storage.
//
// Firefox carries session values over only through its own restore, undo
// close and duplicate. Session-manager add-ons restore by opening new tabs,
// so kept URLs are also stored in storage.local, and a tab whose URL is kept
// counts as kept too.

export const KEEP_KEY = "kept";
export const KEPT_URLS_KEY = "keptUrls";
// A kept URL that no open tab has shown for this long is forgotten.
export const KEPT_URL_TTL_MS = 30 * 86_400_000;

function messageOf(error) {
	return error instanceof Error ? error.message : String(error);
}

function hasSessions(sessions) {
	return typeof sessions?.getTabValue === "function";
}

// true or false, or null when the read failed (for example, the tab closed).
async function readMark(sessions, tabId) {
	try {
		return (await sessions.getTabValue(tabId, KEEP_KEY)) !== undefined;
	} catch (error) {
		console.warn(
			`Could not read the keep mark of tab ${tabId}: ${messageOf(error)}`,
		);
		return null;
	}
}

// The stored form of a URL: http(s) only, without the fragment, so a page
// restored at a different #anchor still matches. null for anything else.
export function keepUrlKey(url) {
	if (typeof url !== "string") return null;
	let parsed;
	try {
		parsed = new URL(url);
	} catch {
		return null;
	}
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
	parsed.hash = "";
	return parsed.href;
}

// { [url]: lastSeenMs }. Malformed storage reads as empty.
export async function loadKeptUrls(storage) {
	const stored = (await storage.get(KEPT_URLS_KEY))?.[KEPT_URLS_KEY];
	if (!stored || typeof stored !== "object" || Array.isArray(stored)) return {};
	const out = {};
	for (const [url, seen] of Object.entries(stored)) {
		if (Number.isFinite(seen)) out[url] = seen;
	}
	return out;
}

export async function setKeptUrls(storage, urls, kept, now) {
	const stored = await loadKeptUrls(storage);
	for (const url of urls) {
		const key = keepUrlKey(url);
		if (key === null) continue;
		if (kept) stored[key] = now;
		else delete stored[key];
	}
	await storage.set({ [KEPT_URLS_KEY]: stored });
}

function keptByUrl(keptUrls, tab) {
	const key = keepUrlKey(tab.url);
	return key !== null && Object.hasOwn(keptUrls, key);
}

// Records the current URL of every marked tab, refreshes kept URLs that are
// still open, and forgets those unseen for KEPT_URL_TTL_MS.
export async function refreshKeptUrls(storage, sessions, tabs, now) {
	const list = Array.isArray(tabs) ? tabs : [];
	const stored = await loadKeptUrls(storage);
	const before = JSON.stringify(stored);
	const marks = hasSessions(sessions)
		? await Promise.all(list.map((tab) => readMark(sessions, tab.id)))
		: list.map(() => false);
	list.forEach((tab, i) => {
		const key = keepUrlKey(tab.url);
		if (key === null) return;
		if (marks[i] === true || Object.hasOwn(stored, key)) stored[key] = now;
	});
	for (const [url, seen] of Object.entries(stored)) {
		if (now - seen > KEPT_URL_TTL_MS) delete stored[url];
	}
	if (JSON.stringify(stored) !== before)
		await storage.set({ [KEPT_URLS_KEY]: stored });
}

export async function setKept(sessions, tabIds, kept) {
	await Promise.all(
		tabIds.map((id) =>
			kept
				? sessions.setTabValue(id, KEEP_KEY, true)
				: sessions.removeTabValue(id, KEEP_KEY),
		),
	);
}

// Returns copies of `tabs` with `kept: boolean`. A mark that cannot be read
// counts as kept, so the sweep fails safe and leaves that tab open.
// A tab whose URL is in `keptUrls` counts as kept as well.
export async function withKeptFlag(sessions, tabs, keptUrls = {}) {
	const list = Array.isArray(tabs) ? tabs : [];
	if (!hasSessions(sessions)) {
		console.warn("browser.sessions is unavailable; only kept URLs are used");
		return list.map((tab) => ({ ...tab, kept: keptByUrl(keptUrls, tab) }));
	}
	const marks = await Promise.all(
		list.map((tab) => readMark(sessions, tab.id)),
	);
	return list.map((tab, i) => ({
		...tab,
		kept: marks[i] !== false || keptByUrl(keptUrls, tab),
	}));
}

// Counts tabs with a mark that was read successfully, or a kept URL.
export async function countKept(sessions, tabs, keptUrls = {}) {
	const list = Array.isArray(tabs) ? tabs : [];
	const marks = hasSessions(sessions)
		? await Promise.all(list.map((tab) => readMark(sessions, tab.id)))
		: list.map(() => false);
	return list.filter((tab, i) => marks[i] === true || keptByUrl(keptUrls, tab))
		.length;
}

// The tabs a context-menu click applies to: the whole highlighted selection
// when the clicked tab is part of it, otherwise only the clicked tab.
export function targetTabs(clickedTab, highlightedTabs) {
	const list = Array.isArray(highlightedTabs) ? highlightedTabs : [];
	return list.some((tab) => tab.id === clickedTab.id) ? list : [clickedTab];
}

// menus.onShown handlers are async, so a later menu can open (or this one
// close) before the stored mark has been read. Each shown menu gets an id;
// update the checkbox only while that id is still the current menu.
export function createMenuGuard() {
	let current = 0;
	let next = 1;
	return {
		open() {
			current = next++;
			return current;
		},
		isCurrent(id) {
			return id === current;
		},
		close() {
			current = 0;
		},
	};
}
