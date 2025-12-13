import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { STORAGE_KEYS } from './lib/constants';

// End analytics session on page unload if active
if (typeof window !== 'undefined') {
	window.addEventListener('beforeunload', () => {
		const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
		const sessionId = localStorage.getItem(STORAGE_KEYS.SESSION_ID);
		if (token && sessionId) {
			const url = `/api/analytics/sessions/${sessionId}`;
			try {
				// keepalive allows the request to outlive the page
				fetch(url, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }, keepalive: true });
			} catch {}
			localStorage.removeItem(STORAGE_KEYS.SESSION_ID);
		}
	});

	// Light heartbeat to mark session active
	setInterval(() => {
		const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
		const sessionId = localStorage.getItem(STORAGE_KEYS.SESSION_ID);
		if (document.visibilityState === 'visible' && token && sessionId) {
			fetch(`/api/analytics/sessions/${sessionId}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`
				},
				body: JSON.stringify({ lastActive: new Date().toISOString() })
			}).catch(() => {});
		}
	}, 60000);
}

createRoot(document.getElementById("root")!).render(<App />);
