# ZenithDesk landing pages

Two pages, one build:

- `index.html`: the Desk landing at **zenithdesk.site**
- `chat.html`: the Chat landing at **chat.zenithdesk.site**, served by nginx at
  the root of the chat server's host

Each is a static page built with Vite and
Tailwind: plain HTML that search engines can read, plus a small script for the
theme toggle, the mobile menu, the chatbot preset demo and scroll reveals.

It shares the portal's brand (logo, Sora/Manrope, colours) and dark mode, and
remembers the theme under the same `zenithdesk_theme` key.

## Develop

```bash
cd landing
npm install
npm run dev        # http://localhost:5300 (Desk) and /chat.html (Chat)
```

## Configure

Copy `.env.example` to `.env.production.local` and set:

- `VITE_PORTAL_URL` is where **Sign in** and **Get started** point. The default
  is `https://portal.zenithdesk.site`.
- `VITE_CHATBOT_URL` and `VITE_CHAT_WIDGET_KEY` are optional. When both are
  set, the page loads the live ZenithDesk chat widget. Add `https://zenithdesk.site`
  to that widget's allowed sites in Settings → Chat widget.

  The same two values turn on the **Contact** section. Its form posts to the
  chat server's `POST /enquiries`, and messages land on the Enquiries page
  marked "contact form". The widget's org must have **Take enquiries** ticked
  in Settings → Chatbot, or the form says the site isn't taking messages.
  Without both values the section and its links stay hidden.

  On the Chat page the same two values turn on the **Live demo** section and
  the "Try the live demo" buttons, which open that widget. List the Chat
  landing's own address (`https://chat.zenithdesk.site`) under the widget's
  allowed sites too.
- `VITE_CHAT_LANDING_URL` and `VITE_DESK_LANDING_URL` are where the two pages
  link to each other. The defaults are `https://chat.zenithdesk.site` and
  `https://zenithdesk.site` (in `npm run dev`, `/chat.html` and `/`).

A beta build reads `.env.beta.local` instead: `npx vite build --mode beta`.

## Deploy

```bash
npm run build      # writes dist/
```

Upload the **contents** of `dist/` to `/var/www/html/zenithdesk-landing` on the
server. Then point the `zenithdesk.site` / `www` server block in nginx at that
folder, in place of the current redirect to the portal:

```nginx
root /var/www/html/zenithdesk-landing;
index index.html;
location / { try_files $uri $uri/ /index.html; }
```

Only build output goes in that folder, never the repo itself.

### The Chat page

`chat.zenithdesk.site` is also the chat server, so its nginx serves only `/`
and the page's files, and passes everything else (`/widget.js`, `/config/…`,
`/chat…`, `/health`) to the chat server as before. Upload the **contents** of
`dist/` to `/var/www/html/zenithdesk-chat-landing` on the chat server's host,
then add these above the existing `location /` in the `chat.zenithdesk.site`
server block:

```nginx
location = / {
    root /var/www/html/zenithdesk-chat-landing;
    try_files /chat.html =404;
}
location /assets/ {
    root /var/www/html/zenithdesk-chat-landing;
    try_files $uri =404;
    expires 1y;
    add_header Cache-Control "public, immutable";
}
location = /favicon.svg {
    root /var/www/html/zenithdesk-chat-landing;
}
```

The chat server itself has no `/assets/` or `/favicon.svg` of its own, so
nothing it serves is shadowed.
