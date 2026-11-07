(() => {
  window.createSubmissionRequest = scope => {
    const storageKey = `mechway-request-${scope}`;
    let saved;
    try { saved = JSON.parse(sessionStorage.getItem(storageKey)); } catch { /* Storage may be unavailable. */ }
    return {
      id(payload) {
        const fingerprint = JSON.stringify(payload);
        if (!saved || saved.fingerprint !== fingerprint) {
          const bytes = crypto.getRandomValues(new Uint8Array(16));
          saved = { fingerprint, id: Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('') };
          try { sessionStorage.setItem(storageKey, JSON.stringify(saved)); } catch { /* Keep the in-memory retry ID. */ }
        }
        return saved.id;
      },
      complete() {
        saved = null;
        try { sessionStorage.removeItem(storageKey); } catch { /* Storage may be unavailable. */ }
      }
    };
  };
})();
