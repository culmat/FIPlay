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

      <div class="about__share">
        <button
          class="about__link about__share-toggle"
          @click="toggleQr"
        >
          <Icon
            :path="mdiQrcode"
            :size="20"
          />
          <span>{{ showQr ? 'Hide QR code' : 'Share with a QR code' }}</span>
        </button>

        <div
          v-if="showQr"
          class="about__qr"
        >
          <!-- Generated locally from our own address; nothing foreign goes in. -->
          <!-- eslint-disable vue/no-v-html -->
          <div
            v-if="qrSvg"
            class="about__qr-code"
            v-html="qrSvg"
          />
          <!-- eslint-enable vue/no-v-html -->
          <div
            v-else
            class="about__qr-code about__qr-code--loading"
          />
          <p class="about__qr-url">
            {{ shareUrl }}
          </p>
          <div class="about__qr-actions">
            <button
              class="btn btn--text"
              @click="copyLink"
            >
              {{ copied ? 'Copied' : 'Copy link' }}
            </button>
            <button
              v-if="canShare"
              class="btn btn--text"
              @click="shareLink"
            >
              Share…
            </button>
          </div>
        </div>
      </div>

      <p class="about__version">
        Build {{ build }}<template v-if="served && served !== build">
          · server has {{ served }}
        </template>
        <button
          v-if="ui.updateReady"
          class="about__restart"
          @click="applyUpdate"
        >
          Restart to update
        </button>
      </p>
    </div>
  </dialog>
</template>

<script setup>
import { mdiClose, mdiGithub, mdiOpenInNew, mdiQrcode, mdiRadio, mdiScaleBalance } from '@mdi/js'

import { applyUpdate } from '@/pwa'
import { ui } from '@/ui'

const el = ref(null)
// The commit this bundle was built from, baked in at build time; and what the
// server says it is serving, when it says (NAS deploys write version.json).
const build = __APP_VERSION__
const served = ref('')
const route = useRoute()

// The address worth handing to a friend on the same network: this deployment's
// entry point, with the speakers if this copy has them. Not the station page.
const shareUrl = computed(() => {
  // The base is configured without a trailing slash; the app's scope has one.
  const url = new URL(import.meta.env.BASE_URL.replace(/\/?$/, '/'), location.origin)
  if (route.query.backend) url.searchParams.set('backend', String(route.query.backend))
  return url.toString()
})

const showQr = ref(false)
const qrSvg = ref('')
const copied = ref(false)
const canShare = typeof navigator.share === 'function'

// The encoder is loaded only when someone asks for a code; the app itself
// never needs it. Dark modules on a white card: an inverted code scans worse.
async function toggleQr () {
  showQr.value = !showQr.value
  if (!showQr.value || qrSvg.value) return
  const { default: QRCode } = await import('qrcode')
  qrSvg.value = await QRCode.toString(shareUrl.value, {
    type: 'svg',
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#0b0b0fff', light: '#ffffffff' },
  })
}

watch(shareUrl, () => { qrSvg.value = '' })

async function copyLink () {
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1800)
  } catch {
    copied.value = false
  }
}

async function shareLink () {
  try {
    await navigator.share({ title: 'FIPlay', text: 'FIP radio, on our speakers', url: shareUrl.value })
  } catch {
    // Cancelled, or not permitted: nothing to report.
  }
}

// Sync rather than toggle, for the same reason as the output sheet.
async function sync () {
  if (!el.value) return
  if (ui.aboutOpen && !el.value.open) {
    el.value.showModal()
    if (!served.value) served.value = await readVersion()
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
    return info.short ? `${info.short}${info.dirty ? '-dirty' : ''}` : ''
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

.about__share {
  margin-top: 4px;
}

.about__share-toggle {
  width: 100%;
  text-align: left;
}

.about__qr {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 8px 12px 4px;
}

.about__qr-code {
  width: 200px;
  height: 200px;
  padding: 10px;
  border-radius: var(--radius-sm);
  background: #fff;
}

.about__qr-code :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}

.about__qr-code--loading {
  background: var(--surface-2);
}

.about__qr-url {
  max-width: 100%;
  font-size: 0.75rem;
  color: var(--text-3);
  word-break: break-all;
  text-align: center;
}

.about__qr-actions {
  display: flex;
  gap: 4px;
}

.about__version {
  padding: 10px 12px 2px;
  font-size: 0.75rem;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
}

.about__restart {
  margin-left: 8px;
  color: var(--accent);
  font-weight: 600;
}
</style>
