# TempMail UI — Vercel + Catchmail API

A disposable-inbox UI built directly on the [Catchmail REST API](https://catchmail.io/docs).
There are no accounts or tokens: any address works, and the inbox is read with the address itself.

## Endpoints used
| Action | Request |
| --- | --- |
| List messages | `GET /api/v1/mailbox?address=…&page=…&page_size=50` |
| Read a message | `GET /api/v1/message/{id}?mailbox=…` |
| Delete a message | `DELETE /api/v1/message/{id}?mailbox=…` |
| Download attachment | the `download_url` returned in the message (opened as a normal link) |

## Base URL
- Frontend: `API_BASE` at the top of the script in `public/index.html`.
- Proxy (`api/tempmail.js`): environment variable `CATCHMAIL_BASE` in Vercel (defaults to `https://api.catchmail.io`).
- Domains in the dropdown: `DEFAULT_DOMAINS` in `public/index.html` (catchmail.io, mailistry.com, zeppost.com).
  Users can also add their own domain from the dropdown (MX record → `smtp.catchmail.io`).

## How requests flow
1. The browser calls the Catchmail API directly, so the 1 request/second/IP limit applies per visitor.
2. If the browser cannot reach it (CORS or network), it switches to the Vercel function `/api/tempmail`, which forwards the same calls. In that mode all visitors share the server's IP limit.
3. Requests are queued at least 1.1 s apart; a `429` is retried once.

## Deploy to Vercel
1. Upload the contents of this folder to a GitHub repository.
2. Import the repository in Vercel.
3. Framework Preset: **Other**, Build Command: empty, Output Directory: `public`.
4. Deploy.

## Behaviour
- The last address is remembered in the browser (localStorage), so reloading keeps the same inbox. "Unread" state is also kept per address.
- Inbox refreshes every 10 seconds while Auto-sync is on (paused when the tab is hidden).
- Message view: Text / HTML (sandboxed, no scripts) / Headers tabs, recipients, size, ID and attachments.
- Delete calls the API and removes the message permanently.
- Inboxes are public to anyone who knows the address. Messages are deleted by the service after up to 7 days. Not for sensitive accounts.
