// composables/useChat.js
import { ref, onUnmounted } from 'vue';
import { io } from 'socket.io-client';

export function useChat() {
  const socket = ref(null);
  const messages = ref([]);
  const isConnected = ref(false);
  const currentRoomId = ref(null);

  // เชื่อมต่อ Socket Server
  const connectSocket = (token) => {
    if (socket.value) return;

    // เปลี่ยน URL ตาม Server ของคุณ
    const URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    
    socket.value = io(URL, {
      auth: { token }, // ส่ง Token ไปยืนยันตัวตน
      transports: ['websocket'],
    });

    socket.value.on('connect', () => {
      isConnected.value = true;
      console.log('✅ Socket connected:', socket.value.id);
    });

    socket.value.on('disconnect', () => {
      isConnected.value = false;
      console.log('❌ Socket disconnected');
    });

    // รับข้อความใหม่จาก Server (Real-time)
    socket.value.on('receive_message', (message) => {
      messages.value.push({
        text: message.text,
        isMe: false, // ข้อความที่รับมา = ฝั่งตรงข้าม
        createdAt: message.createdAt || new Date().toISOString(),
      });
    });
  };

  // เข้าร่วมห้องแชท (Join Room)
  const joinChatRoom = async (bookingId) => {
    if (!socket.value) return;
    
    // 1. Leave ห้องเก่าถ้ามี
    if (currentRoomId.value) {
      socket.value.emit('leave_room', currentRoomId.value);
    }

    // 2. Set ห้องใหม่
    currentRoomId.value = bookingId;
    socket.value.emit('join_room', bookingId);

    // 3. (Optional) Fetch History from REST API here
    // const history = await fetch(`/api/chat/${bookingId}`);
    // messages.value = history; 
    
    // Reset message ชั่วคราว (หรือใส่ History ที่ดึงมาแทน)
    messages.value = []; 
  };

  // ส่งข้อความ
  const sendMessage = (text, senderId) => {
    if (!socket.value || !text.trim()) return;

    // Emit event ไปหา Server
    const payload = {
      room: currentRoomId.value,
      text: text,
      senderId: senderId, // หรือ Server แกะจาก Token ก็ได้
      createdAt: new Date().toISOString(),
    };

    socket.value.emit('send_message', payload);

    // Push เข้า Local state ทันทีเพื่อให้ UI ลื่นไหล (Optimistic UI)
    messages.value.push({
      text: text,
      isMe: true,
      createdAt: payload.createdAt,
    });
  };

  // Cleanup เมื่อ Component ถูกทำลาย
  onUnmounted(() => {
    if (socket.value) {
      socket.value.disconnect();
      socket.value = null;
    }
  });

  return {
    socket,
    messages,
    isConnected,
    connectSocket,
    joinChatRoom,
    sendMessage,
  };
}