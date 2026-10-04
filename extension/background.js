// Background event page (MV3, ES module). Wires browser APIs into sweep.js.
import {
	countKept,
	createMenuGuard,
	setKept,
	targetTabs,
	withKeptFlag,
} from "./keep.js";
import { loadSettings, saveSettings } from "./settings.js";
import { runSweep, stashTab } from "./sweep.js";

const ALARM_NAME = "pageslop-sweep";
const KEEP_MENU_ID = "pageslop-keep";
const SWEEP_PERIOD_MINUTES = 5;
const storage = browser.storage.local;

function makeDeps(extra = {}) {
	return {
		queryTabs: () => browser.tabs.query({}),
		getTab: (id) => browser.tabs.get(id),
		removeTabs: (ids) => browser.tabs.remove(ids),
		fetch: (url, init) => fetch(url, init),
		getSettings: () => loadSettings(storage),
		setBadge: async (text, color) => {
			await browser.action.setBadgeText({ text });
			if (color) await browser.action.setBadgeBackgroundColor({ color });
		},
		recordError: async (message) => {
			await saveSettings(storage, {
				lastSweep: { at: Date.now(), stashed: 0, error: message },
			});
		},
		recordSuccess: async (stashed) => {
			await saveSettings(storage, { lastSweep: { at: Date.now(), stashed } });
		},
		withKeptFlag: (tabs) => withKeptFlag(browser.sessions, tabs),
		now: () => Date.now(),
		...extra,
	};
}

// Create the alarm only if it is missing. Re-creating it on every wake-up
// of the event page would keep resetting the 5-minute timer.
async function ensureAlarm() {
	const existing = await browser.alarms.get(ALARM_NAME);
	if (!existing)
		browser.alarms.create(ALARM_NAME, {
			periodInMinutes: SWEEP_PERIOD_MINUTES,
		});
}

browser.runtime.onInstalled.addListener(ensureAlarm);
browser.runtime.onStartup.addListener(ensureAlarm);
ensureAlarm();

// Menu items persist with the extension, so create them on install or update.
// removeAll first keeps an update from leaving a duplicate item behind.
async function createMenus() {
	await browser.menus.removeAll();
	browser.menus.create({
		id: KEEP_MENU_ID,
		type: "checkbox",
		contexts: ["tab"],
		title: "Keep tab (never auto-close)",
	});
}

browser.runtime.onInstalled.addListener(createMenus);
browser.runtime.onStartup.addListener(createMenus);

const menuGuard = createMenuGuard();

// Re-read the stored mark each time, so the checkbox also self-corrects
// after a failed write.
browser.menus.onShown.addListener(async (info, tab) => {
	if (!tab || !info.menuIds.includes(KEEP_MENU_ID)) return;
	const menuId = menuGuard.open();
	try {
		const checked = (await countKept(browser.sessions, [tab])) > 0;
		if (!menuGuard.isCurrent(menuId)) return;
		await browser.menus.update(KEEP_MENU_ID, { checked });
		await browser.menus.refresh();
	} catch (error) {
		console.error("Could not show the keep mark", error);
	}
});

browser.menus.onHidden.addListener(() => menuGuard.close());

// A click applies to the whole highlighted selection when the clicked tab
// is part of it, otherwise only to the clicked tab.
browser.menus.onClicked.addListener(async (info, tab) => {
	if (info.menuItemId !== KEEP_MENU_ID || !tab) return;
	try {
		const highlighted = await browser.tabs.query({
			windowId: tab.windowId,
			highlighted: true,
		});
		const ids = targetTabs(tab, highlighted).map((t) => t.id);
		await setKept(browser.sessions, ids, info.checked);
	} catch (error) {
		console.error("Could not update the keep mark", error);
	}
});

async function keptCount() {
	return countKept(browser.sessions, await browser.tabs.query({}));
}

browser.alarms.onAlarm.addListener((alarm) => {
	if (alarm.name === ALARM_NAME) runSweep(makeDeps());
});

// Returning a Promise from onMessage sends its value back to the sender.
browser.runtime.onMessage.addListener((message) => {
	if (!message || typeof message !== "object") return undefined;
	if (message.type === "sweep-now") return runSweep(makeDeps({ force: true }));
	if (message.type === "kept-count") return keptCount();
	if (message.type === "stash-tab" && Number.isInteger(message.tabId)) {
		return stashTab(makeDeps(), message.tabId);
	}
	return undefined;
});
