// Shared helpers used by index.html and quiz.html.
const App = (() => {
  const STORAGE_PREFIX = 'sci310-exam:';

  let questionsCache = null;
  async function loadQuestions() {
    if (questionsCache) return questionsCache;
    const res = await fetch('data/questions.json');
    if (!res.ok) throw new Error('Failed to load questions.json: ' + res.status);
    questionsCache = await res.json();
    return questionsCache;
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function getParam(name, fallback = null) {
    const v = new URLSearchParams(window.location.search).get(name);
    return v === null ? fallback : v;
  }

  function saveResult(key, data) {
    try {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify({ ...data, savedAt: Date.now() }));
    } catch (e) { /* storage unavailable, ignore */ }
  }

  function loadResult(key) {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function formatDate(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function formatClock(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds));
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
  }

  const PART_LABELS = {
    'design-thinking': 'Design Thinking',
    'bmc': 'BMC & Market Sizing',
    'ip-patent': 'IP & Patent Search',
    'pitch': 'Pitch Deck & Strategy',
  };

  return {
    loadQuestions,
    shuffle,
    getParam,
    saveResult,
    loadResult,
    formatDate,
    formatClock,
    PART_LABELS,
  };
})();
