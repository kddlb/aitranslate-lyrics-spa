<script setup lang="ts">
import { ref, computed, Ref } from 'vue'
import { useStore } from './store.ts'
import OpenAI from 'openai'
import { storeToRefs } from "pinia"

import { zodResponseFormat } from 'openai/helpers/zod'
import { z } from 'zod'

import { JSONParser } from '@streamparser/json'

const trrObject = z.object({
  sourceLanguage: z.string(),
  targetLanguage: z.string(),
  text: z.array(z.string())
})

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

const models: {
  id: string,
  label: string
}[] = [
  {
    id: "gpt-4o",
    label: "GPT 4o"
  },
  {
    id: "gpt-4o-mini",
    label: "GPT 4o Mini"
  }
]

type TranslationRequestAndResponse = {
  sourceLanguage: string,
  targetLanguage: string,
  text: string[]
}

const trrResult : Ref<TranslationRequestAndResponse> = ref({
  sourceLanguage: "",
  targetLanguage: "",
  text: []
})

const trr = computed(() => ({
  sourceLanguage: sourceLanguage.value,
  targetLanguage: targetLanguage.value,
  text: text.value.split(/\n\s*\n/)
}))

//const targetX = computed(() => target.value.split(/\n\s*\n/))

if (store.settings.apiKey == '' || store.settings.model.includes('gemini') || !store.settings.model.includes("gpt-4")) {
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


  isInTranslationView.value = true
  target.value = ''

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  })

  isInTranslationView.value = true
  target.value = ''
  trrResult.value = {
    sourceLanguage: "",
    targetLanguage: "",
    text: []
  }

  const openAI = new OpenAI({
    apiKey: store.settings.apiKey,
    dangerouslyAllowBrowser: true /* the API key is only sent to OpenAI */
  })

  try {

    const parser = new JSONParser()
    parser.onValue = (parsed) => {
      console.log(parsed)
      if (parsed.key == 'sourceLanguage') {
        trrResult.value.sourceLanguage = parsed.value as string
      } else if (parsed.key == 'targetLanguage') {
        trrResult.value.targetLanguage = parsed.value as string
      } else if (typeof parsed.key == 'number') {
        trrResult.value.text[parsed.key] = parsed.value as string
      }

      if (typeof parsed.key == 'undefined') {
        trrResult.value = parsed.value as TranslationRequestAndResponse
      }
    }

    const stream = await openAI.chat.completions.create({
      model: store.settings.model,
      messages: [
        {role: "system", content: `Translate provided song lyrics into the specified language, ensuring dialect accuracy, and format the output as an HTML text array. Each paragraph in the original lyrics should correspond to one element in the array.

# Steps

1. Read and understand the provided song lyrics.
2. Identify the target language and dialect specified.
3. Translate each paragraph of the lyrics into the specified language and dialect.
4. Format the translated paragraphs as elements within an HTML text array.
5. Add a header with the language name, country, and language ISO code.

# Output Format

- The output should be in an HTML-formatted text array.
- Header format for language details: "Language name (country; locale ISO code [en_US or es_CL or whatever])".
- Each element of the array represents a paragraph from the original lyrics.

# Notes

- Ensure to only output the translated lyrics, maintaining paragraph integrity.
- If the dialect is specified, ensure adherence to it throughout the translation.
- Make sure that the output is formatted as HTML, with <br> tags for line breaks.`},
        {role: "user", content: JSON.stringify(trr.value)}
      ],
      stream: true,
      response_format: zodResponseFormat(trrObject, "trr")
    })

    for await (const chunk of stream) {
      //console.log(JSON.parse(JSON.stringify(chunk)))
      const chunkText = chunk.choices[0]?.delta.content || ""
      target.value += chunkText
      parser.write(chunkText)
    }
  } catch(err: any) {
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
        <th class="text-start">Original - {{ trrResult.sourceLanguage }}</th>
        <th class="text-start">Translation - {{ trrResult.targetLanguage }}</th>
      </tr>
      </thead>
      <tbody>
      <tr v-for="(verse, vix) in trr.text">
        <td class="pb-5 align-top" ><VueMarkdown :source="verse.trim() + '\n'" /></td>
        <td class="pb-1 align-top">
          <span v-if="typeof trrResult.text[vix] === 'undefined' || trrResult.text[vix] == ''"><ProgressSpinner style="width: 25px; height: 25px"  /> Loading</span>
          <span v-else><span v-html="trrResult.text[vix].trim()" /></span>
        </td>
      </tr>
      </tbody>
    </table>
  </div>

  <Dialog v-model:visible="isAPIKeyDialogOpen" :closable="isAPIKeyDialogDismissable" modal header="Set API key" :style="{width: '40rem'}">
    <span class="text-surface-500 dark:text-surface-400 block mb-8">Get an API key from the
      <a href="https://platform.openai.com/api-keys" target="_blank" class="text-color-emphasis">OpenAI dashboard</a>.</span>
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
