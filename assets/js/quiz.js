(async function () {
  const mode = App.getParam('mode', 'practice'); // 'practice' | 'mock'
  const setParam = App.getParam('set');
  const partParam = App.getParam('part');
  const randomParam = App.getParam('random');
  const timerParam = Number(App.getParam('timer', '0'));

  const state = {
    mode,
    configKey: '',
    retryUrl: window.location.href,
    list: [],
    current: 0,
    answers: {}, // id -> { selected, checked, hintUsed }
    timerSeconds: timerParam > 0 ? timerParam * 60 : null,
    timerInterval: null,
    startedAt: Date.now(),
    finished: false,
  };

  const els = {
    setupLoading: document.getElementById('setup-loading'),
    quizRunning: document.getElementById('quiz-running'),
    progressLabel: document.getElementById('progress-label'),
    progressFill: document.getElementById('progress-fill'),
    timerDisplay: document.getElementById('timer-display'),
    btnFinishEarly: document.getElementById('btn-finish-early'),
    questionArea: document.getElementById('question-area'),
    navRow: document.getElementById('nav-row'),
    btnPrev: document.getElementById('btn-prev'),
    btnNext: document.getElementById('btn-next'),
    resultsArea: document.getElementById('results-area'),
  };

  function buildList(allQuestions) {
    let list;
    if (setParam) {
      list = allQuestions.filter((q) => q.set === Number(setParam));
      list.sort((a, b) => a.id - b.id);
      state.configKey = `${mode}:set:${setParam}`;
    } else if (partParam) {
      list = allQuestions.filter((q) => q.partId === partParam);
      list.sort((a, b) => a.id - b.id);
      state.configKey = `${mode}:part:${partParam}`;
    } else if (randomParam) {
      list = App.shuffle(allQuestions).slice(0, Number(randomParam));
      state.configKey = `${mode}:random`;
    } else {
      list = allQuestions.slice();
      state.configKey = `${mode}:all`;
    }
    // Precompute a per-question shuffled option order so the correct answer
    // isn't predictably in the same slot (the source material skews toward A/B).
    return list.map((q) => ({ ...q, displayOptions: App.shuffle(q.options) }));
  }

  function init() {
    App.loadQuestions()
      .then((all) => {
        state.list = buildList(all);
        if (state.list.length === 0) {
          els.setupLoading.textContent = 'ไม่พบข้อสอบตามเงื่อนไขที่เลือก กลับไปหน้าแรกแล้วลองใหม่';
          return;
        }
        els.setupLoading.hidden = true;
        els.quizRunning.hidden = false;
        els.questionArea.hidden = false;
        els.navRow.hidden = false;
        if (state.mode === 'mock') {
          els.btnFinishEarly.hidden = false;
        } else {
          els.btnFinishEarly.hidden = true;
        }
        if (state.timerSeconds !== null) {
          els.timerDisplay.hidden = false;
          startTimer();
        }
        renderQuestion();
      })
      .catch((err) => {
        els.setupLoading.textContent = 'โหลดข้อสอบไม่สำเร็จ: ' + err.message;
      });
  }

  function startTimer() {
    updateTimerDisplay();
    state.timerInterval = setInterval(() => {
      state.timerSeconds -= 1;
      updateTimerDisplay();
      if (state.timerSeconds <= 0) {
        clearInterval(state.timerInterval);
        alert('หมดเวลาแล้ว! ระบบจะส่งคำตอบให้อัตโนมัติ');
        finish();
      }
    }, 1000);
  }

  function updateTimerDisplay() {
    els.timerDisplay.textContent = App.formatClock(state.timerSeconds);
    els.timerDisplay.classList.toggle('low', state.timerSeconds <= 60);
  }

  function currentQuestion() {
    return state.list[state.current];
  }

  function ensureAnswer(qId) {
    if (!state.answers[qId]) state.answers[qId] = { selected: null, checked: false, hintUsed: false };
    return state.answers[qId];
  }

  function renderQuestion() {
    const q = currentQuestion();
    const ans = ensureAnswer(q.id);
    const total = state.list.length;

    els.progressLabel.textContent = `ข้อ ${state.current + 1}/${total}`;
    els.progressFill.style.width = `${((state.current) / total) * 100}%`;

    const locked = state.mode === 'practice' && ans.checked;

    const optionsHtml = q.displayOptions.map((opt) => {
      let cls = 'option';
      if (ans.selected === opt.key) cls += ' selected';
      if (locked) {
        cls += ' disabled';
        if (opt.key === q.correct) cls += ' correct';
        else if (opt.key === ans.selected) cls += ' incorrect';
      }
      const thLine = opt.th ? `<div class="opt-th">${escapeText(opt.th)}</div>` : '';
      return `<div class="${cls}" data-key="${opt.key}">
        <div class="opt-key">${opt.key}</div>
        <div class="opt-text"><div class="opt-en">${escapeText(opt.en)}</div>${thLine}</div>
      </div>`;
    }).join('');

    let explainHtml = '';
    if (locked) {
      const isCorrect = ans.selected === q.correct;
      explainHtml = `<div class="explain-box ${isCorrect ? 'right-answer' : 'wrong-answer'}">
        <div class="label">${isCorrect ? 'ถูกต้อง' : 'ไม่ถูกต้อง'} · คำอธิบาย</div>
        <div>${q.explanation}</div>
      </div>`;
    }

    const hintBoxHtml = ans.hintUsed
      ? `<div class="hint-box"><div class="label">คำแนะนำ</div><div>${escapeText(q.hint || 'ข้อนี้ยังไม่มี hint')}</div></div>`
      : '';

    const checkBtnHtml = state.mode === 'practice' && !locked
      ? `<button class="btn btn-primary" id="btn-check" ${ans.selected ? '' : 'disabled'}>ตรวจคำตอบ</button>`
      : '';

    els.questionArea.innerHTML = `
      <div class="question-card">
        <div class="q-meta">
          <span class="badge">${escapeText(q.partName)}</span>
          <a href="guide.html#${q.partId}" target="_blank" rel="noopener">ดูคู่มือหัวข้อนี้ →</a>
        </div>
        <div class="q-en">${escapeText(q.questionEn)}</div>
        <div class="q-th">${escapeText(q.questionTh)}</div>
        <div class="options">${optionsHtml}</div>
        ${hintBoxHtml}
        ${explainHtml}
        <div class="aux-row">
          <button class="btn btn-ghost" id="btn-hint" ${ans.hintUsed ? 'disabled' : ''}>ขอ Hint</button>
          ${checkBtnHtml}
        </div>
      </div>
    `;

    document.querySelectorAll('.option').forEach((el) => {
      el.addEventListener('click', () => {
        if (state.mode === 'practice' && ensureAnswer(q.id).checked) return;
        ensureAnswer(q.id).selected = el.dataset.key;
        renderQuestion();
      });
    });

    const hintBtn = document.getElementById('btn-hint');
    if (hintBtn) {
      hintBtn.addEventListener('click', () => {
        ensureAnswer(q.id).hintUsed = true;
        renderQuestion();
      });
    }

    const checkBtn = document.getElementById('btn-check');
    if (checkBtn) {
      checkBtn.addEventListener('click', () => {
        ensureAnswer(q.id).checked = true;
        renderQuestion();
        const rect = els.btnNext.getBoundingClientRect();
        const targetY = window.scrollY + rect.top - (window.innerHeight - rect.height) / 2;
        window.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
      });
    }

    const isLast = state.current === total - 1;
    els.btnNext.textContent = isLast ? 'ดูผลสรุป' : 'ถัดไป →';
    els.btnPrev.disabled = state.current === 0;
  }

  function escapeText(s) {
    const div = document.createElement('div');
    div.textContent = s == null ? '' : s;
    return div.innerHTML;
  }

  els.btnPrev.addEventListener('click', () => {
    if (state.current > 0) {
      state.current -= 1;
      renderQuestion();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  els.btnNext.addEventListener('click', () => {
    if (state.current < state.list.length - 1) {
      state.current += 1;
      renderQuestion();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      finish();
    }
  });

  els.btnFinishEarly.addEventListener('click', () => {
    const answered = Object.values(state.answers).filter((a) => a.selected).length;
    const msg = answered < state.list.length
      ? `คุณตอบไปแล้ว ${answered}/${state.list.length} ข้อ ยืนยันส่งคำตอบเลยหรือไม่?`
      : 'ยืนยันส่งคำตอบหรือไม่?';
    if (confirm(msg)) finish();
  });

  function finish() {
    if (state.finished) return;
    state.finished = true;
    if (state.timerInterval) clearInterval(state.timerInterval);

    let correctCount = 0;
    let hintsUsedCount = 0;
    const partStats = {};

    state.list.forEach((q) => {
      const ans = state.answers[q.id];
      const isCorrect = !!ans && ans.selected === q.correct;
      if (isCorrect) correctCount += 1;
      if (ans && ans.hintUsed) hintsUsedCount += 1;
      if (!partStats[q.partId]) partStats[q.partId] = { name: q.partName, correct: 0, total: 0 };
      partStats[q.partId].total += 1;
      if (isCorrect) partStats[q.partId].correct += 1;
    });

    const total = state.list.length;
    const pct = Math.round((correctCount / total) * 100);
    const timeTakenSeconds = Math.round((Date.now() - state.startedAt) / 1000);

    App.saveResult(state.configKey, {
      correct: correctCount,
      total,
      pct,
      hintsUsed: hintsUsedCount,
      timeTakenSeconds,
    });

    renderResults(partStats, correctCount, total, pct, hintsUsedCount, timeTakenSeconds);
  }

  function renderResults(partStats, correctCount, total, pct, hintsUsedCount, timeTakenSeconds) {
    els.quizRunning.hidden = true;
    els.questionArea.hidden = true;
    els.navRow.hidden = true;
    els.resultsArea.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const partRowsHtml = Object.values(partStats).map((p) => {
      const partPct = Math.round((p.correct / p.total) * 100);
      return `<div class="part-row">
        <div class="part-name">${escapeText(p.name)}</div>
        <div class="part-bar-track"><div class="part-bar-fill" style="width:${partPct}%"></div></div>
        <div class="part-score">${p.correct}/${p.total}</div>
      </div>`;
    }).join('');

    const minutes = Math.floor(timeTakenSeconds / 60);
    const seconds = timeTakenSeconds % 60;

    const reviewHtml = state.list.map((q) => {
      const ans = state.answers[q.id];
      const selected = ans ? ans.selected : null;
      const isCorrect = selected === q.correct;
      const status = !selected ? 'unanswered' : (isCorrect ? 'correct' : 'incorrect');
      const statusLabel = status === 'unanswered' ? 'ไม่ได้ตอบ' : (status === 'correct' ? 'ถูก' : 'ผิด');
      const yourOpt = q.options.find((o) => o.key === selected);
      const correctOpt = q.options.find((o) => o.key === q.correct);

      return `<div class="review-item" data-status="${status}">
        <div class="q-meta">
          <span class="status-badge status-${status}">${statusLabel}</span>
          <span class="badge">${escapeText(q.partName)}</span>
        </div>
        <div class="q-en">${escapeText(q.questionEn)}</div>
        <div class="q-th">${escapeText(q.questionTh)}</div>
        ${selected ? `<div style="font-size:13.5px;margin-bottom:4px;">คำตอบของคุณ: <b>${selected}) ${escapeText(yourOpt ? yourOpt.en : '')}</b></div>` : ''}
        <div style="font-size:13.5px;margin-bottom:10px;">คำตอบที่ถูก: <b>${q.correct}) ${escapeText(correctOpt ? correctOpt.en : '')}</b></div>
        <div class="explain-box">
          <div class="label">คำอธิบาย</div>
          <div>${q.explanation}</div>
        </div>
        ${q.hint ? `<div class="hint-box" style="margin-top:8px;"><div class="label">คำแนะนำ</div><div>${escapeText(q.hint)}</div></div>` : ''}
      </div>`;
    }).join('');

    els.resultsArea.innerHTML = `
      <div class="score-card">
        <div class="score-big">${pct}%</div>
        <div class="score-sub">${correctCount}/${total} ข้อถูก · ใช้เวลา ${minutes} นาที ${seconds} วินาที · ใช้ hint ${hintsUsedCount} ข้อ</div>
        <div class="part-breakdown">${partRowsHtml}</div>
        <div class="result-actions">
          <button class="btn btn-ghost" id="btn-retry">ทำอีกครั้ง</button>
          <a class="btn btn-primary" href="index.html">กลับหน้าหลัก</a>
        </div>
      </div>
      <div class="review-filter">
        <label><input type="checkbox" id="chk-wrong-only"> แสดงเฉพาะข้อที่ตอบผิด/ไม่ได้ตอบ</label>
      </div>
      <div id="review-list">${reviewHtml}</div>
    `;

    document.getElementById('btn-retry').addEventListener('click', () => {
      window.location.href = state.retryUrl;
    });
    document.getElementById('chk-wrong-only').addEventListener('change', (e) => {
      document.querySelectorAll('.review-item').forEach((item) => {
        item.hidden = e.target.checked && item.dataset.status === 'correct';
      });
    });
  }

  init();
})();
