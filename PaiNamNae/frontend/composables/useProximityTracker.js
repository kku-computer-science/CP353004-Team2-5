export const useProximityTracker = (passengersRef, routeId) => {
  const { $api } = useNuxtApp();
  const notifiedPassengers = ref(new Set());

  //คำนวณระยะห่างระหว่างพิกัดสองจุด
  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const updatePosition = async (driverLat, driverLon) => {
    //ดึงค่าจาก Proxy เพื่อเช็คจำนวนล่าสุด
    const currentPassengers = Array.isArray(passengersRef) ? passengersRef : passengersRef.value;
    
    console.log(`[Proximity] ตรวจสอบผู้โดยสาร ${currentPassengers?.length || 0} คน | Route: ${routeId}`);

    if (!currentPassengers || currentPassengers.length === 0) return;

    for (const p of currentPassengers) {
      //แปลงค่าพิกัดให้เป็น Number
      const pLat = parseFloat(p.pickupLat);
      const pLon = parseFloat(p.pickupLng);

      if (isNaN(pLat) || isNaN(pLon)) continue;

      const distance = getDistance(driverLat, driverLon, pLat, pLon);
      const targetUserId = p.passengerId || p.passenger?.id;

      console.log(`ระยะห่างจากคุณ ${p.name}: ${distance.toFixed(3)} กม.`);

      if (distance <= 2.0 && targetUserId && !notifiedPassengers.value.has(targetUserId)) {
        try {
          console.log(`[ALERT] กำลังส่งแจ้งเตือนไปที่ User ID: ${targetUserId}`);
          
          await $api('/notifications/proximity-alert', {
            method: 'POST',
            body: { 
              passengerId: targetUserId, 
              routeId: routeId,
              distance: distance.toFixed(2)
            }
          });

          notifiedPassengers.value.add(targetUserId);
          console.log(`แจ้งเตือน ${p.name} สำเร็จ!`);
        } catch (e) {
          console.error(`ส่งแจ้งเตือนล้มเหลว:`, e.data || e);
        }
      }
    }
  };

  return { updatePosition };
};