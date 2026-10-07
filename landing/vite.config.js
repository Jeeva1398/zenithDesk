import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

// Two pages: the Desk landing (zenithdesk.site) and the Chat landing
// (chat.zenithdesk.site), sharing the brand, styles and script.
export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        chat: 'chat.html',
      },
    },
  },
});
