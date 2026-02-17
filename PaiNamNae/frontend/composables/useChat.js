// frontend/composables/useChat.js
// composable นี้ดูแลการเชื่อมต่อ socket, โหลดประวัติข้อความ, ข้อมูลห้อง (booking),
// ส่งข้อความผ่าน API แล้ว broadcast ผ่าน socket
import { ref, onUnmounted } from 'vue';
import { io } from 'socket.io-client';

export function useChat() {
  const socket = ref(null);
  const messages = ref([]);         // ข้อความในห้อง (array ของ message objects)
  const currentRoomId = ref(null);  // bookingId
  const chatInfo = ref(null);       // ข้อมูล booking (มี driver / passenger)
  let authToken = null;

  // ค่า API base (แนะนำตั้ง VITE_API_URL ใน .env ของ frontend)
  const API = import.meta.env.VITE_API_URL || (window.location.origin.includes('3001') ? 'http://localhost:3000' : window.location.origin);

  // สร้าง socket connection (token เป็น optional — ถ้าไม่ส่ง จะอ่านจาก localStorage)
  const connectSocket = (token) => {
    if (socket.value) return; // กันสร้างซ้ำ
    authToken = token || localStorage.getItem('token') || null;

    // เชื่อมไปที่ host ของ backend (ถ้าใช้ VITE_API_URL ให้ตั้งให้ชัดเจน)
    const base = API.replace(/\/$/, '');

    // ไม่จำเป็นต้องใส่ token ใน auth ถ้า backend ไม่ตรวจ socket auth,
    // แต่ยังใส่ไว้เผื่อในอนาคตจะใช้
    socket.value = io(base, {
      transports: ['websocket'],
      auth: authToken ? { token: authToken } : undefined,
      autoConnect: true,
    });

    socket.value.on('connect', () => {
      console.log('socket connected', socket.value.id);
      // ถ้าร่วมห้องแล้ว ให้ join อีกครั้ง
      if (currentRoomId.value) {
        socket.value.emit('join_room', String(currentRoomId.value));
      }
    });

    // รับข้อความ realtime จาก server
    socket.value.on('receive_message', (msg) => {
      try {
        // ป้องกัน duplicate (ถ้ามี id)
        if (msg?.id) {
          if (!messages.value.find((m) => m.id === msg.id)) {
            messages.value.push(msg);
          }
        } else {
          // ถ้าไม่มี id ให้ push แบบ fallback (แต่ควรมี id จาก DB)
          messages.value.push(msg);
        }
      } catch (e) {
        console.error('receive_message handler error', e);
      }
    });

    socket.value.on('disconnect', (reason) => {
      console.log('socket disconnected', reason);
    });

    socket.value.on('connect_error', (err) => {
      console.warn('socket connect_error', err);
    });
  };

  // เข้าห้องแชท: - โหลด booking info (driver/passenger) - โหลดประวัติข้อความ - join socket room
  const joinChatRoom = async (bookingId) => {
    if (!bookingId) return;
    currentRoomId.value = bookingId;

    // ดึง booking info (เอา driver, passenger)
    try {
      const token = authToken || localStorage.getItem('token');
      const res = await fetch(`${API}/api/bookings/${bookingId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const j = await res.json();
        // API ของ backend คืน { success: true, data: booking }
        chatInfo.value = j.data;
      } else {
        console.warn('fetch booking failed', res.status);
      }
    } catch (e) {
      console.error('fetch booking error', e);
    }

    // โหลดประวัติข้อความ
    try {
      const token = authToken || localStorage.getItem('token');
      const res = await fetch(`${API}/api/chat/${bookingId}/messages`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const j = await res.json();
        messages.value = Array.isArray(j.data) ? j.data : [];
      } else {
        console.warn('fetch messages failed', res.status);
      }
    } catch (e) {
      console.error('fetch messages error', e);
    }

    // Join socket room (ถ้า connected)
    if (!socket.value) {
      // ถ้า socket ยังไม่เชื่อม ให้เชื่อม (จะอ่าน token จาก authToken/localStorage)
      connectSocket(authToken);
    }
    // emit join
    socket.value?.emit('join_room', String(bookingId));
  };

  // ส่งข้อความ: 1) POST ไป API เพื่อบันทึก 2) emit ผ่าน socket เพื่อให้ other clients ได้รับ
  const sendMessage = async (content, sender = null, type = 'TEXT') => {
    if (!currentRoomId.value) throw new Error('No room joined');
    const token = authToken || localStorage.getItem('token');

    const payload = { content, type };

    try {
      const res = await fetch(`${API}/api/chat/${currentRoomId.value}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Send message failed: ${res.status} ${errText}`);
      }

      const j = await res.json();
      const message = j.data;

      // append local (ถ้ายังไม่มี)
      if (!messages.value.find((m) => m.id === message.id)) {
        messages.value.push(message);
      }

      // แจ้ง socket ให้ broadcast (server ของคุณจะ emit receive_message ให้ทุกคนในห้อง)
      socket.value?.emit('send_message', {
        room: String(currentRoomId.value),
        ...message,
      });

      return message;
    } catch (e) {
      console.error('sendMessage error', e);
      throw e;
    }
  };

  onUnmounted(() => {
    if (socket.value) {
      try {
        socket.value.disconnect();
      } catch (e) {}
      socket.value = null;
    }
  });

  return {
    messages,
    chatInfo,
    connectSocket,
    joinChatRoom,
    sendMessage,
  };
}
