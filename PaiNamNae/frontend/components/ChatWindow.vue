<template>
  <div class="fixed bottom-4 right-4 z-50 flex flex-col items-end">
    <button
      v-if="!isOpen"
      @click="toggleChat"
      class="bg-primary-600 hover:bg-primary-700 text-white p-4 rounded-full shadow-lg transition-transform transform hover:scale-105 flex items-center gap-2"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
      <span v-if="unreadCount > 0" class="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">
        {{ unreadCount }}
      </span>
      <span class="font-semibold hidden sm:inline">แชทกับคนขับ</span>
    </button>

    <transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="opacity-0 translate-y-10"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-10"
    >
      <div v-if="isOpen" class="bg-white w-80 sm:w-96 rounded-t-lg rounded-bl-lg shadow-2xl border border-gray-200 overflow-hidden flex flex-col h-[500px]">
        
        <div class="bg-primary-600 text-white p-3 flex justify-between items-center shadow-sm">
          <div class="flex items-center gap-2">
            <div class="relative">
              <img :src="partnerAvatar || '/images/default-avatar.png'" class="w-8 h-8 rounded-full border border-white bg-gray-200 object-cover" alt="Avatar">
              <div :class="`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${isOnline ? 'bg-green-400' : 'bg-gray-400'}`"></div>
            </div>
            <div>
              <h3 class="font-bold text-sm">{{ partnerName }}</h3>
              <p class="text-xs text-primary-100">{{ isTyping ? 'กำลังพิมพ์...' : (isActive ? 'ออนไลน์' : 'จบการสนทนา') }}</p>
            </div>
          </div>
          <button @click="toggleChat" class="text-white hover:text-gray-200 focus:outline-none">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>

        <div ref="messagesContainer" class="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-3">
          <div v-if="loading" class="flex justify-center py-4">
            <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
          </div>
          
          <div v-else-if="messages.length === 0" class="text-center text-gray-400 mt-10 text-sm">
            <p>เริ่มการสนทนาได้เลย 👋</p>
          </div>

          <div
            v-for="(msg, index) in messages"
            :key="index"
            class="flex flex-col"
            :class="msg.isMe ? 'items-end' : 'items-start'"
          >
            <div
              class="max-w-[80%] px-4 py-2 rounded-2xl text-sm shadow-sm relative break-words"
              :class="[
                msg.isMe 
                  ? 'bg-primary-600 text-white rounded-tr-none' 
                  : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
              ]"
            >
              {{ msg.text }}
            </div>
            <span class="text-[10px] text-gray-400 mt-1 px-1">
              {{ formatTime(msg.createdAt) }}
            </span>
          </div>
        </div>

        <div class="p-3 bg-white border-t border-gray-100">
          <div v-if="!isActive" class="text-center py-2 text-gray-500 text-sm bg-gray-50 rounded">
            การสนทนาสิ้นสุดลงแล้ว
          </div>
          <form v-else @submit.prevent="sendMessage" class="flex items-end gap-2">
            <input
              v-model="newMessage"
              type="text"
              placeholder="พิมพ์ข้อความ..."
              class="flex-1 bg-gray-100 border-0 rounded-full px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:bg-white transition text-sm"
              :disabled="sending"
            />
            <button
              type="submit"
              :disabled="!newMessage.trim() || sending"
              class="bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white p-2 rounded-full shadow-sm transition flex-shrink-0"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 transform rotate-90" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </button>
          </form>
        </div>

      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onMounted } from 'vue';

// --- Props ---
const props = defineProps({
  partnerName: { type: String, default: 'Partner' },
  partnerAvatar: { type: String, default: '' },
  messages: { type: Array, default: () => [] }, // Array of { text, isMe, createdAt }
  isActive: { type: Boolean, default: true },   // ควบคุมโดย Booking Status
  isOnline: { type: Boolean, default: false },
  isTyping: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
});

// --- Emits ---
const emit = defineEmits(['send-message', 'toggle-open']);

// --- State ---
const isOpen = ref(false);
const newMessage = ref('');
const sending = ref(false);
const messagesContainer = ref(null);
const unreadCount = ref(0);

// --- Methods ---
const toggleChat = () => {
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    unreadCount.value = 0;
    scrollToBottom();
  }
  emit('toggle-open', isOpen.value);
};

const sendMessage = () => {
  if (!newMessage.value.trim()) return;
  
  sending.value = true;
  // Emit event ไปให้ Parent Component จัดการ API/Socket
  emit('send-message', newMessage.value);
  
  newMessage.value = '';
  sending.value = false;
  
  // Auto scroll after sending
  scrollToBottom();
};

const scrollToBottom = async () => {
  await nextTick();
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
};

const formatTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
};

// --- Watchers ---
// เมื่อมีข้อความใหม่เข้ามา
watch(() => props.messages, (newVal, oldVal) => {
  if (newVal.length > (oldVal?.length || 0)) {
    if (isOpen.value) {
      scrollToBottom();
    } else {
      unreadCount.value++;
    }
  }
}, { deep: true });

</script>

<style scoped>
/* Custom Scrollbar for Chat */
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}
.overflow-y-auto::-webkit-scrollbar-track {
  background: #f1f1f1;
}
.overflow-y-auto::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 3px;
}
.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}
</style>