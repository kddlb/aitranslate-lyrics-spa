import { defineStore } from "pinia"
import { useStorage } from "@vueuse/core"

const STORE_NAME = "aitranslate"

export const useStore = defineStore(STORE_NAME, {
    state: () => ({
        settings: useStorage(STORE_NAME, {
            apiKey: "",
            model: "gpt-4o",
            reasoning: "medium",
            rhyme: false
        })
    }),
    actions: {
        setApiKey(apiKey) {
            this.settings.apiKey = apiKey
        }
    }
})