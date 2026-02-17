// composables/useChat.js
import { ref, onUnmounted } from 'vue';
import { io } from 'socket.io-client';

export function useChat() {
  const socket = ref(null);
  const messages = ref([]);
  const currentRoomId = ref(null);

  const connectSocket = (token) => {
    // 🔥 กันสร้าง socket ซ้ำ
    if (socket.value) return;

    const URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

    socket.value = io(URL, {
      auth: { token },
      withCredentials: true,
    });

    // ---------------- DEBUG LOG ----------------
    socket.value.on('connect', () => {
      console.log('✅ CONNECTED:', socket.value.id);
    });

    socket.value.on('disconnect', (reason) => {
      console.log('❌ DISCONNECTED:', reason);
    });

    socket.value.on('connect_error', (err) => {
      console.log('⚠️ CONNECT ERROR:', err.message);
    });
    // -------------------------------------------

    socket.value.on('receive_message', (message) => {
      const isMe = message.senderId === 'current_user_id'; 
      messages.value.push({ ...message, isMe });
    });
  };

  const joinChatRoom = (bookingId) => {
    if (!socket.value) return;

    currentRoomId.value = String(bookingId);

    console.log('🏠 JOIN ROOM:', currentRoomId.value);

    socket.value.emit('join_room', currentRoomId.value);

    // ล้างแชทเก่าเมื่อเปลี่ยนห้อง
    messages.value = [];
  };

  const sendMessage = (text, senderData) => {
    if (!socket.value || !text.trim()) return;

    const payload = {
      room: String(currentRoomId.value),
      text: text,
      senderId: senderData.id,
      senderName: senderData.name,
      senderAvatar: senderData.avatar,
      createdAt: new Date().toISOString(),
    };

    console.log('📨 SEND:', payload);

    socket.value.emit('send_message', payload);
  };

  onUnmounted(() => {
    if (socket.value) {
      socket.value.disconnect();
      socket.value = null;
    }
  });

  return {
    messages,
    connectSocket,
    joinChatRoom,
    sendMessage,
  };
}
