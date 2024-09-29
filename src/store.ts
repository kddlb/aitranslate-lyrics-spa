import { defineStore } from "pinia"
import { useStorage } from "@vueuse/core"

const STORE_NAME = "aitranslate"

export const useStore = defineStore(STORE_NAME, {
    state: () => ({
        settings: useStorage(STORE_NAME, {
            apiKey: "",
            model: "gemini-1.5-flash"
        })
    }),
    actions: {
        setApiKey(apiKey:string) {
            this.settings.apiKey = apiKey
        }
    }
})