<template>
  <div class="flex flex-col h-screen bg-gray-100">
    <div class="flex items-center p-4 bg-white shadow-md">
      <button @click="$router.back()" class="mr-4 text-gray-600">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <div class="flex items-center">
        <div class="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
          P
        </div>
        <div class="ml-3">
          <p class="font-bold text-gray-800">แชทการเดินทาง</p>
          <p class="text-xs text-green-500">ออนไลน์</p>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-4 space-y-4" ref="msgContainer">
      <div v-for="(msg, index) in messages" :key="index" 
           :class="['flex', msg.isMe ? 'justify-end' : 'justify-start']">
        <div :class="['max-w-[75%] p-3 rounded-2xl shadow-sm', 
                    msg.isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-gray-800 rounded-tl-none']">
          <p class="text-sm">{{ msg.text }}</p>
          <p class="text-[10px] mt-1 opacity-70 text-right">{{ new Date(msg.createdAt).toLocaleTimeString() }}</p>
        </div>
      </div>
    </div>

    <div class="p-4 bg-white border-t flex items-center gap-2">
      <input v-model="inputMsg" @keyup.enter="handleSend"
             type="text" placeholder="พิมพ์ข้อความ..." 
             class="flex-1 border border-gray-300 rounded-full px-4 py-2 focus:outline-none focus:border-blue-500" />
      <button @click="handleSend" class="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useChat } from '~/composables/useChat';

const { messages, connectSocket, joinChatRoom, sendMessage } = useChat();
const route = useRoute();
const inputMsg = ref('');

onMounted(() => {
  connectSocket('your_token'); // ดึง token จาก auth store
  joinChatRoom(route.params.id);
});

const handleSend = () => {
  if (!inputMsg.value.trim()) return;
  sendMessage(inputMsg.value, { id: 'my_id', name: 'Me' });
  inputMsg.value = '';
};
</script>