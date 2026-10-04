// Per-tab "keep" marks, stored with browser.sessions so they survive restarts
// and session restore. The sessions API is injected, as settings.js takes storage.

export const KEEP_KEY = "kept";

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
export async function withKeptFlag(sessions, tabs) {
	const list = Array.isArray(tabs) ? tabs : [];
	if (!hasSessions(sessions)) {
		console.warn("browser.sessions is unavailable; keep marks are ignored");
		return list.map((tab) => ({ ...tab, kept: false }));
	}
	const marks = await Promise.all(
		list.map((tab) => readMark(sessions, tab.id)),
	);
	return list.map((tab, i) => ({ ...tab, kept: marks[i] !== false }));
}

// Counts only marks that were read successfully.
export async function countKept(sessions, tabs) {
	const list = Array.isArray(tabs) ? tabs : [];
	if (!hasSessions(sessions)) return 0;
	const marks = await Promise.all(
		list.map((tab) => readMark(sessions, tab.id)),
	);
	return marks.filter((mark) => mark === true).length;
}

// The tabs a context-menu click applies to: the whole highlighted selection
// when the clicked tab is part of it, otherwise only the clicked tab.
export function targetTabs(clickedTab, highlightedTabs) {
	const list = Array.isArray(highlightedTabs) ? highlightedTabs : [];
	return list.some((tab) => tab.id === clickedTab.id) ? list : [clickedTab];
}
