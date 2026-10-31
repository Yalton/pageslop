// Thin fetch wrappers for the pageslop stash API. fetchFn is injected for tests.

export const BATCH_SIZE = 100;

// A hung server must not hold the sweep lock forever.
export const REQUEST_TIMEOUT_MS = 30_000;

const UNAUTHORIZED =
	"Unauthorized (401): the token is missing, wrong or revoked";

export function apiUrl(serverUrl, path) {
	return serverUrl.replace(/\/+$/, "") + path;
}

function messageOf(error) {
	return error instanceof Error ? error.message : String(error);
}

async function request(fetchFn, url, init) {
	const controller = new AbortController();
	let timer;
	// Race the timer as well as aborting, so a fetch that ignores the signal
	// still cannot hang the caller.
	const timeout = new Promise((_, reject) => {
		timer = setTimeout(() => {
			controller.abort();
			reject(new Error(`no answer within ${REQUEST_TIMEOUT_MS / 1000}s`));
		}, REQUEST_TIMEOUT_MS);
	});
	let res;
	try {
		res = await Promise.race([
			fetchFn(url, { ...init, signal: controller.signal }),
			timeout,
		]);
	} catch (error) {
		return { ok: false, error: `Network error: ${messageOf(error)}` };
	} finally {
		clearTimeout(timer);
	}
	if (res.status === 401) return { ok: false, error: UNAUTHORIZED };
	if (!res.ok) {
		// Show the server's own reason when it sends one, e.g. a full queue (429).
		let reason = "";
		try {
			const body = await res.json();
			if (typeof body?.error === "string") reason = `: ${body.error.slice(0, 200)}`;
		} catch {
			// Not JSON: the status alone will do.
		}
		return { ok: false, error: `Server returned ${res.status}${reason}` };
	}
	try {
		return { ok: true, body: await res.json() };
	} catch {
		return { ok: false, error: "Invalid response from server (not JSON)" };
	}
}

export async function postStash(fetchFn, serverUrl, token, tabs) {
	const result = await request(fetchFn, apiUrl(serverUrl, "/api/stash"), {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify({ tabs }),
	});
	if (!result.ok) return result;
	const saved = result.body?.saved;
	if (!Array.isArray(saved) || !saved.every((url) => typeof url === "string")) {
		return { ok: false, error: "Invalid response from server (no saved list)" };
	}
	return { ok: true, saved };
}

export async function ping(fetchFn, serverUrl, token) {
	const result = await request(fetchFn, apiUrl(serverUrl, "/api/stash/ping"), {
		headers: { Authorization: `Bearer ${token}` },
	});
	if (!result.ok) return result;
	const email = result.body?.user?.email;
	if (result.body?.ok !== true || typeof email !== "string") {
		return { ok: false, error: "Invalid response from server" };
	}
	return { ok: true, email };
}
