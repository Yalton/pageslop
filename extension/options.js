import { ping } from "./api.js";
import { selectTabsToStash } from "./select-tabs.js";
import {
	loadSettings,
	normalizeSettings,
	saveSettings,
	serverOrigin,
} from "./settings.js";

const storage = browser.storage.local;
const $ = (id) => document.getElementById(id);
const fetchFn = (url, init) => fetch(url, init);

function fillForm(settings) {
	$("serverUrl").value = settings.serverUrl;
	$("token").value = settings.token;
	$("idleHours").value = String(settings.idleHours);
	$("maxTabs").value = String(settings.maxTabs);
	$("excludeDomains").value = settings.excludeDomains.join("\n");
	$("enabled").checked = settings.enabled;
}

// Raw strings on purpose: normalizeSettings converts "6" to 6 and splits the textarea.
function readForm() {
	return {
		serverUrl: $("serverUrl").value,
		token: $("token").value,
		idleHours: $("idleHours").value,
		maxTabs: $("maxTabs").value,
		excludeDomains: $("excludeDomains").value,
		enabled: $("enabled").checked,
	};
}

function setConnected(ok) {
	$("enabled").disabled = !ok;
	$("enabled-hint").hidden = ok;
}

// permissions.request() only works during a user gesture, so this must be called
// synchronously from a click handler, before anything is awaited.
function requestHostPermission(origin) {
	if (origin === "") return Promise.resolve(false);
	return browser.permissions.request({ origins: [`${origin}/*`] });
}

async function showPing(form) {
	const result = await ping(fetchFn, form.serverUrl, form.token);
	setConnected(result.ok);
	$("ping-result").textContent = result.ok
		? `✓ Connected as ${result.email}`
		: `✗ ${result.error}`;
}

async function testConnection(form, permission) {
	$("ping-result").textContent = "Testing…";
	if (form.serverUrl === "") {
		setConnected(false);
		$("ping-result").textContent = "✗ Enter a valid http(s) server URL";
		return;
	}
	if (!(await permission)) {
		setConnected(false);
		$("ping-result").textContent =
			"✗ Permission to reach the server was not granted";
		return;
	}
	if (form.token === "") {
		setConnected(false);
		$("ping-result").textContent = "✗ Enter an API token";
		return;
	}
	await showPing(form);
}

async function save(raw, permission) {
	const granted = await permission;
	const saved = await saveSettings(storage, raw);
	fillForm(saved);
	$("save-result").textContent = granted
		? "Saved"
		: "Saved, but permission to reach the server was not granted. Sweeps will fail until you allow it.";
}

// A passed test applies only to the server and token it ran with.
for (const id of ["serverUrl", "token"]) {
	$(id).addEventListener("input", () => {
		setConnected(false);
		$("ping-result").textContent = "";
	});
}

function failed(target) {
	return (error) => {
		$(target).textContent =
			`✗ ${error instanceof Error ? error.message : String(error)}`;
	};
}

$("test").addEventListener("click", () => {
	const form = normalizeSettings(readForm());
	const permission = requestHostPermission(serverOrigin(form.serverUrl));
	testConnection(form, permission).catch((error) => {
		setConnected(false);
		failed("ping-result")(error);
	});
});

$("save").addEventListener("click", () => {
	const raw = readForm();
	const origin = serverOrigin(normalizeSettings(raw).serverUrl);
	const permission =
		origin === "" ? Promise.resolve(true) : requestHostPermission(origin);
	save(raw, permission).catch(failed("save-result"));
});

$("preview").addEventListener("click", () => {
	preview().catch((error) => {
		const item = document.createElement("li");
		item.textContent = `Could not preview: ${error instanceof Error ? error.message : String(error)}`;
		$("preview-list").replaceChildren(item);
	});
});

async function preview() {
	const stored = await loadSettings(storage);
	const settings = normalizeSettings({ ...stored, ...readForm() });
	const tabs = await browser.tabs.query({});
	const selected = selectTabsToStash(tabs, settings, Date.now());
	const list = $("preview-list");
	list.replaceChildren();
	if (selected.length === 0) {
		const item = document.createElement("li");
		item.textContent = "The next sweep would close nothing.";
		list.append(item);
		return;
	}
	for (const tab of selected) {
		const item = document.createElement("li");
		item.textContent = tab.title ? `${tab.title} (${tab.url})` : tab.url;
		list.append(item);
	}
}

async function init() {
	const settings = await loadSettings(storage);
	fillForm(settings);
	setConnected(false);
	const origin = serverOrigin(settings.serverUrl);
	if (origin === "" || settings.token === "") return;
	// No user gesture here, so only check for an existing grant; never request one.
	if (await browser.permissions.contains({ origins: [`${origin}/*`] }))
		await showPing(settings);
}

init().catch(failed("ping-result"));
