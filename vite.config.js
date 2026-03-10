import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'login.html'),
        signup: resolve(__dirname, 'signup.html'),
        dashboard: resolve(__dirname, 'dashboard.html'),
        swipe: resolve(__dirname, 'swipe.html'),
        discover: resolve(__dirname, 'discover.html'),
        mealplan: resolve(__dirname, 'mealplan.html'),
        grocery: resolve(__dirname, 'grocery.html'),
        account: resolve(__dirname, 'account.html'),
        profile: resolve(__dirname, 'profile.html'),
      },
    },
  },
});
