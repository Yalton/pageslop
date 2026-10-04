// Background event page (MV3, ES module). Wires browser APIs into sweep.js.
import { withKeptFlag } from "./keep.js";
import { loadSettings, saveSettings } from "./settings.js";
import { runSweep, stashTab } from "./sweep.js";

const ALARM_NAME = "pageslop-sweep";
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

browser.alarms.onAlarm.addListener((alarm) => {
	if (alarm.name === ALARM_NAME) runSweep(makeDeps());
});

// Returning a Promise from onMessage sends its value back to the sender.
browser.runtime.onMessage.addListener((message) => {
	if (!message || typeof message !== "object") return undefined;
	if (message.type === "sweep-now") return runSweep(makeDeps({ force: true }));
	if (message.type === "stash-tab" && Number.isInteger(message.tabId)) {
		return stashTab(makeDeps(), message.tabId);
	}
	return undefined;
});
