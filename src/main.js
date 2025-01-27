import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'primeicons/primeicons.css'
import './style.css'
import App from './App.vue'
import PrimeVue from 'primevue/config'
import { definePreset } from '@primevue/themes';
import Aura from '@primevue/themes/aura'
import Tooltip from 'primevue/tooltip';


const pinia = createPinia()

const app = createApp(App)


const MyPreset = definePreset(Aura, {
    semantic: {
        primary: {
            50: '{violet.50}',
            100: '{violet.100}',
            200: '{violet.200}',
            300: '{violet.300}',
            400: '{violet.400}',
            500: '{violet.500}',
            600: '{violet.600}',
            700: '{violet.700}',
            800: '{violet.800}',
            900: '{violet.900}',
            950: '{violet.950}'
        }, 
    }
});

app.use(PrimeVue, {
    theme: {
        preset: MyPreset
    }
});
app.use(pinia)

app.directive('tooltip', Tooltip);

app.mount('#app')
