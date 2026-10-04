import { apiUrl, ping } from "./api.js";
import { loadSettings, saveSettings } from "./settings.js";
import {
	describeKept,
	describeLastSweep,
	describeResult,
	isPaused,
	nextPausedUntil,
} from "./status.js";

const storage = browser.storage.local;
const $ = (id) => document.getElementById(id);
const fetchFn = (url, init) => fetch(url, init);

function show(message) {
	$("message").textContent = message;
}

async function getActiveTab() {
	const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
	return tab;
}

function hostnameOf(url) {
	try {
		const parsed = new URL(url);
		return parsed.protocol === "http:" || parsed.protocol === "https:"
			? parsed.hostname.toLowerCase()
			: "";
	} catch {
		return "";
	}
}

async function render() {
	const settings = await loadSettings(storage);
	const now = Date.now();
	$("auto").textContent = settings.enabled
		? "Auto-close is on"
		: "Auto-close is off";
	$("last-sweep").textContent = describeLastSweep(settings.lastSweep, now);
	$("pause").textContent = isPaused(settings, now) ? "Resume" : "Pause 1h";
	$("open-revisit").disabled = settings.serverUrl === "";
	return settings;
}

async function renderConnection(settings) {
	if (settings.serverUrl === "" || settings.token === "") {
		$("status").textContent = "Not configured. Open Options to connect.";
		return;
	}
	$("status").textContent = "Checking connection…";
	const result = await ping(fetchFn, settings.serverUrl, settings.token);
	$("status").textContent = result.ok
		? `Connected as ${result.email}`
		: `Not connected: ${result.error}`;
}

async function renderKept() {
	let count;
	try {
		count = await browser.runtime.sendMessage({ type: "kept-count" });
	} catch {
		count = undefined;
	}
	$("kept").textContent = describeKept(count);
}

$("sweep-now").addEventListener("click", async () => {
	show("Stashing…");
	const result = await browser.runtime.sendMessage({ type: "sweep-now" });
	show(describeResult(result));
	await render();
});

$("stash-tab").addEventListener("click", async () => {
	const tab = await getActiveTab();
	if (!tab) return show("No active tab");
	show("Stashing…");
	const result = await browser.runtime.sendMessage({
		type: "stash-tab",
		tabId: tab.id,
	});
	show(describeResult(result));
	await render();
	await renderKept();
});

$("pause").addEventListener("click", async () => {
	const settings = await loadSettings(storage);
	const pausedUntil = nextPausedUntil(settings, Date.now());
	await saveSettings(storage, { pausedUntil });
	show(pausedUntil === 0 ? "Resumed" : "Paused for 1 hour");
	await render();
});

$("exclude-domain").addEventListener("click", async () => {
	const tab = await getActiveTab();
	const host = tab ? hostnameOf(tab.url) : "";
	if (host === "") return show("This page has no domain to exclude");
	const settings = await loadSettings(storage);
	await saveSettings(storage, {
		excludeDomains: [...settings.excludeDomains, host],
	});
	show(`Will never close ${host}`);
});

$("open-revisit").addEventListener("click", async () => {
	const settings = await loadSettings(storage);
	if (settings.serverUrl === "") return;
	await browser.tabs.create({
		url: apiUrl(settings.serverUrl, "/dashboard/revisit"),
	});
	window.close();
});

$("open-options").addEventListener("click", async () => {
	await browser.runtime.openOptionsPage();
	window.close();
});

render().then(renderConnection);
renderKept();
