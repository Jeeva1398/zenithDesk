# ZenithDesk landing page

The public site at **zenithdesk.site**. A static page built with Vite and
Tailwind: plain HTML that search engines can read, plus a small script for the
theme toggle, the mobile menu, the chatbot preset demo and scroll reveals.

It shares the portal's brand (logo, Sora/Manrope, colours) and dark mode, and
remembers the theme under the same `zenithdesk_theme` key.

## Develop

```bash
cd landing
npm install
npm run dev        # http://localhost:5300
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
