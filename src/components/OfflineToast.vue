<template>
  <Transition name="toast">
    <div
      v-if="!net.online"
      class="toast chrome"
      role="status"
    >
      <Icon
        :path="mdiWifiOff"
        :size="20"
      />
      <span class="toast__text">No connection. FIP needs the internet to play.</span>
    </div>
  </Transition>
</template>

<script setup>
import { mdiWifiOff } from '@mdi/js'

import { net } from '@/net'
</script>

<style scoped>
/* Same place and look as the update toast; the two never show together,
   because an update is only offered while this browser is playing. */
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
  padding: 10px 16px 10px 14px;
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
  min-width: 0;
  line-height: 1.3;
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
