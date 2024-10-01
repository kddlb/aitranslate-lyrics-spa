<script setup lang="ts">
import { ref, computed } from 'vue'
import { useStore } from './store.ts'
import {
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory
} from "@google/generative-ai";
import { storeToRefs } from "pinia";

import VueMarkdown from 'vue-markdown-render'

const store = useStore()

const isAPIKeyDialogOpen = ref(false);
const isAPIKeyDialogDismissable = ref(false);
const tempAPIKey = ref("")
const isSaveButtonDisabled = computed(() => {
  return tempAPIKey.value == ''
})
const isTranslateButtonDisabled = computed(() => {
  return targetLanguage.value == '' || text.value == ''
})
const isInTranslationView = ref(false)

const sourceLanguage = ref("")
const targetLanguage = ref("")
const text = ref("")

const { settings } = storeToRefs(store)

const isErrorDialogOpen = ref(false)
const errorMessage = ref("No error. Why did this appear?")

const target = ref('')
const promptTokens = ref(0)
const completionTokens = ref(0)
const totalTokens = ref(0)

const models = [
  {
    id: "gemini-1.5-flash",
    label: "Gemini 1.5 Flash"
  },
    {
    id: "gemini-1.5-pro",
    label: "Gemini 1.5 Pro"
  },
  {
    id: "gemini-1.5-flash-002",
    label: "Gemini 1.5 Flash 002"
  },
  {
    id: "gemini-1.5-pro-002",
    label: "Gemini 1.5 Pro 002"
  }
]

const trr = computed(() => ({
  sourceLanguage: sourceLanguage.value,
  targetLanguage: targetLanguage.value,
  text: text.value.split(/\n\s*\n/)
}))

const targetX = computed(() => target.value.split(/\n\s*\n/))


if (store.settings.apiKey == '') {
  isAPIKeyDialogOpen.value = true
  isAPIKeyDialogDismissable.value = false
} else {
  isAPIKeyDialogOpen.value = false
  isAPIKeyDialogDismissable.value = true
  tempAPIKey.value = store.settings.apiKey
}

function save() {
  store.setApiKey(tempAPIKey.value)
  isAPIKeyDialogOpen.value = false
}

function dismiss() {
  tempAPIKey.value = store.settings.apiKey
  isAPIKeyDialogOpen.value = false
}

function dismissError() {
  isErrorDialogOpen.value = false
}

async function doTranslation() {

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  })

  isInTranslationView.value = true
  target.value = ''
  promptTokens.value = 0
  completionTokens.value = 0
  totalTokens.value = 0


  const genAI = new GoogleGenerativeAI(store.settings.apiKey)
  const model = genAI.getGenerativeModel({
    model: store.settings.model,
    systemInstruction: "Translate these song lyrics. Only output the lyrics. Preserve paragraph breaks.",
    safetySettings: [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_NONE
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE
      }
    ]
  })

  const prompt = JSON.stringify(trr.value)

  try {
    const result = await model.generateContentStream(prompt)

    for await (const chunk of result.stream) {
      console.log(JSON.parse(JSON.stringify(chunk)))
      const chunkText = chunk.text();
      target.value += chunkText
      promptTokens.value = chunk.usageMetadata?.promptTokenCount || 0
      completionTokens.value = chunk.usageMetadata?.candidatesTokenCount || 0
      totalTokens.value = chunk.usageMetadata?.totalTokenCount || 0
    }

  } catch (err: any) {
    console.log(err)
    errorMessage.value = err.message
    isErrorDialogOpen.value = true
    isInTranslationView.value = false
  }
  

}


</script>

<template>
  <Toolbar class="sticky top-0 z-10 shadow bg-transparent backdrop-blur drop-shadow">
    <template #start>
      <Button icon="pi pi-arrow-left" v-if="isInTranslationView" rounded v-tooltip.right="'Back'" @click="isInTranslationView = false" />
    </template>
    <template #center>
      <span class="font-bold">AITranslate Lyrics</span>
    </template>}
    <template #end>
      <Button v-if="!isInTranslationView" label="Translate" class="me-3" rounded @click="doTranslation" :disabled="isTranslateButtonDisabled" />
      <Button v-if="!isInTranslationView" icon="pi pi-cog" rounded v-tooltip.left="'Settings'" @click="isAPIKeyDialogOpen = true" />

    </template>
  </Toolbar>
  <Fluid v-if="!isInTranslationView">
  <div class="flex p-5 gap-2.5">

    <div class="flex-auto">
      <FloatLabel>
        <InputText id="sourceLanguageField" type="text" v-model="sourceLanguage" placeholder="Leave empty to detect language"/>
        <label for="sourceLanguageField">Source language</label>
      </FloatLabel>
    </div>
    <div class="flex-auto">
      <FloatLabel>
        <InputText id="targetLanguageField" type="text" v-model="targetLanguage"/>
        <label for="targetLanguageField">Target language</label>
      </FloatLabel>
    </div>

  </div>
    <div class="px-5 pt-0 pb-5">
      <Textarea v-model="text" auto-resize/>
    </div>
  </Fluid>
  <div v-else class="p-5">
    <table class="relative table-fixed w-full">
      <thead>
      <tr>
        <th colspan="2" class="pb-5 start">Tokens used: {{totalTokens}}</th>
      </tr>
      <tr>
        <th class="text-start" v-tooltip="promptTokens">Original</th>
        <th class="text-start">Translation</th>
      </tr>
      </thead>
      <tbody>
      <tr v-for="(verse, vix) in trr.text">
        <td class="pb-5 align-top" ><VueMarkdown :source="verse.trim()" /></td>
        <td class="whitespace-pre-wrap pb-5 align-top">
          <span v-if="typeof targetX[vix] === 'undefined' || targetX[vix] == ''"><ProgressSpinner style="width: 25px; height: 25px"  /> Loading</span>
          <span v-else><VueMarkdown :source="targetX[vix].trim()" /></span>
        </td>
      </tr>
      </tbody>
    </table>
  </div>

  <Dialog v-model:visible="isAPIKeyDialogOpen" :closable="isAPIKeyDialogDismissable" modal header="Set API key" :style="{width: '40rem'}">
    <span class="text-surface-500 dark:text-surface-400 block mb-8">Get an API key from the
      <a href="https://aistudio.google.com/app/apikey" target="_blank" class="text-color-emphasis">Google AI Studio</a>.</span>
    <div class="flex items-center gap-4 mb-4">
      <label for="apiKey" class="font-semibold w-24">API key</label>
      <InputText id="apiKey" v-model="tempAPIKey" class="flex-auto" />
    </div>
    <div class="flex items-center gap-4 mb-4">
      <label for="apiKey" class="font-semibold w-24">Model</label>
      <Select v-model="settings.model" :options="models" class="flex-auto" optionLabel="label" optionValue="id" />
    </div>
    <div class="flex justify-end gap-2">
      <Button type="button" label="Cancel" severity="secondary" @click="dismiss" v-if="isAPIKeyDialogDismissable"></Button>
      <Button type="button" label="Save" @click="save" :disabled="isSaveButtonDisabled"></Button>
    </div>
  </Dialog>

  <Dialog v-model:visible="isErrorDialogOpen" modal header="Error" :style="{width: '40rem'}">
    <span class="block mb-8">
      {{errorMessage}}
    </span>

    <div class="flex justify-end gap-2">
      <Button type="button" label="Cancel" severity="secondary" @click="dismissError"></Button>
    </div>

  </Dialog>
</template>

<style scoped>
</style>
