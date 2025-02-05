<script setup lang="js">
import { ref, computed } from 'vue'
import { useStore } from './store.js'
import OpenAI from 'openai'
import { storeToRefs } from "pinia"

import * as YAML from 'yaml'

const store = useStore()

const isAPIKeyDialogOpen = ref(false);
const isAPIKeyDialogDismissable = ref(false);
const tempAPIKey = ref("")
const isSaveButtonDisabled = computed(() => {
  return tempAPIKey.value === ''
})
const isTranslateButtonDisabled = computed(() => {
  return targetLanguage.value === '' || text.value === ''
})
const isInTranslationView = ref(false)

const isTranslating = ref(false)

const sourceLanguage = ref("")
const targetLanguage = ref("")
const text = ref("")

const { settings } = storeToRefs(store)

const isErrorDialogOpen = ref(false)
const errorMessage = ref("No error. Why did this appear?")

const isReasoningDialogOpen = ref(false)

const target = ref('')

let prototypical = {
  sourceLocale: {
    isoCode: "",
    name: ""
  },
  targetLocale: {
    isoCode: "",
    name: ""
  },
  text: ""
};

const trrResult = ref({...prototypical})

const models = [
  {
    id: "o3-mini",
    label: "o3 Mini (reasoning)"  
  },
  {
    id: "o1",
    label: "o1 (reasoning)"  
  },
  {
    id: "gpt-4o",
    label: "GPT 4o"
  },
  {
    id: "gpt-4o-mini",
    label: "GPT 4o Mini"
  }
]

const reasoningModels = ["o3-mini", "o1"]

const isCurrentModelReasoning = computed(() => reasoningModels.includes(store.settings.model))


const trr = computed(() => ({
  sourceLanguage: sourceLanguage.value,
  targetLanguage: targetLanguage.value,
  text: text.value
}))

//const targetX = computed(() => target.value.split(/\n\s*\n/))

if (store.settings.apiKey === '') {
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

  isReasoningDialogOpen.value = true

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  })

  isInTranslationView.value = true
  target.value = ''
  trrResult.value = {...prototypical}

  const openAI = new OpenAI({
    apiKey: store.settings.apiKey,
    dangerouslyAllowBrowser: true /* the API key is only sent to OpenAI */
  })

  try {

    isTranslating.value = true

    var body = {
      model: store.settings.model,
      messages: [
        {role: isCurrentModelReasoning ? "developer" : "system",
          content: `Translate song lyrics from a YAML document and output them in a specified YAML format, ensuring full locale details, ` + (store.settings.rhyme ? 'rhyming, ' : '' ) + `meaning preservation, and dialect consistency.

- Parse the input YAML to obtain the song lyrics and their relevant metadata.
- Translate the lyrics into the desired target language` + (store.settings.rhyme ? ', ensuring that the translated version retains rhyme without losing meaning. ' : '.' ) + `
- Respect and incorporate any existing dialects in both the source and target languages.
- Construct a YAML document with specified properties: \`sourceLocale\`, \`targetLocale\`, and \`text\`.

# Steps

1. **Parse Input**: Extract the song lyrics and locale information from the input YAML document.
2. **Translate Text**: Translate the extracted lyrics into the target language:
` + (store.settings.rhyme ? `   - Ensure the translated version rhymes and preserves the original meaning.` : '') + `
   - Respect and incorporate dialect specifics in the translation.
3. **Construct Output**: Create a YAML document with the following structure:
   - \`sourceLocale\`: Include full locale information with \`isoCode\` and \`name\` of the source language, ensuring language and country specifics.
   - \`targetLocale\`: Include full locale information with \`isoCode\` and \`name\` of the target language, ensuring language and country specifics.
   - \`text\`: The translated lyrics.

# Output Format

The output should be a YAML document with the specified structure.

# Notes

` + (store.settings.rhyme ? '- Ensure the translated text accurately reflects the original meaning and tone while rhyming.' : '' ) + `
- Handle special characters and accents appropriately.
- Maintain consistency with locale information for accuracy, including adherence to the dialect of both the source and target locales.
- Output as YAML directly, without Markdown codeblocks.`},
        {role: "user", content: YAML.stringify(trr.value)}
      ],
      stream: true,
    }

    if (isCurrentModelReasoning) {
      body.reasoning_effort = store.settings.reasoning
    }
    
    console.log(body.messages[0].content)
    console.log(body.messages[1].content)

    const stream = await openAI.chat.completions.create(body)

    var chks = "";
    for await (const chunk of stream) {
      isReasoningDialogOpen.value = false
      //console.log(JSON.parse(JSON.stringify(chunk)))
      const chunkText = chunk.choices[0]?.delta.content || ""
      chks += chunkText
      //if there's a codeblock caught, remove it
      chks.replace("```yaml", "")
      chks.replace("```", "")
      //console.log(chunkText)
      if (chunk.choices[0]?.finish_reason === "stop") {
        isTranslating.value = false
      }
      try {
        var parsed = YAML.parse(chks)
        //if parsed is not an object, ignore 
        if (typeof parsed !== 'object') {
          continue
        }
        trrResult.value = {...prototypical, ...parsed}
      } catch (err) {
      }
    }
  } catch(err) {
    console.log(err)
    errorMessage.value = err.message
    isErrorDialogOpen.value = true
    isInTranslationView.value = false

  }
 
}

