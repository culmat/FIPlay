<template>
  <Transition name="toast">
    <div
      v-if="ui.updateReady && !ui.updateDismissed"
      class="toast chrome"
      role="status"
    >
      <Icon
        :path="mdiUpdate"
        :size="20"
      />
      <span class="toast__text">A new version is ready.</span>
      <button
        class="btn btn--text toast__action"
        @click="applyUpdate"
      >
        Restart
      </button>
      <button
        class="btn btn--icon toast__close"
        aria-label="Later"
        @click="ui.updateDismissed = true"
      >
        <Icon
          :path="mdiClose"
          :size="18"
        />
      </button>
    </div>
  </Transition>
</template>

<script setup>
import { mdiClose, mdiUpdate } from '@mdi/js'

import { applyUpdate } from '@/pwa'
import { ui } from '@/ui'
</script>

<style scoped>
/* Shown only when this browser is playing; otherwise the update applies on its own. */
.toast {
  position: fixed;
  top: calc(var(--safe-top) + 10px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: calc(100% - 24px);
  padding: 6px 6px 6px 14px;
  border-radius: var(--radius-pill);
  background: var(--glass);
  backdrop-filter: blur(20px) saturate(1.5);
  -webkit-backdrop-filter: blur(20px) saturate(1.5);
  border: 1px solid var(--glass-border);
  box-shadow: var(--shadow-card);
  color: var(--text);
  font-size: 0.875rem;
}

.toast__text {
  white-space: nowrap;
}

.toast__action {
  color: var(--accent);
  font-weight: 600;
}

.toast__close {
  width: 36px;
  height: 36px;
  color: var(--text-3);
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 200ms var(--ease), transform 200ms var(--ease);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, -8px);
}
</style>
