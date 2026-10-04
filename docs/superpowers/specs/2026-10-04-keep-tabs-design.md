# Keep Tabs: Exclude Chosen Tabs from the Auto-Close Sweep

Date: 2026-10-04
Bead: pageslop-6ta

## Goal

Let the user mark individual tabs that the tab-stash sweep must never close.
The user has roughly ten tabs they always want open. Marking them by hand
from the tab right-click menu, as in Auto Tab Discard's "Keep Tabs", is the
expected workflow.

## Decisions

- **Granularity: one specific tab.** Marking keeps that tab, not its URL or
  domain. Domain-wide exclusion already exists as `excludeDomains` in the
  options page and is unchanged.
- **Lifetime: until the tab is closed.** The mark survives browser restarts
  and session restore. Closing the tab discards the mark; reopening the same
  URL yields an ordinary tab.
- **Storage: `browser.sessions.setTabValue`.** Firefox persists per-tab
  session values across restarts and restores them with the tab, so no
  tab-ID-to-URL matching is needed. The sweep reads the value fresh on every
  run; there is no in-memory cache (the background page may be unloaded).
- **UI: a checkbox in the tab context menu**, titled
  "Keep tab (never auto-close)", plus a "Kept tabs: N" line in the popup.
  No list view, no title or favicon marker.
- **Multi-selection:** if the right-clicked tab is part of a highlighted
  multi-tab selection, the click applies to every highlighted tab in that
  window; otherwise only to the clicked tab.
- **Manual stash is not blocked.** The popup's "stash this tab" action
  ignores the mark; an explicit user action wins.

## Components

### `extension/keep.js` (new)

Pure logic; the `sessions` API is passed in, as `settings.js` takes `storage`.

- `KEEP_KEY = "kept"`
- `setKept(sessions, tabIds, kept)`: for each ID, `setTabValue(id, KEEP_KEY, true)`
  when `kept`, otherwise `removeTabValue(id, KEEP_KEY)`.
- `withKeptFlag(sessions, tabs)`: reads `getTabValue(tab.id, KEEP_KEY)` for all
  tabs in parallel and returns new tab objects with `kept: boolean`.
- `countKept(sessions, tabs)`: number of tabs whose value is set.
- `targetTabs(clickedTab, highlightedTabs)`: returns `highlightedTabs` when
  `clickedTab` is among them, otherwise `[clickedTab]`.

### `extension/select-tabs.js`

`isProtected` gains `if (tab.kept) return true`. Consequences:

- A kept tab is never selected by the idle pass.
- Kept tabs are excluded from the unprotected count used by the `maxTabs`
  cap pass, exactly like pinned tabs. With `maxTabs = 25` and 10 kept tabs,
  25 other tabs may remain open.

`selectTabsToStash` stays synchronous and pure.

### Sweep

After `deps.queryTabs()`, the sweep passes the tabs through
`deps.withKeptFlag(tabs)` before calling `selectTabsToStash`. `makeDeps` in
`background.js` binds `withKeptFlag` to `browser.sessions`.

### `extension/background.js`

- `runtime.onInstalled`: `menus.removeAll()`, then
  `menus.create({ id: "pageslop-keep", type: "checkbox", contexts: ["tab"], title: "Keep tab (never auto-close)" })`.
- `menus.onShown`: when the menu includes `pageslop-keep`, read the clicked
  tab's mark, `menus.update("pageslop-keep", { checked })`, then `menus.refresh()`.
- `menus.onClicked` for `pageslop-keep`: query highlighted tabs in the clicked
  tab's window, compute `targetTabs`, call `setKept(..., info.checked)`.
- `runtime.onMessage` gains `{ type: "kept-count" }`, answering with
  `countKept` over all open tabs.

### `extension/manifest.json`

`permissions` becomes `["tabs", "alarms", "storage", "menus", "sessions"]`.

### Popup

On open, sends `{ type: "kept-count" }` and shows "Kept tabs: N".

## Error Handling

- **Reading a mark fails** (for example, the tab closed mid-sweep):
  `withKeptFlag` marks that tab `kept: true`. Failing safe means not closing
  it. The sweep continues; the error is reported through the existing
  `recordError` path.
- **`browser.sessions` unavailable** (not expected; Firefox 140+ is
  required): `withKeptFlag` returns every tab with `kept: false` and logs one
  warning. The sweep behaves as it does today.
- **Writing a mark fails** from the menu: log to the console. The checkbox
  self-corrects the next time the menu opens, because `onShown` re-reads the
  stored state.
- **Duplicate menu items** on reinstall or update are prevented by
  `menus.removeAll()` before `create`.

## Testing

Vitest with injected fakes, following the existing extension tests.

- `tests/extension/keep.test.ts` (new):
  - `setKept` sets and removes values for several IDs.
  - `withKeptFlag` flags kept and unkept tabs correctly.
  - `withKeptFlag` treats a tab whose read rejects as kept.
  - `withKeptFlag` with no `sessions` API returns all `kept: false`.
  - `countKept` counts correctly.
  - `targetTabs` returns the selection when the clicked tab is in it, and only
    the clicked tab otherwise.
- `tests/extension/select-tabs.test.ts`:
  - An idle kept tab is not selected.
  - Kept tabs do not count toward the `maxTabs` cap.
- `tests/extension/sweep.test.ts`:
  - Kept tabs never reach `removeTabs`.

Test command: `npx vitest run tests/extension`.

Manual check: `web-ext run`, mark a tab "Keep", set `idleHours` very low,
press "Sweep now", and confirm the kept tab survives while other idle tabs
are stashed. Restart Firefox with session restore on and confirm the tab is
still checked in the context menu.

## Out of Scope

- Keeping by URL or by domain from the context menu.
- Bulk actions such as "keep all tabs in this window".
- A list or management view of kept tabs.
