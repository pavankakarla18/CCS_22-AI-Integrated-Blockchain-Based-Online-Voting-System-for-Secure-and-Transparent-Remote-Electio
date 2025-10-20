export function getDeviceFingerprint() {
    try {
        const userAgent = navigator.userAgent;
        const language = navigator.language;
        const platform = navigator.platform;
        // Simple hash of basic browser info
        return btoa(`${userAgent}-${language}-${platform}`);
    } catch (error) {
        console.error("Error creating device fingerprint:", error);
        return 'unknown_device';
    }
}