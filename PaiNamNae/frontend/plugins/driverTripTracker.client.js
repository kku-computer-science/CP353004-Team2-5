import { ref, reactive } from 'vue';
import { useProximityTracker } from '~/composables/useProximityTracker';

const STORAGE_KEY = 'driverTripTracker';
const GRACE_PERIOD_MS = 60 * 60 * 1000;
const STATUS_POLL_MS = 30000;

// This plugin manages the driver's trip tracking, including GPS updates, proximity alerts, and route status monitoring.
export default defineNuxtPlugin((nuxtApp) => {
    if (process.server) return;

    const $api = nuxtApp.$api;

    const state = reactive({
        routeId: null,
        isTracking: false,
        isLoading: false,
        hasAutoStarted: false,
        passengers: [],
        fullRouteData: null,
        autoStartTimer: null,
        statusPollTimer: null,
        watchId: null,
        logs: [],
        proximity: null,
    });

    // function to append log messages with timestamps and manage log length
    const appendLog = (msg, type = 'info') => {
        const timestamp = new Date().toLocaleTimeString();
        const formattedMsg = `[${timestamp}] ${msg}`;
        if (type === 'error') console.error('[Tracker]', msg);
        else console.log('[Tracker]', msg);
        state.logs.unshift(formattedMsg);
        if (state.logs.length > 50) state.logs.pop();
    };

    // function to clear timers and geolocation watch when stopping or resetting the tracker
    const stopTimers = () => { // แก้จาก stopTimes เป็น stopTimers
        if (state.autoStartTimer) {
            clearTimeout(state.autoStartTimer);
            state.autoStartTimer = null;
        }
        if (state.statusPollTimer) {
            clearInterval(state.statusPollTimer);
            state.statusPollTimer = null;
        }
        if (state.watchId !== null && navigator?.geolocation?.clearWatch) {
            navigator.geolocation.clearWatch(state.watchId);
            state.watchId = null;
        }
    };

    // function to reset the tracker's state when switching routes or clearing the current route
    const resetRouteState = (routeId) => {
        stopTimers();
        state.isTracking = false;
        state.hasAutoStarted = false;
        state.fullRouteData = null;

        state.passengers.splice(0, state.passengers.length);

        state.proximity = useProximityTracker(state.passengers, routeId);
    };

    // function to handle cases where the route is not found (e.g., deleted or invalid) and attempt to auto-pick another upcoming route
    const handleRouteMissing = async () => {
        appendLog('Route not found. Stopping tracker.');
        driverTripTracker.clearRoute(true);
        await autoPickUpcomingRoute();
    }

    // function to handle cases where the route becomes inactive (cancelled or completed) and attempt to auto-pick another upcoming route
    const handleRouteInactive = async (status) => {
        appendLog(`Route is now ${status}. Stopping tracker.`);
        driverTripTracker.clearRoute(true);
        await autoPickUpcomingRoute();
    };

    // function to poll the current route's status at regular intervals and check for changes that would require stopping the tracker
    const pollRouteStatus = async () => {
        if (!state.routeId) return;
        if (state.isLoading) return;
        try {
            const res = await $api(`/routes/${state.routeId}`);
            const routeData = res.data || res; // แก้จาก route เป็น routeData
            const status = routeData?.status?.toUpperCase();
            if (status && ['CANCELLED', 'COMPLETED'].includes(status)) {
                return handleRouteInactive(status);
            }
        } catch (e) {
            if (e.statusCode === 404) return handleRouteMissing(); // แก้ error.status เป็น e.statusCode
            appendLog(`Failed to poll route status: ${e.message}`, 'error');
        }
    };

    // function to start polling the route status if the tracker is active and a route is set
    const startStatusPolling = () => {
        if (state.statusPollTimer || !state.routeId) return; // แก้จาก status.autoStartTimer เป็น state.statusPollTimer
        state.statusPollTimer = setInterval(pollRouteStatus, STATUS_POLL_MS);
    };

    // function to fetch the passengers associated with the current route and prepare their data for proximity tracking
    const fetchPassengersForGPS = async (routeId) => {
        if (!state.routeId) return;
        try {
            // ดึงจาก state.routeId หากไม่ได้ส่ง parameter เข้ามา
            const targetRouteId = routeId || state.routeId;
            const res = await $api(`/routes/${targetRouteId}/passengers`);
            const data = res.data || res || [];

            const normalized = data.map((p) => ({
                id: p.id,
                passengerId: p.passengerId || p.passenger?.id,
                name: `${p?.passenger?.firstName || ''} ${p?.passenger?.lastName || ''}`.trim(),
                pickupLat: p?.pickupLocation?.lat || p?.pickupLocation?.latitude,
                pickupLng: p?.pickupLocation?.lng || p?.pickupLocation?.longitude
            }));

            state.passengers.splice(0, state.passengers.length, ...normalized);

            appendLog('Found ' + normalized.length + ' passengers for GPS tracking.');
        } catch (e) {
            if (e.statusCode === 404) {
                return handleRouteMissing();
            }
            appendLog(`Failed to fetch passengers for GPS: ${e.message}`, 'error');
        }
    };

    // function to fetch the full route data, check its status, and set up auto-start and status polling if the route is active
    const fetchFullRouteData = async () => {
        if (!state.routeId) return;
        state.isLoading = true;
        try {
            const res = await $api(`/routes/${state.routeId}`);
            const routeData = res.data || res;
            state.fullRouteData = routeData ?? null; // แก้จาก fullRpouteData
            const status = routeData?.status?.toUpperCase();
            const inactive = status && ['CANCELLED', 'COMPLETED'].includes(status); // แก้จาก inacctive
            if (inactive) {
                return handleRouteInactive(status);
            }

            if (routeData) {
                appendLog(`Route data loaded. Status: ${routeData.status}`);
                scheduleAutoStart();
                startStatusPolling();
            }
        } catch (e) {
            if (e.statusCode === 404) {
                return handleRouteMissing();
            }
            appendLog(`Failed to fetch route data: ${e.message}`, 'error');
        } finally {
            state.isLoading = false;
        }
    }

    // function to schedule the auto-start of the journey based on the route's departure time, with a grace period for late starts
    const scheduleAutoStart = () => {
        if (!state.fullRouteData?.departureTime) return; // เพิ่ม ! เข้าไปเพื่อให้ Logic ถูกต้อง
        const departureMs = new Date(state.fullRouteData.departureTime).getTime();
        const now = Date.now();
        const delay = departureMs - now;
        
        if (delay <= 0) {
            startJourney(true);
        } else {
            appendLog(`Journey will auto-start in ${Math.round(delay / 60000)} minutes.`);
            state.autoStartTimer = setTimeout(() => startJourney(true), delay);
        }
    };

    // function to start the journey tracking, set up the geolocation watch, and handle GPS updates for proximity tracking
    const startJourney = (auto = false) => {
        if (state.isTracking || !state.routeId) return;
        state.isTracking = true;
        state.hasAutoStarted = auto; // แก้จาก hashAutoStarted
        appendLog(auto ? 'Journey auto-started!' : 'Journey started manually.'); // แก้จาก suto

        state.watchId = navigator.geolocation.watchPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                appendLog(`Current location: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
                state.proximity?.updatePosition(latitude, longitude); // เพิ่ม Optional Chaining (?)
            },
            (err) => appendLog(`Geolocation error: ${err.message}`, 'error'),
            { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
        );
    };

    // function to initialize the tracker for a specific route, fetch necessary data, and set up proximity tracking
    const bootForRoute = async (routeId) => {
        if (!routeId) return;
        state.routeId = routeId;
        resetRouteState(routeId);
        localStorage.setItem(STORAGE_KEY, routeId);
        appendLog(`Booting tracker for Route ID: ${routeId}...`);
        await Promise.all([fetchPassengersForGPS(), fetchFullRouteData()]);
    };

    // function to handle cases where the route is not found (e.g., deleted or invalid) and attempt to auto-pick another upcoming route
    const autoPickUpcomingRoute = async () => {
        if (state.routeId) return;
        try {
            appendLog('Finding upcoming route...');
            const res = await $api('/routes/me'); // แก้เป็น $api ธรรมดา หรือ $api.get ตามที่คุณ Config ไว้
            const routes = res.data || res || []; // เพิ่มบรรทัดนี้เพื่อป้องกัน routes is not defined
            const now = Date.now();

            const candidates = routes // แก้จาก cadidates
                .map((r) => ({ ...r, departureMs: new Date(r.departureTime).getTime()}))
                .filter((r) => {
                    const status = (r.status || '').toUpperCase();
                    const isValidStatus = !['CANCELLED', 'COMPLETED'].includes(status); // ปรับ Logic สถานะ
                    const isTimeValid = r.departureMs > (now - GRACE_PERIOD_MS);
                    return isValidStatus && isTimeValid; // แก้จาก isValiodStatus
                })
                .sort((a, b) => a.departureMs - b.departureMs);

            if (candidates.length > 0) {
                await bootForRoute(candidates[0].id);
            } else {
                appendLog('No upcoming routes found.');
            }
        } catch (e) {
            appendLog(`Failed to fetch upcoming routes: ${e.message}`, 'error');
        }
    };   
    
    setTimeout(() => {
        const savedRouteId = localStorage.getItem(STORAGE_KEY);
        if (savedRouteId) {
            // เพิ่ม .catch() เพื่อจัดการกรณีโหลดของเดิมไม่ได้
            bootForRoute(savedRouteId).catch(() => autoPickUpcomingRoute());
        } else {
            autoPickUpcomingRoute();
        }
    }, 1500);

    // expose the driverTripTracker object with methods to manage the route and tracking state...
    const driverTripTracker = {
        setRoute: (routeId) => bootForRoute(routeId),
        autoPick: () => autoPickUpcomingRoute(),
        clearRoute: (silent = false) => {
            resetRouteState(null);
            state.routeId = null;
            localStorage.removeItem(STORAGE_KEY);
            if (!silent) appendLog('Route cleared. Tracker reset.');
        },
        startNow: () => startJourney(false),
        state,
    };

    nuxtApp.provide('driverTripTracker', driverTripTracker);
    if (process.client) window.driverTripTracker = driverTripTracker;

});