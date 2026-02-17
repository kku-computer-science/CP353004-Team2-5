<template>
  <teleport to="body">
    <transition
      enter-active-class="transition ease-out duration-300"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition ease-in duration-200"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="isVisible" class="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm" @click.self="cancel">
        
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all scale-100">
          
          <div class="bg-primary-50 p-6 flex justify-center">
            <div class="bg-primary-100 p-4 rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
          </div>

          <div class="p-6 text-center">
            <h3 class="text-xl font-bold text-gray-900 mb-2">โทรหา {{ name }}?</h3>
            <p class="text-gray-500 text-sm mb-6">
              หมายเลข: <span class="font-mono font-medium text-gray-700">{{ phoneNumber }}</span>
            </p>
            
            <div class="bg-yellow-50 border border-yellow-100 rounded-lg p-3 mb-6 text-xs text-yellow-700 flex items-start text-left gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
              </svg>
              <span>เพื่อความปลอดภัย โปรดติดต่อผ่านแอปพลิเคชันเป็นหลัก</span>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <button
                @click="cancel"
                class="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition focus:outline-none"
              >
                ยกเลิก
              </button>
              <a
                :href="`tel:${phoneNumber}`"
                @click="confirm"
                class="w-full px-4 py-2.5 rounded-xl bg-primary-600 text-white font-bold hover:bg-primary-700 transition flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                โทรเลย
              </a>
            </div>
          </div>
        </div>

      </div>
    </transition>
  </teleport>
</template>

<script setup>
defineProps({
  isVisible: { type: Boolean, required: true },
  name: { type: String, default: 'คนขับ' },
  phoneNumber: { type: String, default: '' },
});

const emit = defineEmits(['close', 'confirm']);

const cancel = () => {
  emit('close');
};

const confirm = () => {
  // เมื่อกดโทร จะทำงานตาม href="tel:..." โดยอัตโนมัติ
  // แต่อาจจะ emit event กลับไปเพื่อ track analytics ว่ามีการโทรเกิดขึ้น
  emit('confirm');
  setTimeout(() => {
     emit('close');
  }, 500);
};
</script>