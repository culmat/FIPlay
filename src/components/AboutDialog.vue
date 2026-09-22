<template>
  <dialog
    ref="el"
    class="sheet sheet--center"
    aria-label="About FIPlay"
    @close="ui.aboutOpen = false"
    @click.self="ui.aboutOpen = false"
  >
    <div
      class="sheet__panel about"
      tabindex="-1"
      autofocus
    >
      <div class="about__head">
        <Icon
          class="about__mark"
          :path="mdiRadio"
          :size="26"
        />
        <h2 class="about__title">
          FIPlay
        </h2>
        <button
          class="btn btn--icon about__close"
          aria-label="Close"
          @click="ui.aboutOpen = false"
        >
          <Icon
            :path="mdiClose"
            :size="20"
          />
        </button>
      </div>

      <p class="about__text">
        A small player for FIP radio. Listen in this browser, or send a station to the
        Raumfeld speakers on your network.
      </p>

      <a
        class="about__link"
        href="https://github.com/culmat/FIPlay"
        rel="noopener noreferrer"
        target="_blank"
      >
        <Icon
          :path="mdiGithub"
          :size="20"
        />
        <span>Source on GitHub</span>
        <Icon
          class="about__ext"
          :path="mdiOpenInNew"
          :size="16"
        />
      </a>

      <a
        class="about__link"
        href="https://github.com/culmat/FIPlay/blob/main/LICENSE"
        rel="noopener noreferrer"
        target="_blank"
      >
        <Icon
          :path="mdiScaleBalance"
          :size="20"
        />
        <span>Apache License 2.0</span>
        <Icon
          class="about__ext"
          :path="mdiOpenInNew"
          :size="16"
        />
      </a>

      <p
        v-if="version"
        class="about__version"
      >
        Build {{ version }}
      </p>
    </div>
  </dialog>
</template>

<script setup>
import { mdiClose, mdiGithub, mdiOpenInNew, mdiRadio, mdiScaleBalance } from '@mdi/js'

import { ui } from '@/ui'

const el = ref(null)
const version = ref('')

// Sync rather than toggle, for the same reason as the output sheet.
async function sync () {
  if (!el.value) return
  if (ui.aboutOpen && !el.value.open) {
    el.value.showModal()
    if (!version.value) version.value = await readVersion()
  }
  if (!ui.aboutOpen && el.value.open) el.value.close()
}

watch(() => ui.aboutOpen, sync)
onMounted(sync)

/** Written by `bun run deploy`; absent on the dev server and on GitHub Pages. */
async function readVersion () {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}version.json`, { cache: 'no-store' })
    if (!res.ok) return ''
    const info = await res.json()
    return info.short ? `${info.short}${info.dirty ? ' (dirty)' : ''}` : ''
  } catch {
    return ''
  }
}
</script>

<style scoped>
.about {
  padding: 16px;
}

.about__head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.about__mark {
  color: var(--accent);
}

.about__title {
  font-size: 1.125rem;
  font-weight: 700;
  flex: 1 1 auto;
}

.about__close {
  margin-right: -6px;
  color: var(--text-3);
}

.about__text {
  color: var(--text-2);
  font-size: 0.9375rem;
  line-height: 1.5;
  margin-bottom: 14px;
}

.about__link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: var(--radius-sm);
  font-size: 0.9375rem;
  transition: background var(--dur) var(--ease);
}

.about__link:hover {
  background: rgba(255, 255, 255, 0.05);
}

.about__link:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.about:focus {
  outline: none;
}

.about__link span {
  flex: 1 1 auto;
}

.about__ext {
  color: var(--text-3);
}

.about__version {
  padding: 10px 12px 2px;
  font-size: 0.75rem;
  color: var(--text-3);
}
</style>
