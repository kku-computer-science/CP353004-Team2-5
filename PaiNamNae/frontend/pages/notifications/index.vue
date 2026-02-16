<template>
  <div class="bg-gray-50 min-h-screen">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="max-w-3xl mx-auto">
        <h1 class="text-3xl font-bold text-gray-800 mb-6">การแจ้งเตือน</h1>

        <div class="bg-white shadow-md rounded-lg overflow-hidden">
          <div v-if="pending" class="p-6 text-center text-gray-500">
            <p>กำลังโหลดการแจ้งเตือน...</p>
          </div>
          <div v-else-if="error" class="p-6 text-center text-red-600">
            <p>ขออภัย, เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
            <p class="text-sm text-gray-500 mt-2">
              กรุณาลองเข้าสู่ระบบใหม่อีกครั้ง หรือตรวจสอบการเชื่อมต่อ
            </p>
          </div>
          <div
            v-else-if="!notifications || notifications.length === 0"
            class="p-6 text-center text-gray-500"
          >
            <p>ยังไม่มีการแจ้งเตือนในขณะนี้</p>
          </div>
          <ul v-else class="divide-y divide-gray-100">
            <li
              v-for="notification in notifications"
              :key="notification.id"
              class="group relative p-5 transition-all duration-200 hover:bg-white hover:shadow-sm"
              :class="{ 'bg-blue-50/30': !notification.readAt }"
            >
              <div class="flex items-start space-x-4">
                <div class="flex-shrink-0 mt-1">
                  <div
                    class="p-2.5 rounded-xl bg-white border border-gray-100 shadow-sm"
                  >
                    <svg
                      class="h-5 w-5 text-blue-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                      />
                    </svg>
                  </div>
                </div>

                <div class="flex-grow min-w-0">
                  <div class="flex justify-between items-start">
                    <div class="pr-4">
                      <h3 class="text-sm font-bold text-gray-900 truncate">
                        {{ notification.title }}
                      </h3>
                      <p class="text-sm text-gray-600 mt-1 leading-relaxed">
                        {{ notification.body }}
                      </p>
                      <div class="flex items-center mt-2 space-x-2">
                        <span
                          class="text-xs text-gray-400"
                          >{{ formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: th }) }}</span
                        >
                        <span
                          v-if="!notification.readAt"
                          class="px-1.5 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-600 rounded uppercase tracking-wider"
                          >New</span
                        >
                      </div>
                    </div>

                    <div class="flex items-center space-x-1">
                      <button
                        v-if="!notification.readAt"
                        @click="markAsRead(notification.id)"
                        class="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors"
                        title="อ่านแล้ว"
                      >
                        <svg
                          class="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          stroke-width="2.5"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </button>

                      <button
                        @click="removeNotification(notification.id)"
                        class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="ลบการแจ้งเตือน"
                      >
                        <svg
                          class="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from "vue"; // รวม imports ไว้ที่เดียวกัน
import { formatDistanceToNow } from "date-fns";
import { th } from "date-fns/locale";
import { useAuth } from '~/composables/useAuth';

const { $api } = useNuxtApp();
const { user } = useAuth();

useHead({
  title: "การแจ้งเตือน - ไปนำแหน่",
});

// 2. เรียกใช้งานใน useAsyncData โดยไม่ต้องประกาศ $api ซ้ำ
const { data: notifications, pending, error, refresh } = await useAsyncData(
  'notifications',
  async () => {
    try {
      const response = await $api('/notifications', {
        method: 'GET'
      });

      const list = response?.data || response || [];

      if (!Array.isArray(list)) return [];

      return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } catch (err) {
      console.error("Fetch error:", err);
      throw err;
    }
  },
  { watch: [user] }
);

const getNotificationMessage = (notification) => {
  const senderName = notification.sender?.firstName || 'ใครบางคน';
  switch (notification.type) {
    case "REQUESTED":
      return `คุณมีคำขอจองใหม่จากคุณ ${senderName}`;
    case "ACCEPTED":
      return `คนขับยอมรับคำขอจองของคุณแล้ว`;
    case "REJECTED":
      return `คนขับปฏิเสธคำขอจองของคุณ`;
    case "CANCELLED":
    case "PASSENGER_CANCELLED":
      return `ผู้โดยสารได้ยกเลิกการจอง`;
    case "DRIVER_CANCELLED":
      return `คนขับได้ยกเลิกการเดินทาง`;
    case "TRIP_STARTED":
      return `การเดินทางของคุณได้เริ่มต้นขึ้นแล้ว`;
    case "TRIP_COMPLETED":
      return `การเดินทางของคุณเสร็จสิ้นแล้ว`;
    default:
      return "คุณมีการแจ้งเตือนใหม่";
  }
};

const markAsRead = async (id) => {
  try {
    await $api(`/notifications/${id}/read`, {
      method: 'PATCH'
    });
    const notification = notifications.value.find((n) => n.id === id);
    if (notification) {
      notification.readAt = new Date().toISOString();
    }
  } catch (err) {
    console.error("Error marking as read:", err);
  }
};

const removeNotification = async (id) => {
  if (!confirm('คุณต้องการลบการแจ้งเตือนนี้ใช่หรือไม่?')) return;

  try {
    await $api(`/notifications/${id}`, {
      method: 'DELETE'
    });

    notifications.value = notifications.value.filter((n) => n.id !== id);
  } catch (err) {
    console.error("Error deleting notification:", err);
    alert('ไม่สามารถลบแจ้งเตือนได้ในขณะนี้');
  }
};
</script>

<style scoped>
</style>