function clearFields() {
  sourceLanguage.value = ""
  targetLanguage.value = ""
  text.value = ""
}

function swapLanguages() {
  const temp = sourceLanguage.value
  sourceLanguage.value = targetLanguage.value
  targetLanguage.value = temp
}

function copyTranslation() {
  navigator.clipboard.writeText(trrResult.value.text)
}


</script>

<template>
  <Toolbar class="sticky top-0 z-10 shadow bg-transparent backdrop-blur drop-shadow">
    <template #start>
      <Button icon="pi pi-arrow-left" v-if="isInTranslationView" rounded v-tooltip.right="'Back'"
        @click="isInTranslationView = false" />
    </template>
    <template #center>
      <span class="font-bold">AITranslate Lyrics</span>
    </template>}
    <template #end>
      <Button v-if="!isInTranslationView" label="Translate" class="me-3" rounded @click="doTranslation"
        :disabled="isTranslateButtonDisabled" />
      <ButtonGroup>
        <Button v-if="!isInTranslationView" severity="warn" icon="pi pi-times" rounded v-tooltip.bottom="'Clear'"
          @click="clearFields" />
        <Button v-if="!isInTranslationView" severity="warn" icon="pi pi-refresh" rounded
          v-tooltip.bottom="'Swap languages'" @click="swapLanguages" />
        <Button v-if="!isInTranslationView" severity="warn" icon="pi pi-cog" rounded v-tooltip.left="'Settings'"
          @click="isAPIKeyDialogOpen = true" />
        <Button v-if="isInTranslationView" :disabled="isTranslating" severity="warn" icon="pi pi-copy" rounded
          v-tooltip.bottom="'Copy translation'" @click="copyTranslation" />
      </ButtonGroup>
    </template>
  </Toolbar>
  <Fluid v-if="!isInTranslationView">
    <div class="flex p-5 gap-2.5">

      <div class="flex-auto">
        <IftaLabel>
          <InputText id="sourceLanguageField" type="text" v-model="sourceLanguage"
            placeholder="Leave empty to detect language" />
          <label for="sourceLanguageField">Source language</label>
        </IftaLabel>
      </div>
      <div class="flex-auto">
        <IftaLabel>
          <InputText id="targetLanguageField" type="text" v-model="targetLanguage" />
          <label for="targetLanguageField">Target language</label>
        </IftaLabel>
      </div>

    </div>
    <div class="px-5 pt-0 pb-5">
      <Textarea v-model="text" auto-resize />
    </div>
  </Fluid>
  <div v-else class="p-5">
    <table class="relative table-fixed w-full">
      <thead>
        <tr>
          <th class="text-start" v-if="trrResult.sourceLocale">Original - {{ trrResult.sourceLocale.name ?? "Unknown"
            }}, <code>{{trrResult.sourceLocale.isoCode ?? "UNK"}}</code></th>
          <th class="text-start" v-if="trrResult.targetLocale">Translation - {{ trrResult.targetLocale.name ?? "Unknown"
            }}, <code>{{trrResult.targetLocale.isoCode ?? "UNK"}}</code></th>
        </tr>
      </thead>
      <tbody>

        <tr v-for="(line, lineIndex) in (trr.text.split('\n') ?? [])" v-if="trrResult.text"
          class="hover:bg-surface-200 dark:hover:bg-surface-700">
          <td style="vertical-align: top;">
            <span v-if="line === '  '">&nbsp;</span>
            <span v-else>{{line}}</span>
          </td>
          <td style="vertical-align: top;">
            <span v-if="trrResult.text.split('\n')[lineIndex] == null">&nbsp;</span>
            <span v-else> {{trrResult.text.split('\n')[lineIndex] ?? ''}}</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <Dialog v-model:visible="isAPIKeyDialogOpen" :closable="isAPIKeyDialogDismissable" modal header="Set API key"
    :style="{width: '40rem'}">
    <span class="text-surface-500 dark:text-surface-400 block mb-8">Get an API key from the
      <a href="https://platform.openai.com/api-keys" target="_blank" class="text-color-emphasis">OpenAI
        dashboard</a>.</span>
    <div class="flex items-center gap-4 mb-4">
      <label for="apiKey" class="font-semibold w-40">API key</label>
      <InputText id="apiKey" v-model="tempAPIKey" class="flex-auto" />
    </div>
    <div class="flex items-center gap-4 mb-4">
      <label for="apiKey" class="font-semibold w-40">Model</label>
      <Select v-model="settings.model" :options="models" class="flex-auto" optionLabel="label" optionValue="id" />
    </div>
    <div class="flex items-center gap-4 mb-4">
      <label for="rhyme" class="font-semibold w-40">Should lyrics rhyme?</label>
      <ToggleSwitch v-model="settings.rhyme" onLabel="Yes" offLabel="No" />
    </div>
    <div class="flex items-start gap-4 mb-4">
      <label for="reasoning" class="font-semibold w-40">Reasoning effort</label>
      <div class="flex flex-wrap gap-4 ms-4">
        <div class="flex items-center gap-2">
          <RadioButton v-model="settings.reasoning" inputId="reaLow" name="reasoning" value="low" />
          <label for="reaLow">Low</label>
        </div>
        <div class="flex items-center gap-2">
          <RadioButton v-model="settings.reasoning" inputId="reaMid" name="reasoning" value="medium" />
          <label for="reaMid">Medium</label>
        </div>
        <div class="flex items-center gap-2">
          <RadioButton v-model="settings.reasoning" inputId="reaHigh" name="pizza" value="high" />
          <label for="reaHigh">High</label>
        </div>
        <Message size="small" severity="secondary" variant="simple">Only valid for reasoning models.</Message>
      </div>
    </div>
    <div class="flex justify-end gap-2">
      <Button type="button" label="Cancel" severity="secondary" @click="dismiss"
        v-if="isAPIKeyDialogDismissable"></Button>
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

  <Dialog v-model:visible="isReasoningDialogOpen" modal :header="isCurrentModelReasoning ? 'Reasoning...' : 'Loading...'" :closable="false" :draggable="false" >
    <div class="flex items-center gap-4 mb-4">
      <ProgressSpinner  style="width: 50px; height: 50px" strokeWidth="8"  />
    </div>
  </Dialog>

</template>

<style scoped>
</style>
