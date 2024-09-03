import vueDebounce from 'vue-debounce'
import { createApp } from 'vue'
import App from './App.vue'
import vuetify from './plugins/vuetify'
import { loadFonts } from './plugins/webfontloader'
import './assets/global.css';

loadFonts()

createApp(App)
  .directive('debounce', vueDebounce({ lock: true }))
  .use(vuetify)
  .mount('#app')
