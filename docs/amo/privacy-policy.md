# Pageslop Autoclose privacy policy

Pageslop Autoclose sends data only to the Pageslop server you enter in its options. It sends nothing to the extension's author or to any other third party, and it contains no analytics or tracking.

What it sends to your server, and when:

- The URL and title of each tab it closes (idle tabs during a sweep, or a tab you stash from the popup), with the time it was closed.
- Your API token, in the Authorization header of each request, so the server knows which account to save to.

What it stores in your browser (extension local storage): your server URL, API token, auto-close settings, excluded domains, the URLs of tabs you marked as kept, and the time and result of the last sweep. Uninstalling the extension removes this data.

What happens on your server is governed by whoever runs that server. Pageslop is self-hosted, so in most cases that is you. Saved links can be archived or deleted from the Pageslop web app at any time.
