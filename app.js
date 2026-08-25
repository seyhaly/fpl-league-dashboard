// FPL Private League Admin Engine — v3 with UI Enhancements
(function () {
  // App State
  const state = {
    viewMode: 'overall',
    currentGw: 10,
    maxGw: 10,
    entryFee: 3,
    showMotmBadge: false,
    showMotsBadge: false,
    classicSheetSdChipMode: 'current', // 'current' | 'all' | 'none'
    classicSheetBannerBg: localStorage.getItem('cs_banner_bg') || '#73679f',
    classicSheetBannerText: localStorage.getItem('cs_banner_text') || '#ffffff',
    theme: localStorage.getItem('fpl_admin_theme') || 'dark',
    motsPrizePool: 50,
    dataset: JSON.parse(JSON.stringify(window.DEMO_DATA)),
    eventStatuses: {},
    statusFilter: 'recent',
    chartInstance: null,
    perfChartInstance: null,
    standingsSortColumn: null,
    standingsSortDir: 'desc',
    activeLeagueId: '389585',
    fetchCounter: 0
  };

  // DOM Elements
  const elements = {
    gwDisplay:              document.getElementById('gwDisplay'),
    gwSelect:               document.getElementById('gwSelect'),
    prevGwBtn:              document.getElementById('prevGwBtn'),
    nextGwBtn:              document.getElementById('nextGwBtn'),
    goToCurrentGwBtn:       document.getElementById('goToCurrentGwBtn'),
    standingsBody:          document.getElementById('standingsBody'),
    mobileCards:            document.getElementById('mobileCards'),
    winLossTableContainer:  document.getElementById('winLossTableContainer'),
    seasonMatrixContainer:  document.getElementById('seasonMatrixContainer'),
    matrixLegendCurrent:    document.getElementById('matrixLegendCurrent'),
    chipTrackerContainer:   document.getElementById('chipTrackerContainer'),
    gwSpotlightContainer:   document.getElementById('gwSpotlightContainer'),
    gwStatusMatrix:         document.getElementById('gwStatusMatrix'),
    statusCounters:         document.getElementById('statusCounters'),
    statusTabs:             document.getElementById('statusTabs'),
    toggleMotmBtn:          document.getElementById('toggleMotmBtn'),
    toggleMotsBtn:          document.getElementById('toggleMotsBtn'),
    themeToggleBtns:        document.querySelectorAll('[data-theme-btn]'),
    leagueNameHeader:       document.getElementById('leagueNameHeader'),
    leagueIdInput:          document.getElementById('leagueIdInput'),
    syncFplBtn:             document.getElementById('syncFplBtn'),
    syncStatusTag:          document.getElementById('syncStatusTag'),
    memberCountBadge:       document.getElementById('memberCountBadge'),
    standingsGwBadge:       document.getElementById('standingsGwBadge'),
    viewModeSelect:         document.getElementById('viewModeSelect'),
    leagueNameDisplay:      document.getElementById('leagueNameDisplay')
  };

  // ===================== ABA BANK ACCOUNTS =====================
  const ABA_ACCOUNTS = {
    2023789: '001 335 048', // Monor Noem
    2026484: '000 971 427', // Bora Chhe
    2023013: '000 790 069', // នរសិង្ហ កន្សៃ
    2067578: '002 157 778', // Kun Phaktra
    2024611: '077 767 949', // Vibol Dang
    2019453: '085 897 968', // Seyha ly
    2026160: '007 043 391', // Piseth Nhim
    145847: ''              // Hokheng Ker (blank)
  };

  // ===================== ANIMATED NUMBER COUNTER =====================
  function animateNumber(element, endVal, duration = 400, prefix = '', suffix = '') {
    if (!element) return;
    const startVal = parseFloat(element.dataset.curVal || '0');
    if (isNaN(startVal) || startVal === endVal) {
      element.dataset.curVal = endVal;
      element.textContent = `${prefix}${endVal}${suffix}`;
      return;
    }

    const startTime = performance.now();
    element.dataset.curVal = endVal;

    function update(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = startVal + (endVal - startVal) * ease;
      
      const formatted = Number.isInteger(endVal) ? Math.round(current) : current.toFixed(2);
      element.textContent = `${prefix}${formatted}${suffix}`;

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        const finalFormatted = Number.isInteger(endVal) ? endVal : endVal.toFixed(2);
        element.textContent = `${prefix}${finalFormatted}${suffix}`;
      }
    }
    requestAnimationFrame(update);
  }



  // ===================== SEASON AWARDS =====================
  function renderSeasonAwards() {
    const container = document.getElementById('seasonAwardsContainer');
    if (!container) return;
    container.innerHTML = '';

    const managers = state.dataset.managers;
    if (!managers || managers.length === 0) return;

    // Calculate totals across GW 1..currentGw
    const stats = managers.map(m => {
      let benchPts = 0;
      let hitCost = 0;
      let captainPts = 0;
      let grossPts = 0;
      let payouts = 0;

      for (let g = 1; g <= state.currentGw; g++) {
        const standings = getGameweekStandings(g);
        const item = standings.find(x => x.id === m.id);
        if (item) {
          benchPts += item.bench;
          hitCost += item.hitCost;
          captainPts += item.captain;
          grossPts += item.grossScore;
          payouts += item.payout;
        }
      }
      return { id: m.id, name: m.name, benchPts, hitCost, captainPts, grossPts, payouts };
    });

    const benchKing = [...stats].sort((a, b) => b.benchPts - a.benchPts)[0];
    const bigSpender = [...stats].sort((a, b) => b.hitCost - a.hitCost)[0];
    const captainAmerica = [...stats].sort((a, b) => b.captainPts - a.captainPts)[0];
    const unluckiest = [...stats].sort((a, b) => (b.grossPts - b.payouts * 10) - (a.grossPts - a.payouts * 10))[0];

    const awards = [
      {
        cls: 'bench',
        icon: '👑',
        title: 'King of Bench',
        winner: benchKing?.name || '-',
        stat: `${benchKing?.benchPts || 0} Bench Pts Left`
      },
      {
        cls: 'spender',
        icon: '💸',
        title: 'Big Spender',
        winner: bigSpender?.name || '-',
        stat: `-${bigSpender?.hitCost || 0} Pts Spent on Hits`
      },
      {
        cls: 'captain',
        icon: '🎯',
        title: 'Captain America',
        winner: captainAmerica?.name || '-',
        stat: `${captainAmerica?.captainPts || 0} Captain Pts Scored`
      },
      {
        cls: 'unlucky',
        icon: '⚡',
        title: 'Unluckiest Manager',
        winner: unluckiest?.name || '-',
        stat: `${unluckiest?.grossPts || 0} Gross Pts (${unluckiest?.payouts >= 0 ? '+' : ''}$${unluckiest?.payouts || 0})`
      }
    ];

    awards.forEach(a => {
      const card = document.createElement('div');
      card.className = `award-card ${a.cls}`;
      card.innerHTML = `
        <div class="award-icon-box">${a.icon}</div>
        <div class="award-title">${a.title}</div>
        <div class="award-winner-name">${a.winner}</div>
        <div class="award-stat-badge">${a.stat}</div>
      `;
      container.appendChild(card);
    });
  }

  // ===================== INITIALIZE APPLICATION =====================
  function init() {
    applyTheme(state.theme);
    populateGwSelect();
    populateViewModeSelect();
    bindEvents();
    renderAll();
    initChart();
    initPerformanceChart();
    initCollapsibles();
    updateMemberCountBadge();

    // Default to real league Clash of Elite 2026-2027 (389585) on load
    if (elements.leagueIdInput) {
      elements.leagueIdInput.value = '389585';
      syncLiveFplLeague();
    }

    // Auto-sync live scores every 60 seconds while on a live league
    setInterval(() => {
      const code = elements.leagueIdInput ? elements.leagueIdInput.value.trim() : '';
      if (code && code.toLowerCase() !== 'demo' && !document.hidden) {
        fetchLeagueData(code);
      }
    }, 60000);
  }

  // ===================== THEME =====================
  function applyTheme(themeName) {
    state.theme = themeName;
    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem('fpl_admin_theme', themeName);
    elements.themeToggleBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.themeBtn === themeName);
    });
    if (state.chartInstance) updateChartTheme();
    if (state.perfChartInstance) updatePerformanceChartTheme();
  }

  // ===================== #3 MEMBER COUNT BADGE =====================
  function updateMemberCountBadge() {
    const count = state.dataset.managers.length;
    if (elements.memberCountBadge) {
      elements.memberCountBadge.textContent = `⚽ ${count} Member${count !== 1 ? 's' : ''}`;
    }
  }

  // ===================== GW & VIEW MODE SELECTOR =====================
  function populateGwSelect() {
    elements.gwSelect.innerHTML = '';
    for (let i = 1; i <= state.maxGw; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = `Gameweek ${i}`;
      if (i === state.currentGw) opt.selected = true;
      elements.gwSelect.appendChild(opt);
    }
  }

  function populateViewModeSelect() {
    if (!elements.viewModeSelect) return;
    elements.viewModeSelect.innerHTML = '<option value="overall">Overall Standings</option>';
    if (state.dataset.months) {
      state.dataset.months.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.name.toLowerCase();
        opt.textContent = m.name; // Clean month name e.g. "August"
        elements.viewModeSelect.appendChild(opt);
      });
    }
  }

  // ===================== EVENTS =====================
  function bindEvents() {
    elements.prevGwBtn.addEventListener('click', () => {
      state.viewMode = 'overall';
      if (elements.viewModeSelect) elements.viewModeSelect.value = 'overall';
      changeGw(state.currentGw - 1);
    });
    elements.nextGwBtn.addEventListener('click', () => {
      state.viewMode = 'overall';
      if (elements.viewModeSelect) elements.viewModeSelect.value = 'overall';
      changeGw(state.currentGw + 1);
    });
    elements.gwSelect.addEventListener('change', e => {
      state.viewMode = 'overall';
      if (elements.viewModeSelect) elements.viewModeSelect.value = 'overall';
      changeGw(parseInt(e.target.value));
    });

    if (elements.viewModeSelect) {
      elements.viewModeSelect.addEventListener('change', e => {
        state.viewMode = e.target.value;
        renderStandingsTable();
      });
    }

    // #7 — "Latest GW" Quick Jump
    if (elements.goToCurrentGwBtn) {
      elements.goToCurrentGwBtn.addEventListener('click', () => changeGw(state.maxGw));
    }

    if (elements.toggleMotmBtn) {
      elements.toggleMotmBtn.addEventListener('click', () => {
        state.showMotmBadge = !state.showMotmBadge;
        elements.toggleMotmBtn.classList.toggle('active', state.showMotmBadge);
        renderStandingsTable();
        renderClassicSheetView();
      });
    }

    if (elements.toggleMotsBtn) {
      elements.toggleMotsBtn.addEventListener('click', () => {
        state.showMotsBadge = !state.showMotsBadge;
        elements.toggleMotsBtn.classList.toggle('active', state.showMotsBadge);
        renderStandingsTable();
        renderClassicSheetView();
      });
    }

    elements.themeToggleBtns.forEach(btn => {
      btn.addEventListener('click', () => applyTheme(btn.dataset.themeBtn));
    });

    // Saved League Pills — quick switch
    document.querySelectorAll('.league-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const code = pill.dataset.leagueCode;
        const name = pill.dataset.leagueName;
        
        // Update active state
        document.querySelectorAll('.league-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');

        if (code === 'demo') {
          elements.leagueIdInput.value = '';
          if (name && elements.leagueNameHeader) elements.leagueNameHeader.textContent = name;
          if (name && elements.leagueNameDisplay) elements.leagueNameDisplay.textContent = name;
          state.dataset = JSON.parse(JSON.stringify(window.DEMO_DATA));
          state.maxGw = 10;
          state.currentGw = 10;
          elements.syncStatusTag.className = 'sync-status-tag live';
          elements.syncStatusTag.textContent = 'DEMO MODE';
          populateGwSelect();
          changeGw(10);
          updateMemberCountBadge();
          renderAll();
        } else {
          elements.leagueIdInput.value = code;
          if (name && elements.leagueNameHeader) elements.leagueNameHeader.textContent = name;
          // Auto-sync
          syncLiveFplLeague();
        }
      });
    });

    if (elements.syncFplBtn) {
      elements.syncFplBtn.addEventListener('click', syncLiveFplLeague);
    }

    const thSeasonPts = document.getElementById('thSeasonPts');
    if (thSeasonPts) {
      thSeasonPts.addEventListener('click', () => {
        if (state.standingsSortColumn !== 'seasonTotalNet') {
          state.standingsSortColumn = 'seasonTotalNet';
          state.standingsSortDir = 'desc';
        } else if (state.standingsSortDir === 'desc') {
          state.standingsSortDir = 'asc';
        } else {
          state.standingsSortColumn = null;
          state.standingsSortDir = 'desc';
        }
        renderStandingsTable();
      });
    }

    initExportImageHandlers();
  }

  // ===================== TOAST & EXPORT IMAGE HELPERS =====================
  function showToast(msg) {
    let toast = document.querySelector('.fpl-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'fpl-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  }

  function initExportImageHandlers() {
    const copyBtn = document.getElementById('copyStandingsImgBtn');
    const downloadBtn = document.getElementById('downloadStandingsImgBtn');
    const targetElement = document.getElementById('section-standings');

    if (!targetElement) return;

    const capturePngUrl = async () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const isDark = currentTheme !== 'light';
      const bgColor = isDark ? '#060913' : '#ffffff';

      const rect = targetElement.getBoundingClientRect();
      const h3 = targetElement.querySelector('.section-title h3');
      let originalH3Html = '';
      let originalH3Style = '';

      try {
        if (h3) {
          originalH3Html = h3.innerHTML;
          originalH3Style = h3.getAttribute('style') || '';
          
          const text = h3.innerText.toUpperCase();
          const computed = window.getComputedStyle(h3);
          
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const scale = 2;
          
          const fontSize = parseFloat(computed.fontSize) || 18;
          const fontWeight = computed.fontWeight || '800';
          const fontFamily = computed.fontFamily || 'Outfit, sans-serif';
          
          ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
          if ('letterSpacing' in ctx) ctx.letterSpacing = computed.letterSpacing;
          
          const textWidth = ctx.measureText(text).width;
          const canvasWidth = Math.ceil(textWidth + 20);
          const canvasHeight = Math.ceil(fontSize * 1.5);
          
          canvas.width = canvasWidth * scale;
          canvas.height = canvasHeight * scale;
          canvas.style.width = canvasWidth + 'px';
          canvas.style.height = canvasHeight + 'px';
          
          ctx.scale(scale, scale);
          ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
          if ('letterSpacing' in ctx) ctx.letterSpacing = computed.letterSpacing;
          ctx.textBaseline = 'middle';
          
          const gradient = ctx.createLinearGradient(0, 0, textWidth, 0);
          if (isDark) {
            gradient.addColorStop(0, '#ffffff');
            gradient.addColorStop(1, '#a5b4fc');
          } else {
            gradient.addColorStop(0, '#0f172a');
            gradient.addColorStop(1, '#4338ca');
          }
          ctx.fillStyle = gradient;
          ctx.fillText(text, 0, canvasHeight / 2);
          
          h3.innerHTML = '';
          h3.appendChild(canvas);
          h3.style.background = 'none';
          h3.style.webkitBackgroundClip = 'unset';
          h3.style.webkitTextFillColor = 'initial';
        }

        await document.fonts.ready;
        
        if (typeof htmlToImage !== 'undefined') {
          targetElement.setAttribute('data-theme', document.documentElement.getAttribute('data-theme'));
          
          const dataUrl = await htmlToImage.toPng(targetElement, {
            quality: 1.0,
            pixelRatio: 2,
            backgroundColor: bgColor,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            style: {
              borderRadius: '12px',
              transform: 'none',
              margin: '0'
            }
          });
          return dataUrl;
        }
      } catch (err) {
        console.warn('htmlToImage capture failed:', err);
      } finally {
        targetElement.removeAttribute('data-theme');
        if (h3) {
          h3.innerHTML = originalH3Html;
          if (originalH3Style) {
            h3.setAttribute('style', originalH3Style);
          } else {
            h3.removeAttribute('style');
          }
        }
      }
      return null;
    };

    if (downloadBtn) {
      downloadBtn.addEventListener('click', async () => {
        downloadBtn.textContent = '⏳ Generating...';
        const dataUrl = await capturePngUrl();
        downloadBtn.textContent = '📥 Download PNG';
        if (dataUrl) {
          const link = document.createElement('a');
          link.download = `GW${state.currentGw}_Standings_Payouts.png`;
          link.href = dataUrl;
          link.click();
          showToast('Image downloaded successfully!');
        } else {
          showToast('Failed to generate image');
        }
      });
    }

    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        copyBtn.textContent = '⏳ Generating...';
        const dataUrl = await capturePngUrl();
        copyBtn.textContent = '📋 Copy Image';
        if (dataUrl) {
          try {
            const res = await fetch(dataUrl);
            const blob = await res.blob();
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            showToast('📋 Copied image to clipboard! Ready to paste into WhatsApp / Telegram.');
          } catch (err) {
            console.warn('Clipboard write error:', err);
            showToast('Clipboard direct write restricted. Use "Download PNG" instead!');
          }
        } else {
          showToast('Failed to generate image');
        }
      });
    }

    const btnExportSheet = document.getElementById('btnExportClassicSheet');
    if (btnExportSheet) {
      btnExportSheet.addEventListener('click', async () => {
        const card = document.getElementById('classicSheetCard');
        if (!card) return;

        btnExportSheet.disabled = true;
        btnExportSheet.textContent = '⏳ Generating...';

        try {
          if (typeof htmlToImage !== 'undefined') {
            const dataUrl = await htmlToImage.toPng(card, {
              quality: 1.0,
              pixelRatio: 2,
              backgroundColor: '#ffffff',
              style: {
                transform: 'none',
                margin: '0'
              }
            });
            if (dataUrl) {
              const link = document.createElement('a');
              link.download = `Classic_Sheet_GW${state.currentGw}_${Date.now()}.png`;
              link.href = dataUrl;
              link.click();
              showToast('📸 Classic Sheet image downloaded!');
            }
          }
        } catch (err) {
          console.warn('Sheet image export error:', err);
          showToast('Failed to export sheet image.');
        } finally {
          btnExportSheet.disabled = false;
          btnExportSheet.textContent = '📸 Export Image';
        }
      });
    }

    const sdChipSelect = document.getElementById('classicSheetSdChipSelect');
    if (sdChipSelect) {
      sdChipSelect.value = state.classicSheetSdChipMode || 'current';
      sdChipSelect.addEventListener('change', (e) => {
        state.classicSheetSdChipMode = e.target.value;
        renderClassicSheetView();
      });
    }

    const bgPicker = document.getElementById('classicSheetBannerBg');
    const textPicker = document.getElementById('classicSheetBannerText');
    const bannerEl = document.getElementById('classicSheetBanner');

    function applyBannerColors() {
      if (bannerEl) {
        bannerEl.style.backgroundColor = state.classicSheetBannerBg;
        bannerEl.style.color = state.classicSheetBannerText;
      }
      if (bgPicker) bgPicker.value = state.classicSheetBannerBg;
      if (textPicker) textPicker.value = state.classicSheetBannerText;
    }

    if (bgPicker) {
      bgPicker.addEventListener('input', (e) => {
        state.classicSheetBannerBg = e.target.value;
        localStorage.setItem('cs_banner_bg', state.classicSheetBannerBg);
        applyBannerColors();
      });
    }

    if (textPicker) {
      textPicker.addEventListener('input', (e) => {
        state.classicSheetBannerText = e.target.value;
        localStorage.setItem('cs_banner_text', state.classicSheetBannerText);
        applyBannerColors();
      });
    }

    applyBannerColors();
  }

  // ===================== #8 COLLAPSIBLE SECTIONS =====================
  function initCollapsibles() {
    document.querySelectorAll('.collapse-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.target;
        const content = document.getElementById(targetId);
        if (!content) return;
        const isCollapsed = content.classList.toggle('collapsed');
        btn.textContent = isCollapsed ? '▼ Expand' : '▲ Collapse';
      });
    });
  }

  // ===================== LIVE FPL SYNC =====================
  async function fetchFplWithTimeout(targetUrl, timeoutMs = 8000) {
    const proxies = [
      `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
      `https://corsproxy.io/?${targetUrl}`,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`,
      `https://thingproxy.freeboard.io/fetch/${targetUrl}`,
      targetUrl // direct attempt
    ];

    function isValidFplPayload(data) {
      if (!data || typeof data !== 'object') return false;
      if (data.error || data.message === 'Not found') return false;
      return Boolean(
        data.standings ||
        data.league ||
        data.events ||
        data.elements ||
        data.entry_history ||
        data.picks ||
        data.current ||
        data.status ||
        data.chips ||
        Array.isArray(data)
      );
    }

    const fetchSingleProxy = async (proxyUrl) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const resp = await fetch(proxyUrl, {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' }
        });
        clearTimeout(timeoutId);
        if (resp.ok) {
          const text = await resp.text();
          if (text) {
            const data = JSON.parse(text);
            if (isValidFplPayload(data)) {
              return data;
            }
          }
        }
      } catch (e) {
        clearTimeout(timeoutId);
      }
      throw new Error('Proxy failed or returned invalid data');
    };

    try {
      // Race all proxies simultaneously — fastest valid proxy wins!
      return await Promise.any(proxies.map(p => fetchSingleProxy(p)));
    } catch (allErr) {
      return null;
    }
  }

  async function syncLiveFplLeague() {
    let inputCode = elements.leagueIdInput.value.trim();
    if (!inputCode) return;

    // Automatic Join Code mapping fallback for pre-season join codes
    if (inputCode.toLowerCase() === '8d70fl') inputCode = '389585';
    if (inputCode.toLowerCase() === '0m27ty') inputCode = '390100';
    
    if (!inputCode) {
      alert('Please enter a valid FPL League ID or Join Code.');
      return;
    }

    await fetchLeagueData(inputCode);
  }

  async function fetchLeagueData(inputCode) {
    if (!inputCode) return;

    if (inputCode.toLowerCase() === 'demo') {
      loadDemoData();
      return;
    }

    state.activeLeagueId = String(inputCode);
    const fetchId = ++state.fetchCounter;

    // Highlight active pill
    document.querySelectorAll('.league-pill').forEach(p => {
      p.classList.toggle('active', p.dataset.leagueCode === String(inputCode));
    });

    elements.syncStatusTag.className = 'sync-status-tag pending';
    elements.syncStatusTag.textContent = `Syncing #${inputCode}...`;

    let dataLoadedSuccessfully = false;

    // 1. Load initial cached/bundled data from window.FPL_LIVE_STATIC and live_data.json
    try {
      if (window.FPL_LIVE_STATIC) {
        state.dataset.players = window.FPL_LIVE_STATIC.players || {};
        state.dataset.squadPicks = window.FPL_LIVE_STATIC.squadPicks || {};
        state.dataset.transfersHistory = window.FPL_LIVE_STATIC.transfersHistory || {};
        state.dataset.teams = window.FPL_LIVE_STATIC.teams || {};
      }

      const resp = await fetch(`./live_data.json?t=${Date.now()}`);
      if (resp.ok) {
        const liveJson = await resp.json();
        if (liveJson && liveJson.leagues && liveJson.leagues[inputCode]) {
          const lData = liveJson.leagues[inputCode];
          state.dataset.managers = lData.managers || [];
          state.dataset.gameweeks = lData.gameweeks || [];
          if (lData.months) state.dataset.months = lData.months;
          if (lData.leagueName) {
            if (elements.leagueNameHeader) elements.leagueNameHeader.textContent = lData.leagueName;
            if (elements.leagueNameDisplay) elements.leagueNameDisplay.textContent = lData.leagueName;
          }
          if (lData.currentGw) {
            state.currentGw = lData.currentGw;
            state.maxGw = lData.currentGw;
          }
          if (liveJson.players) state.dataset.players = liveJson.players;
          if (liveJson.squadPicks) state.dataset.squadPicks = liveJson.squadPicks;
          if (liveJson.transfersHistory) state.dataset.transfersHistory = liveJson.transfersHistory;
          if (liveJson.teams) state.dataset.teams = liveJson.teams;
          if (liveJson.eventStatuses) {
            state.eventStatuses = liveJson.eventStatuses;
          }

          populateGwSelect();
          changeGw(state.currentGw);
          updateMemberCountBadge();
          renderAll();
          dataLoadedSuccessfully = true;
          elements.syncStatusTag.className = 'sync-status-tag live';
          elements.syncStatusTag.textContent = `SYNCED (${state.dataset.managers.length} Members)`;
        }
      }
    } catch (e) {
      console.warn('live_data.json load notice:', e);
    }

    // 2. Check local cache (only if live_data.json was not loaded)
    try {
      const cached = localStorage.getItem(`fpl_live_cache_${inputCode}`);
      if (cached && !dataLoadedSuccessfully) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.managers && parsed.managers.length > 0) {
          state.dataset.managers = parsed.managers;
          if (parsed.gameweeks) state.dataset.gameweeks = parsed.gameweeks;
          if (parsed.leagueName) {
            if (elements.leagueNameHeader) elements.leagueNameHeader.textContent = parsed.leagueName;
            if (elements.leagueNameDisplay) elements.leagueNameDisplay.textContent = parsed.leagueName;
          }
          if (parsed.currentGw) {
            state.currentGw = parsed.currentGw;
            state.maxGw = parsed.currentGw;
          }
          if (parsed.eventStatuses) {
            state.eventStatuses = parsed.eventStatuses;
          }
          populateGwSelect();
          changeGw(state.currentGw);
          updateMemberCountBadge();
          renderAll();
          dataLoadedSuccessfully = true;
        }
      }
    } catch (cErr) {}

    // If still no data at all (first visit with no network), set clean pre-season template
    if (!dataLoadedSuccessfully && (!state.dataset.managers || state.dataset.managers.length === 0)) {
      if (inputCode === '390100') {
        if (elements.leagueNameHeader) elements.leagueNameHeader.textContent = "Fantasy with Heng";
        if (elements.leagueNameDisplay) elements.leagueNameDisplay.textContent = "Fantasy with Heng";
        state.dataset.managers = [
          { id: 145847, name: "Hokheng Ker", teamName: "Undefeated", avatar: "HK" },
          { id: 2019453, name: "Seyha ly", teamName: "The Red Devil", avatar: "SL" }
        ];
      } else if (inputCode === '389585') {
        if (elements.leagueNameHeader) elements.leagueNameHeader.textContent = "Clash of Elite 2026-2027";
        if (elements.leagueNameDisplay) elements.leagueNameDisplay.textContent = "Clash of Elite 2026-2027";
        state.dataset.managers = [
          { id: 2023789, name: "Monor Noem", teamName: "NORA FC", avatar: "MO" },
          { id: 2023013, name: "នរ សិង្ហ កន្សៃ", teamName: "G.O.A.T", avatar: "នរ" },
          { id: 2026484, name: "Bora Chhe", teamName: "Bora's Team", avatar: "BO" },
          { id: 2067578, name: "Kun Phaktra", teamName: "The Blue Warriors", avatar: "KU" },
          { id: 2026160, name: "Piseth Nhim", teamName: "DESSTRo", avatar: "PI" },
          { id: 2019453, name: "Seyha ly", teamName: "The Red Devil", avatar: "SE" },
          { id: 2024611, name: "Vibol Dang", teamName: "The White Emperor", avatar: "VI" }
        ];
      } else {
        state.dataset.managers = [];
      }
      state.dataset.gameweeks = Array.from({ length: 38 }, (_, i) => ({
        gw: i + 1, scores: {}, hits: {}, transfers: {}, benchPoints: {}, captainPoints: {}, chipsUsed: {}, seasonTotals: {}
      }));
      updateMemberCountBadge();
      renderAll();
    }

    // 3. Attempt direct real-time API fetch
    try {
      const standingsUrl = `https://fantasy.premierleague.com/api/leagues-classic/${inputCode}/standings/`;
      const data = await fetchFplWithTimeout(standingsUrl, 8000);
      if (fetchId !== state.fetchCounter) return;
      if (!data) throw new Error(`Could not reach live API for #${inputCode}`);

      if (data && data.league && data.league.name) {
        elements.leagueNameHeader.textContent = data.league.name;
        if (elements.leagueNameDisplay) elements.leagueNameDisplay.textContent = data.league.name;
      }

      let fetchedResults = [];
      if (data && data.standings && data.standings.results && data.standings.results.length > 0) {
        fetchedResults = data.standings.results;
      } else if (data && data.new_entries && data.new_entries.results && data.new_entries.results.length > 0) {
        fetchedResults = data.new_entries.results;
      }

      if (fetchedResults.length > 0) {
        const count = fetchedResults.length;
        elements.syncStatusTag.className = 'sync-status-tag live';
        elements.syncStatusTag.textContent = `LIVE (${count} Members)`;

        const realManagerMap = {
          145847: { name: "Hokheng Ker", teamName: "Undefeated" },
          2019453: { name: "Seyha ly", teamName: "The Red Devil" },
          2067578: { name: "Kun Phaktra", teamName: "The Blue Warriors" },
          2026160: { name: "Piseth Nhim", teamName: "DESSTRo" },
          2026484: { name: "Bora Chhe", teamName: "Bora's Team" },
          2024611: { name: "Vibol Dang", teamName: "The White Emperor" },
          2023789: { name: "Monor Noem", teamName: "NORA FC" },
          2023013: { name: "នរ សិង្ហ កន្សៃ", teamName: "G.O.A.T" }
        };

        state.dataset.managers = fetchedResults.map(r => ({
          id: r.entry,
          name: realManagerMap[r.entry]?.name || (r.player_name ? r.player_name : `${r.player_first_name || ''} ${r.player_last_name || ''}`.trim() || r.entry_name),
          teamName: realManagerMap[r.entry]?.teamName || r.entry_name,
          avatar: (realManagerMap[r.entry]?.name || r.player_name || r.entry_name).substring(0, 2).toUpperCase()
        }));

        state.dataset.months = [
          { name: "August", gws: [1, 2, 3] },
          { name: "September", gws: [4, 5, 6] },
          { name: "October", gws: [7, 8, 9, 10] },
          { name: "November", gws: [11, 12, 13, 14] },
          { name: "December", gws: [15, 16, 17, 18, 19, 20] },
          { name: "January", gws: [21, 22, 23, 24] },
          { name: "February", gws: [25, 26, 27] },
          { name: "March", gws: [28, 29, 30] },
          { name: "April", gws: [31, 32, 33, 34] },
          { name: "May", gws: [35, 36, 37, 38] }
        ];

        // Maintain or initialize 38 gameweeks
        if (!state.dataset.gameweeks || state.dataset.gameweeks.length < 38) {
          state.dataset.gameweeks = Array.from({ length: 38 }, (_, i) => ({
            gw: i + 1, scores: {}, hits: {}, transfers: {}, benchPoints: {}, captainPoints: {}, chipsUsed: {}, seasonTotals: {}
          }));
        }

        // Fetch Live FPL Gameweek & Event Status with Multi-Proxy Fallback
        let detectedGw = state.currentGw || 1;
        try {
          const bsTargetUrl = 'https://fantasy.premierleague.com/api/bootstrap-static/';
          const bsData = await fetchFplWithTimeout(bsTargetUrl, 6000);

          if (bsData && bsData.events) {
            bsData.events.forEach(ev => {
              state.eventStatuses[ev.id] = {
                gw: ev.id,
                finished: ev.finished,
                data_checked: ev.data_checked,
                is_current: ev.is_current,
                is_previous: ev.is_previous,
                is_next: ev.is_next,
                deadline_time: ev.deadline_time,
                bonus_added: ev.finished || ev.data_checked,
                leagues: ev.data_checked ? 'Updated' : 'Updating'
              };
            });

            if (bsData.elements && Array.isArray(bsData.elements)) {
              window.PL_PLAYER_MAP = {};
              if (!state.dataset.players) state.dataset.players = {};
              bsData.elements.forEach(el => {
                window.PL_PLAYER_MAP[el.id] = el.web_name || `${el.first_name} ${el.second_name}`;
                if (!state.dataset.players[el.id]) {
                  state.dataset.players[el.id] = {
                    id: el.id,
                    web_name: el.web_name,
                    element_type: el.element_type,
                    event_points: el.event_points || 0
                  };
                } else {
                  state.dataset.players[el.id].event_points = el.event_points || 0;
                }
              });
            }

            const activeEv = bsData.events.find(e => e.is_current);
            const nextEv = bsData.events.find(e => e.is_next);
            const prevEv = bsData.events.filter(e => e.finished).pop();

            if (activeEv) detectedGw = activeEv.id;
            else if (prevEv) detectedGw = prevEv.id;
            else if (nextEv) detectedGw = Math.max(1, nextEv.id - 1);
          }

          // Populate current GW baseline from standings
          fetchedResults.forEach(r => {
            if (state.dataset.gameweeks[detectedGw - 1]) {
              state.dataset.gameweeks[detectedGw - 1].scores[r.entry] = r.event_total !== undefined ? r.event_total : 0;
              state.dataset.gameweeks[detectedGw - 1].seasonTotals[r.entry] = r.total !== undefined ? r.total : (r.event_total || 0);
            }
          });

          // Fetch Event Status, Fixtures & Live Player Stats to accurately determine match status
          const [stData, fixData, liveEventData] = await Promise.all([
            fetchFplWithTimeout('https://fantasy.premierleague.com/api/event-status/', 3500),
            fetchFplWithTimeout(`https://fantasy.premierleague.com/api/fixtures/?event=${detectedGw}`, 3500),
            fetchFplWithTimeout(`https://fantasy.premierleague.com/api/event/${detectedGw}/live/`, 3500)
          ]);

          const elStatsMap = {};
          if (liveEventData && liveEventData.elements && Array.isArray(liveEventData.elements)) {
            liveEventData.elements.forEach(el => {
              if (el && el.id && el.stats) {
                elStatsMap[el.id] = el.stats;
              }
            });
          }

          if (fixData && Array.isArray(fixData) && state.dataset.players) {
            const teamFixMap = {};
            fixData.forEach(f => {
              teamFixMap[f.team_h] = f;
              teamFixMap[f.team_a] = f;
            });

            // Also map by team short name if team_id not present
            const teamsMap = state.dataset.teams || (window.FPL_LIVE_STATIC && window.FPL_LIVE_STATIC.teams) || {};
            const teamCodeMap = {};
            Object.entries(teamsMap).forEach(([tId, tObj]) => {
              if (tObj && tObj.short_name) teamCodeMap[tObj.short_name] = Number(tId);
            });

            Object.values(state.dataset.players).forEach(pl => {
              const teamId = pl.team_id || teamCodeMap[pl.team] || pl.team;
              const fix = teamFixMap[teamId] || {};
              const st = elStatsMap[pl.id] || {};

              const fixStarted = fix.started === true;
              const fixFinished = fix.finished === true || (fix.minutes || 0) >= 90;
              const minutesPlayed = st.minutes !== undefined ? st.minutes : (pl.minutes || 0);
              const playedFlag = st.played === true || minutesPlayed > 0;

              // Determine Opponent & Fixture Difficulty Rating (FDR)
              let oppShort = '-';
              let difficulty = 3;
              if (fix && (fix.team_h || fix.team_a)) {
                const isHome = (Number(teamId) === Number(fix.team_h));
                const oppId = isHome ? fix.team_a : fix.team_h;
                difficulty = isHome ? (fix.team_h_difficulty || 3) : (fix.team_a_difficulty || 3);
                const oppTeamObj = teamsMap[oppId] || Object.values(teamsMap).find(t => t.id === oppId) || {};
                oppShort = oppTeamObj.short_name || oppTeamObj.name || (oppId ? `Team #${oppId}` : '-');
              }

              pl.opponent = oppShort;
              pl.opponent_short = oppShort;
              pl.difficulty = difficulty || 3;

              if (st.total_points !== undefined) {
                pl.event_points = st.total_points;
              }
              pl.minutes = minutesPlayed;

              if (!fixStarted) {
                pl.match_status = 'yet_to_play';
                pl.status_label = '⏳ Yet to Play';
              } else if (playedFlag || minutesPlayed > 0) {
                if (fixFinished) {
                  pl.match_status = 'played';
                  pl.status_label = '✓ Played';
                } else {
                  pl.match_status = 'live';
                  pl.status_label = `🟢 Live (${fix.minutes || 0}')`;
                }
              } else {
                if (fixFinished) {
                  pl.match_status = 'dnp';
                  pl.status_label = '✕ DNP (0m)';
                } else {
                  pl.match_status = 'live';
                  pl.status_label = `🟢 Live (${fix.minutes || 0}')`;
                }
              }
            });
          }

          if (stData && stData.status) {
            stData.status.forEach(st => {
              if (state.eventStatuses[st.event]) {
                state.eventStatuses[st.event].bonus_added = st.bonus_added;
                state.eventStatuses[st.event].points = st.points;
              }
            });
            if (state.eventStatuses[detectedGw]) {
              state.eventStatuses[detectedGw].daily_status = stData.status.filter(s => s.event === detectedGw);
            }
          }
        } catch (stErr) {
          console.warn('FPL Event Status fetch notice:', stErr);
        }

        state.currentGw = detectedGw;
        state.maxGw = detectedGw;
        if (!state.fixturesGw) state.fixturesGw = state.currentGw;
        if (!state.weeklyGw) state.weeklyGw = state.currentGw;
        if (!state.statusGw) state.statusGw = state.currentGw;

        // Fetch detailed manager history & picks in parallel
        try {
          elements.syncStatusTag.textContent = `Syncing Details...`;
          const managerPromises = state.dataset.managers.map(async (m) => {
            try {
              const histUrl = `https://fantasy.premierleague.com/api/entry/${m.id}/history/`;
              const histData = await fetchFplWithTimeout(histUrl, 3500);

              const picksUrl = `https://fantasy.premierleague.com/api/entry/${m.id}/event/${detectedGw}/picks/`;
              const picksData = await fetchFplWithTimeout(picksUrl, 3500);

              return { id: m.id, histData, picksData };
            } catch (e) {
              return { id: m.id, histData: null, picksData: null };
            }
          });

          const managerDetails = await Promise.all(managerPromises);

          managerDetails.forEach(({ id, histData, picksData }) => {
            const liveRes = fetchedResults.find(r => r.entry === id);

            if (histData && histData.current && Array.isArray(histData.current) && histData.current.length > 0) {
              histData.current.forEach(h => {
                const gNum = h.event;
                if (gNum >= 1 && gNum <= 38) {
                  const gwObj = state.dataset.gameweeks[gNum - 1];
                  gwObj.scores[id] = h.points || 0;
                  gwObj.hits[id] = h.event_transfers_cost || 0;
                  gwObj.transfers[id] = h.event_transfers || 0;
                  gwObj.benchPoints[id] = h.points_on_bench || 0;
                  gwObj.seasonTotals[id] = h.total_points || 0;
                }
              });
            } else {
              const gwObj = state.dataset.gameweeks[detectedGw - 1];
              if (gwObj && liveRes) {
                gwObj.scores[id] = liveRes.event_total || 0;
                gwObj.seasonTotals[id] = liveRes.total || liveRes.event_total || 0;
              }
            }

            if (histData && histData.chips && Array.isArray(histData.chips)) {
              histData.chips.forEach(c => {
                const gNum = c.event;
                if (gNum >= 1 && gNum <= 38) {
                  state.dataset.gameweeks[gNum - 1].chipsUsed[id] = c.name;
                }
              });
            }

            if (picksData) {
              const currGwObj = state.dataset.gameweeks[detectedGw - 1];
              if (currGwObj) {
                if (picksData.active_chip) {
                  currGwObj.chipsUsed[id] = picksData.active_chip;
                }
                if (picksData.entry_history) {
                  if (picksData.entry_history.points !== undefined) currGwObj.scores[id] = picksData.entry_history.points;
                  if (picksData.entry_history.event_transfers_cost !== undefined) currGwObj.hits[id] = picksData.entry_history.event_transfers_cost;
                  if (picksData.entry_history.event_transfers !== undefined) currGwObj.transfers[id] = picksData.entry_history.event_transfers;
                  if (picksData.entry_history.points_on_bench !== undefined) currGwObj.benchPoints[id] = picksData.entry_history.points_on_bench;
                  if (picksData.entry_history.total_points !== undefined) currGwObj.seasonTotals[id] = picksData.entry_history.total_points;
                }
              }
            }
          });
        } catch (detailErr) {
          console.warn('Manager detail sync notice:', detailErr);
        }

        if (fetchId !== state.fetchCounter) return;

        try {
          localStorage.setItem(`fpl_live_cache_${inputCode}`, JSON.stringify({
            leagueName: (data && data.league && data.league.name) ? data.league.name : "Clash of Elite 2026-2027",
            managers: state.dataset.managers,
            gameweeks: state.dataset.gameweeks,
            currentGw: state.currentGw,
            eventStatuses: state.eventStatuses
          }));
        } catch (saveErr) {}

        populateGwSelect();
        changeGw(state.currentGw);
        updateMemberCountBadge();
        renderAll();
      } else {
        throw new Error('No live standings found');
      }
    } catch (err) {
      console.warn('Live API direct proxy fetch not reachable, maintaining verified synced dataset:', err);
      if (state.dataset.managers && state.dataset.managers.length > 0) {
        elements.syncStatusTag.className = 'sync-status-tag live';
        elements.syncStatusTag.textContent = `SYNCED (${state.dataset.managers.length} Members)`;
        populateGwSelect();
        changeGw(state.currentGw || 1);
        updateMemberCountBadge();
        renderAll();
      }
    }
  }

  // ===================== GW NAVIGATION =====================
  function changeGw(newGw) {
    if (newGw < 1 || newGw > state.maxGw) return;
    state.currentGw = newGw;
    elements.gwSelect.value = newGw;
    elements.gwDisplay.textContent = `Gameweek ${newGw}`;
    
    if (elements.standingsGwBadge) {
      elements.standingsGwBadge.textContent = `Gameweek ${newGw}`;
    }

    elements.prevGwBtn.disabled = newGw === 1;
    elements.nextGwBtn.disabled = newGw === state.maxGw;
    renderAll();
  }

  // ===================== DATA HELPERS =====================
  function getCurrentGwMonth(gw) {
    return state.dataset.months.find(m => m.gws.includes(gw)) || state.dataset.months[0];
  }

  function getMonthlyMotmLeader(gw) {
    const activeMonth = getCurrentGwMonth(gw);
    const monthGws = activeMonth.gws;
    const startGw = Math.min(...monthGws);
    const endGw = Math.max(...monthGws);

    const datasetMaxGw = Math.max(...state.dataset.gameweeks.map(g => g.gw));
    const isFinalized = datasetMaxGw > endGw || gw > endGw;

    const gwsToCalculate = isFinalized ? monthGws : monthGws.filter(g => g <= gw);
    const managers = state.dataset.managers;

    const totals = managers.map(m => {
      let netPts = 0, benchPts = 0, captainPts = 0, hitCost = 0;
      gwsToCalculate.forEach(g => {
        const gwData = state.dataset.gameweeks.find(x => x.gw === g);
        if (gwData) {
          const hCost = gwData.hits ? (gwData.hits[m.id] || 0) : 0;
          netPts += (gwData.scores[m.id] || 0) - hCost;
          benchPts += (gwData.benchPoints[m.id] || 0);
          captainPts += gwData.captainPoints ? (gwData.captainPoints[m.id] || 0) : 0;
          hitCost += hCost;
        }
      });
      const seasonTotalNet = getManagerSeasonNetUpToGw(m.id, isFinalized ? endGw : gw);
      return { id: m.id, name: m.name, netPts, benchPts, captainPts, hitCost, seasonTotalNet };
    });

    // 4-Layer Custom Tiebreaker Sort (matching Gameweek tiebreaker rule)
    totals.sort((a, b) => {
      if (b.netPts      !== a.netPts)      return b.netPts - a.netPts;
      if (b.benchPts    !== a.benchPts)    return b.benchPts - a.benchPts;         // Layer 1: Bench Pts
      if (b.captainPts  !== a.captainPts)  return b.captainPts - a.captainPts;     // Layer 2: Captain Pts
      if (a.hitCost     !== b.hitCost)     return a.hitCost - b.hitCost;           // Layer 3: Hits
      return b.seasonTotalNet - a.seasonTotalNet;                                  // Layer 4: Season Net Pts
    });

    return { activeMonth, leader: totals[0], totals, isFinalized, startGw, endGw };
  }

  function getSeasonLeaders(gw) {
    const managers = state.dataset.managers;
    if (!managers || managers.length === 0) return [];
    
    const totals = managers.map(m => {
      let totalNetPts = 0;
      for (let g = 1; g <= gw; g++) {
        const gwData = state.dataset.gameweeks.find(x => x.gw === g);
        if (gwData) totalNetPts += (gwData.scores[m.id] || 0) - (gwData.hits ? (gwData.hits[m.id] || 0) : 0);
      }
      return { id: m.id, name: m.name, totalNetPts };
    });
    totals.sort((a, b) => b.totalNetPts - a.totalNetPts);
    
    const maxPts = totals[0].totalNetPts;
    return totals.filter(t => t.totalNetPts === maxPts);
  }

  function getManagerSeasonNetUpToGw(managerId, upToGw) {
    let sum = 0;
    for (let g = 1; g <= upToGw; g++) {
      const gwData = state.dataset.gameweeks.find(x => x.gw === g);
      const gross = (typeof getManagerLiveScore === 'function') ? getManagerLiveScore(managerId, g) : ((gwData && gwData.scores) ? (gwData.scores[managerId] || 0) : 0);
      const hits = (gwData && gwData.hits) ? (gwData.hits[managerId] || 0) : 0;
      sum += (gross - hits);
    }
    return sum;
  }

  function getChipColorClass(chipName) {
    if (!chipName) return '';
    const n = chipName.toLowerCase();
    if (n.includes('wildcard') || n.includes('wc')) return 'chip-wildcard';
    if (n.includes('free hit') || n.includes('freehit') || n.includes('fh')) return 'chip-free-hit';
    if (n.includes('bench boost') || n.includes('bboost') || n.includes('bb')) return 'chip-bench-boost';
    if (n.includes('triple captain') || n.includes('3xc') || n.includes('tc')) return 'chip-triple-captain';
    return '';
  }

  // Short display label — always includes the set number (e.g. "WC 1", "FH 2")
  function getChipLabel(chipName) {
    if (!chipName) return '';
    const n = chipName.toLowerCase();
    const num = chipName.match(/\d+/)?.[0] || '1';
    if (n.includes('wildcard') || n.includes('wc')) return `WC ${num}`;
    if (n.includes('free hit') || n.includes('freehit') || n.includes('fh')) return `FH ${num}`;
    if (n.includes('bench boost') || n.includes('bboost') || n.includes('bb')) return `BB ${num}`;
    if (n.includes('triple captain') || n.includes('3xc') || n.includes('tc')) return `TC ${num}`;
    return chipName.toUpperCase();
  }

  // ===================== AUTO-SUBSTITUTIONS CALCULATION ENGINE =====================
  function computeAutoSubs(picks, automaticSubs, pMap, isBenchBoost) {
    if (isBenchBoost || !picks || picks.length === 0) return [];

    // 1. Official automatic_subs from FPL API
    if (automaticSubs && automaticSubs.length > 0) {
      return automaticSubs.map(s => ({
        element_in: s.element_in,
        element_out: s.element_out,
        is_official: true
      }));
    }

    // 2. Live predictive auto-subs
    const starters = picks.filter(p => p.position <= 11);
    const bench = picks.filter(p => p.position > 11).sort((a, b) => a.position - b.position);

    const dnpStarters = starters.filter(p => {
      const pl = pMap[p.element];
      return pl && pl.match_status === 'dnp';
    });

    if (dnpStarters.length === 0) return [];

    const computed = [];
    const usedBenchIds = new Set();

    const currentFormation = { 1: 0, 2: 0, 3: 0, 4: 0 };
    starters.forEach(p => {
      const pl = pMap[p.element];
      const type = pl?.element_type || (p.position === 1 ? 1 : 2);
      currentFormation[type] = (currentFormation[type] || 0) + 1;
    });

    // Goalkeeper DNP
    const gkStarter = dnpStarters.find(p => p.position === 1);
    if (gkStarter) {
      const benchGk = bench.find(p => p.position === 12);
      if (benchGk) {
        const plGk = pMap[benchGk.element];
        if (plGk && plGk.match_status !== 'dnp') {
          computed.push({
            element_in: benchGk.element,
            element_out: gkStarter.element,
            is_official: false
          });
          usedBenchIds.add(benchGk.element);
        }
      }
    }

    // Outfield DNPs
    const outfieldDnps = dnpStarters.filter(p => p.position > 1);
    const outfieldBench = bench.filter(p => p.position > 12);

    for (const dnpStarter of outfieldDnps) {
      const pOutInfo = pMap[dnpStarter.element];
      const outType = pOutInfo?.element_type || 2;

      for (const benchPick of outfieldBench) {
        if (usedBenchIds.has(benchPick.element)) continue;

        const pInInfo = pMap[benchPick.element];
        if (!pInInfo || pInInfo.match_status === 'dnp') continue;

        const inType = pInInfo.element_type || 2;
        const testFormation = { ...currentFormation };
        testFormation[outType]--;
        testFormation[inType]++;

        // Valid FPL formation: 1 GK, 3-5 DEF, 2-5 MID, 1-3 FWD
        const isValid = testFormation[1] === 1 &&
                        testFormation[2] >= 3 && testFormation[2] <= 5 &&
                        testFormation[3] >= 2 && testFormation[3] <= 5 &&
                        testFormation[4] >= 1 && testFormation[4] <= 3;

        if (isValid) {
          computed.push({
            element_in: benchPick.element,
            element_out: dnpStarter.element,
            is_official: false
          });
          usedBenchIds.add(benchPick.element);
          currentFormation[outType]--;
          currentFormation[inType]++;
          break;
        }
      }
    }

    return computed;
  }

  function getManagerLiveScore(mId, gw) {
    const gwData = state.dataset.gameweeks.find(g => g.gw === gw);
    let fallbackScore = (gwData && gwData.scores) ? (gwData.scores[mId] || 0) : 0;

    const staticData = window.FPL_LIVE_STATIC || {};
    const squadPicksMap = (state.dataset.squadPicks && Object.keys(state.dataset.squadPicks).length > 0)
      ? state.dataset.squadPicks
      : (staticData.squadPicks || {});
    const playersMap = (state.dataset.players && Object.keys(state.dataset.players).length > 0)
      ? state.dataset.players
      : (staticData.players || {});

    const mgrPicks = squadPicksMap[String(mId)] || squadPicksMap[Number(mId)];
    const squadData = (mgrPicks && (mgrPicks[String(gw)] || mgrPicks[Number(gw)])) || null;

    if (!squadData || !squadData.picks || squadData.picks.length === 0 || !playersMap || Object.keys(playersMap).length === 0) {
      return fallbackScore;
    }

    const activeChip = squadData.active_chip ? getChipLabel(squadData.active_chip) : null;
    const isBenchBoost = Boolean(activeChip && (activeChip.toLowerCase().includes('bb') || activeChip.toLowerCase().includes('bench boost')));

    const autoSubs = computeAutoSubs(squadData.picks, squadData.automatic_subs, playersMap, isBenchBoost);
    const subInIds = new Set(autoSubs.map(s => s.element_in));
    const subOutIds = new Set(autoSubs.map(s => s.element_out));

    let liveSum = 0;
    let hasPlayerPoints = false;

    squadData.picks.forEach(p => {
      const pl = playersMap[p.element];
      const pts = pl ? (pl.event_points || 0) : 0;
      if (pts > 0) hasPlayerPoints = true;
      const multiplier = p.multiplier || 1;

      if (isBenchBoost) {
        liveSum += pts * multiplier;
      } else if (p.position <= 11) {
        if (!subOutIds.has(p.element)) {
          liveSum += pts * multiplier;
        }
      } else if (subInIds.has(p.element)) {
        liveSum += pts;
      }
    });

    return hasPlayerPoints ? liveSum : fallbackScore;
  }

  // ===================== STANDINGS ENGINE =====================
  function getGameweekStandings(gw) {
    const gwData = state.dataset.gameweeks.find(g => g.gw === gw);
    if (!gwData) return [];

    const activeManagers = state.dataset.managers;
    const total = activeManagers.length;

    let managers = activeManagers.map(m => {
      const grossScore    = getManagerLiveScore(m.id, gw);
      const hitCost       = gwData.hits ? (gwData.hits[m.id] || 0) : 0;
      const transfers     = gwData.transfers ? (gwData.transfers[m.id] ?? (hitCost > 0 ? Math.floor(hitCost / 4) + 1 : 0)) : (hitCost > 0 ? Math.floor(hitCost / 4) + 1 : 0);
      const netScore      = grossScore - hitCost;
      const bench         = gwData.benchPoints[m.id] || 0;
      const captain       = gwData.captainPoints ? (gwData.captainPoints[m.id] || 0) : 0;
      const chip          = gwData.chipsUsed[m.id] || null;
      const seasonTotalNet = getManagerSeasonNetUpToGw(m.id, gw);
      return { ...m, grossScore, hitCost, transfers, netScore, bench, captain, chip, seasonTotalNet };
    });

    // 4-Layer Custom Tiebreaker Sort
    managers.sort((a, b) => {
      if (b.netScore   !== a.netScore)   return b.netScore - a.netScore;
      if (b.bench      !== a.bench)      return b.bench - a.bench;           // Layer 1
      if (b.captain    !== a.captain)    return b.captain - a.captain;       // Layer 2
      if (a.hitCost    !== b.hitCost)    return a.hitCost - b.hitCost;       // Layer 3
      return b.seasonTotalNet - a.seasonTotalNet;                            // Layer 4
    });

    // Dynamic zone sizes:
    const splitSize  = Math.floor(total / 2);
    const hasNeutral = total % 2 === 1; // true only when N is odd
    const neutralRank = hasNeutral ? splitSize + 1 : null; // exact middle rank
    const hasPlayedMatches = managers.some(m => m.grossScore > 0 || m.hitCost > 0);

    return managers.map((m, idx) => {
      const rank = idx + 1;
      let payout = 0, statusClass = '', outcomeCode = 'N', note = '';

      if (!hasPlayedMatches) {
        payout = 0;
        statusClass = 'tr-neutral';
        outcomeCode = '-';
        note = 'Neutral';
      } else {
        if (rank <= splitSize) {
          payout = state.entryFee; statusClass = 'tr-top-3'; outcomeCode = 'W';
          const payer = managers[total - rank];
          note = `Gets from ${payer ? payer.name : 'Bottom'}`;
        } else if (hasNeutral && rank === neutralRank) {
          payout = 0; statusClass = 'tr-neutral'; outcomeCode = 'N';
          note = 'Neutral';
        } else {
          payout = -state.entryFee; statusClass = 'tr-bottom-3'; outcomeCode = 'L';
          const receiver = managers[total - rank];
          note = `Pays to ${receiver ? receiver.name : 'Top'}`;
        }
      }

      // Tiebreaker indicator — applies to ALL managers sharing a boundary score when a boundary tie occurs
      const topBoundaryScore = splitSize > 0 ? managers[splitSize - 1]?.netScore : null;
      const isTopBoundaryTie = splitSize > 0 && managers[splitSize]?.netScore === topBoundaryScore;

      const bottomBoundaryScore = (hasNeutral && neutralRank) ? managers[neutralRank - 1]?.netScore : null;
      const isBottomBoundaryTie = (hasNeutral && neutralRank) && managers[neutralRank]?.netScore === bottomBoundaryScore;

      const tiedAtTop = isTopBoundaryTie && (m.netScore === topBoundaryScore);
      const tiedAtBottom = isBottomBoundaryTie && (m.netScore === bottomBoundaryScore);
      const isTied = hasPlayedMatches && (tiedAtTop || tiedAtBottom);

      return { ...m, rank, payout, statusClass, outcomeCode, isTied, payoutNote: note };
    });
  }

  // ===================== MONTHLY STANDINGS ENGINE =====================
  function getMonthlyStandings(monthName) {
    const monthObj = state.dataset.months.find(m => m.name.toLowerCase() === monthName.toLowerCase()) || state.dataset.months[0];
    const monthGws = monthObj.gws;
    const startGw = Math.min(...monthGws);
    const endGw = Math.max(...monthGws);

    const datasetMaxGw = Math.max(...state.dataset.gameweeks.map(g => g.gw));
    const isFinalized = datasetMaxGw > endGw || state.currentGw > endGw;
    const gwsToCalculate = isFinalized ? monthGws : monthGws.filter(g => g <= state.currentGw);
    
    const activeManagers = state.dataset.managers;
    const total = activeManagers.length;

    let managers = activeManagers.map(m => {
      let grossScore = 0, hitCost = 0, transfers = 0, bench = 0, captain = 0, chips = [];

      gwsToCalculate.forEach(g => {
        const gwData = state.dataset.gameweeks.find(x => x.gw === g);
        if (gwData) {
          const gScore = gwData.scores[m.id] || 0;
          const hCost  = gwData.hits ? (gwData.hits[m.id] || 0) : 0;
          const tMade  = gwData.transfers ? (gwData.transfers[m.id] ?? (hCost > 0 ? Math.floor(hCost / 4) + 1 : 0)) : (hCost > 0 ? Math.floor(hCost / 4) + 1 : 0);
          
          grossScore += gScore;
          hitCost += hCost;
          transfers += tMade;
          bench += (gwData.benchPoints[m.id] || 0);
          captain += gwData.captainPoints ? (gwData.captainPoints[m.id] || 0) : 0;
          if (gwData.chipsUsed && gwData.chipsUsed[m.id]) {
            chips.push(gwData.chipsUsed[m.id]);
          }
        }
      });

      const netScore = grossScore - hitCost;
      const seasonTotalNet = getManagerSeasonNetUpToGw(m.id, isFinalized ? endGw : state.currentGw);
      const chip = chips.length > 0 ? chips.join(', ') : null;

      return { ...m, grossScore, hitCost, transfers, netScore, bench, captain, chip, seasonTotalNet };
    });

    managers.sort((a, b) => {
      if (b.netScore   !== a.netScore)   return b.netScore - a.netScore;
      if (b.bench      !== a.bench)      return b.bench - a.bench;
      if (b.captain    !== a.captain)    return b.captain - a.captain;
      if (a.hitCost    !== b.hitCost)    return a.hitCost - b.hitCost;
      return b.seasonTotalNet - a.seasonTotalNet;
    });

    const splitSize  = Math.floor(total / 2);
    const hasNeutral = total % 2 === 1;
    const neutralRank = hasNeutral ? splitSize + 1 : null;

    return managers.map((m, idx) => {
      const rank = idx + 1;
      let payout = 0, statusClass = '', outcomeCode = 'N';

      if (rank <= splitSize) {
        payout = state.entryFee; statusClass = 'tr-top-3'; outcomeCode = 'W';
      } else if (hasNeutral && rank === neutralRank) {
        payout = 0; statusClass = 'tr-neutral'; outcomeCode = 'N';
      } else {
        payout = -state.entryFee; statusClass = 'tr-bottom-3'; outcomeCode = 'L';
      }

      const topBoundaryScore = splitSize > 0 ? managers[splitSize - 1]?.netScore : null;
      const isTopBoundaryTie = splitSize > 0 && managers[splitSize]?.netScore === topBoundaryScore;

      const bottomBoundaryScore = (hasNeutral && neutralRank) ? managers[neutralRank - 1]?.netScore : null;
      const isBottomBoundaryTie = (hasNeutral && neutralRank) && managers[neutralRank]?.netScore === bottomBoundaryScore;

      const tiedAtTop = isTopBoundaryTie && (m.netScore === topBoundaryScore);
      const tiedAtBottom = isBottomBoundaryTie && (m.netScore === bottomBoundaryScore);
      const isTied = tiedAtTop || tiedAtBottom;

      let note = '';
      if (rank <= splitSize) {
        const payer = managers[total - rank];
        note = `Gets from ${payer ? payer.name : 'Bottom'}`;
      } else if (hasNeutral && rank === neutralRank) {
        note = 'Neutral';
      } else {
        const receiver = managers[total - rank];
        note = `Pays to ${receiver ? receiver.name : 'Top'}`;
      }

      return { ...m, rank, payout, statusClass, outcomeCode, isTied, payoutNote: note, monthObj };
    });
  }

  function getFormGuide(managerId) {
    // Option 1: Strictly previous gameweeks only (excluding the current active/viewed GW)
    if (state.currentGw <= 1) {
      return ['-'];
    }

    const form = [];
    const endGw = state.currentGw - 1;
    const startGw = Math.max(1, endGw - 4);
    for (let gw = startGw; gw <= endGw; gw++) {
      const standings = getGameweekStandings(gw);
      const m = standings.find(x => x.id === managerId);
      if (m && m.outcomeCode && m.outcomeCode !== '-') {
        form.push(m.outcomeCode);
      }
    }
    return form.length > 0 ? form : ['-'];
  }

  // ===================== RENDER ALL =====================
  function renderAll() {
    const hasData = state.dataset.managers && state.dataset.managers.length > 0;
    
    if (document.getElementById('section-gw-status')) {
      document.getElementById('section-gw-status').style.display = hasData ? 'block' : 'none';
    }
    if (document.getElementById('section-form-matrix')) {
      document.getElementById('section-form-matrix').style.display = hasData ? 'block' : 'none';
    }
    if (document.getElementById('section-fixtures')) {
      document.getElementById('section-fixtures').style.display = hasData ? 'block' : 'none';
    }
    if (document.getElementById('section-awards')) {
      document.getElementById('section-awards').style.display = hasData ? 'block' : 'none';
    }
    if (document.getElementById('section-classic-sheets')) {
      document.getElementById('section-classic-sheets').style.display = hasData ? 'block' : 'none';
    }
    document.getElementById('section-standings').style.display = hasData ? 'block' : 'none';
    document.getElementById('section-performance').style.display = hasData ? 'block' : 'none';
    document.getElementById('section-trajectory').style.display = hasData ? 'block' : 'none';
    document.getElementById('section-empty').style.display = hasData ? 'none' : 'block';

    if (!hasData) return;

    renderStandingsTable();
    renderGwStatus();
    renderSeasonMatrixTable();
    renderWinLossSummaryTable();
    renderChipTracker();
    updateChart();
    updatePerformanceChart();
    renderSeasonAwards();
    renderClassicSheetView();
  }

  // ===================== STANDINGS TABLE =====================
  function renderStandingsTable() {
    const isMonthlyView = state.viewMode && state.viewMode !== 'overall';
    let standings = isMonthlyView ? getMonthlyStandings(state.viewMode) : getGameweekStandings(state.currentGw);
    
    if (state.standingsSortColumn === 'seasonTotalNet') {
      standings = [...standings].sort((a, b) => {
        return state.standingsSortDir === 'desc'
          ? b.seasonTotalNet - a.seasonTotalNet
          : a.seasonTotalNet - b.seasonTotalNet;
      });
    }

    const thSeasonPts = document.getElementById('thSeasonPts');
    const sortIcon = document.getElementById('seasonPtsSortIcon');
    if (thSeasonPts && sortIcon) {
      if (state.standingsSortColumn === 'seasonTotalNet') {
        thSeasonPts.classList.add('active-sort');
        sortIcon.textContent = state.standingsSortDir === 'desc' ? '▼' : '▲';
      } else {
        thSeasonPts.classList.remove('active-sort');
        sortIcon.textContent = '⇅';
      }
    }
    
    elements.standingsBody.innerHTML = '';
    if (elements.mobileCards) elements.mobileCards.innerHTML = '';

    const targetGwForMotm = isMonthlyView
      ? Math.min(...(state.dataset.months.find(m => m.name.toLowerCase() === state.viewMode.toLowerCase())?.gws || [state.currentGw]))
      : state.currentGw;

    const motmInfo = getMonthlyMotmLeader(targetGwForMotm);
    const motmLeaderId = motmInfo.leader ? motmInfo.leader.id : null;
    const activeMonthName = motmInfo.activeMonth.name;
    const motsLeaders = getSeasonLeaders(state.currentGw);
    const motsLeaderIds = motsLeaders.map(m => m.id);
    const isMotsTied = motsLeaders.length > 1;
    const motsPrizePerWinner = state.motsPrizePool / Math.max(1, motsLeaders.length);

    // Update GW/Standings Badge
    if (elements.standingsGwBadge) {
      if (isMonthlyView) {
        elements.standingsGwBadge.textContent = `${activeMonthName} Standings`;
      } else {
        elements.standingsGwBadge.textContent = `Gameweek ${state.currentGw}`;
      }
    }

    // Render MOTM Banner (Only when explicitly toggled on via MOTM button)
    const motmBannerContainer = document.getElementById('motmBannerContainer');
    if (motmBannerContainer) {
      if (state.showMotmBadge && motmInfo && motmInfo.leader) {
        const icon = motmInfo.isFinalized ? '🏆' : '⏳';
        
        motmBannerContainer.innerHTML = `
          <div class="motm-banner">
            <span>${icon} <strong>${activeMonthName} Manager of the Month</strong>: <span class="motm-winner-name">${motmInfo.leader.name}</span></span>
          </div>
        `;
      } else {
        motmBannerContainer.innerHTML = '';
      }
    }

    // Render MOTS Banner
    const motsBannerContainer = document.getElementById('motsBannerContainer');
    if (motsBannerContainer) {
      if (state.showMotsBadge && motsLeaders.length > 0) {
        const names = motsLeaders.map(l => l.name).join(' & ');
        const tiedText = isMotsTied ? ' (Tied)' : '';
        motsBannerContainer.innerHTML = `
          <div class="mots-banner">
            <div class="mots-banner-content">
              <span class="mots-icon">🏆</span>
              <div class="mots-text-wrapper">
                <span class="mots-title">MANAGER OF THE SEASON${tiedText}</span>
                <span class="mots-winner-names">${names}</span>
              </div>
            </div>
          </div>
        `;
      } else {
        motsBannerContainer.innerHTML = '';
      }
    }

    // Find highest season total net points for the glow highlight
    const maxSeasonPts = Math.max(...standings.map(m => m.seasonTotalNet));

    standings.forEach(m => {
      // --- Shared data ---
      let rankClass = 'rank-neutral';
      if (m.rank === 1) rankClass = 'rank-1';
      else if (m.rank === 2) rankClass = 'rank-2';
      else if (m.rank === 3) rankClass = 'rank-3';
      else if (m.payout < 0) rankClass = 'rank-bottom';

      let payoutBadge = '';
      if (m.payout > 0)       payoutBadge = `<span class="payout-badge payout-win">+$${m.payout}.00</span>`;
      else if (m.payout < 0)  payoutBadge = `<span class="payout-badge payout-loss">-$${Math.abs(m.payout)}.00</span>`;
      else                    payoutBadge = `<span class="payout-badge payout-neutral">$0.00</span>`;

      const chipColorCls = getChipColorClass(m.chip);
      const chipColumnContent = m.chip
        ? `<span class="chip-tag ${chipColorCls}">${getChipLabel(m.chip)}</span>`
        : `<span style="color:var(--text-muted);font-size:13px;">-</span>`;

      const transferDisplay = m.hitCost > 0
        ? `<span style="font-weight:700;color:var(--text-secondary);">${m.transfers}</span> <span class="hit-tag has-hit">(-${m.hitCost})</span>`
        : `<span style="font-weight:700;color:var(--text-secondary);">${m.transfers}</span>`;

      const formHtml = getFormGuide(m.id).map(code => {
        if (code === '-') return `<span style="color:var(--text-muted);font-weight:700;margin:0 2px;">-</span>`;
        const cls = code === 'W' ? 'form-w' : code === 'L' ? 'form-l' : 'form-n';
        return `<span class="form-pill ${cls}">${code}</span>`;
      }).join('');

      // #6 — Tied managers indicator
      const tiedPill = m.isTied
        ? `<span class="tied-pill">TIED</span>` : '';

      // Tiebreaker detail line — only shown on tied rows
      const tiebreakerDetail = m.isTied
        ? `<span class="tiebreaker-detail">TB → Bench: ${m.bench} · Capt: ${m.captain} · Hits: ${m.hitCost} · Season: ${m.seasonTotalNet}</span>`
        : '';

      const abaAccount = ABA_ACCOUNTS[m.id] || '';
      const abaDisplay = abaAccount
        ? `<span class="aba-account-pill">${abaAccount}</span>`
        : `<span style="color:var(--text-muted);font-size:12px;">-</span>`;

      // =========== DESKTOP TABLE ROW ===========
      const tr = document.createElement('tr');
      tr.className = m.statusClass + (m.isTied ? ' tr-tied' : '');
      tr.innerHTML = `
        <td class="text-center">
          <div class="rank-num ${rankClass}">${m.rank}</div>
        </td>
        <td>
          <div class="manager-info">
            <span class="manager-name">${m.name}${tiedPill}</span>
            <span class="team-name">${m.teamName}</span>
            ${tiebreakerDetail}
          </div>
        </td>
        <td class="text-center">
          ${abaDisplay}
        </td>
        <td class="text-center">
          <span style="font-weight:700;color:var(--text-secondary);">${m.grossScore}</span>
        </td>
        <td class="text-center">${transferDisplay}</td>
        <td class="text-center">
          <span class="gw-score" data-cur-val="${m.netScore}">${m.netScore}</span>
        </td>
        <td class="text-center">
          <span class="season-pts${m.seasonTotalNet === maxSeasonPts ? ' season-pts-top' : ''}" data-cur-val="${m.seasonTotalNet}">${m.seasonTotalNet}</span>
        </td>
        <td class="text-center">${chipColumnContent}</td>
        <td class="text-center">
          <div class="form-pill-container">${formHtml}</div>
        </td>
        <td class="text-center">
          <div class="payout-container">
            ${payoutBadge}
            <span class="payout-note">${m.payoutNote}</span>
          </div>
        </td>
      `;
      elements.standingsBody.appendChild(tr);

      const gwScoreEl = tr.querySelector('.gw-score');
      const seasonPtsEl = tr.querySelector('.season-pts');
      if (gwScoreEl) animateNumber(gwScoreEl, m.netScore, 400);
      if (seasonPtsEl) animateNumber(seasonPtsEl, m.seasonTotalNet, 400);

      tr.addEventListener('click', () => openManagerModal(m.id));
      tr.setAttribute('title', `Click to view ${m.name}'s squad details & stats`);

      // =========== #10 MOBILE CARD ===========
      if (elements.mobileCards) {
        const card = document.createElement('div');
        card.className = `mobile-manager-card ${m.statusClass}${m.isTied ? ' tr-tied' : ''}`;
        card.addEventListener('click', () => openManagerModal(m.id));
        card.innerHTML = `
          <div class="mobile-card-top">
            <div class="mobile-card-rank-name">
              <div class="rank-num ${rankClass}">${m.rank}</div>
              <div class="manager-info">
                <span class="manager-name" style="font-size:14px;">${m.name}${tiedPill}</span>
                <span class="team-name">${m.teamName}</span>
              </div>
            </div>
            ${payoutBadge}
          </div>
          <div class="mobile-card-stats">
            ${abaAccount ? `
            <div class="mobile-stat-item">
              <span class="mobile-stat-label">ABA</span>
              <span class="mobile-stat-value" style="font-size:11px;font-weight:700;letter-spacing:0.3px;">${abaAccount}</span>
            </div>` : ''}
            <div class="mobile-stat-item">
              <span class="mobile-stat-label">Net Pts</span>
              <span class="mobile-stat-value" style="color:var(--pl-green);">${m.netScore}</span>
            </div>
              <span class="mobile-stat-value" style="color:var(--pl-green);">${m.netScore}</span>
            </div>
            <div class="mobile-stat-item">
              <span class="mobile-stat-label">Transfers</span>
              <span class="mobile-stat-value">${m.transfers}${m.hitCost > 0 ? ` <span class="hit-tag has-hit">(-${m.hitCost})</span>` : ''}</span>
            </div>
            <div class="mobile-stat-item">
              <span class="mobile-stat-label">Season</span>
              <span class="mobile-stat-value" style="color:var(--pl-cyan);">${m.seasonTotalNet}</span>
            </div>
            <div class="mobile-stat-item">
              <span class="mobile-stat-label">Gross</span>
              <span class="mobile-stat-value">${m.grossScore}</span>
            </div>
            <div class="mobile-stat-item">
              <span class="mobile-stat-label">Chip</span>
              <span class="mobile-stat-value" style="font-size:11px;">${m.chip ? getChipLabel(m.chip) : '—'}</span>
            </div>
          </div>
          <div class="mobile-card-bottom">
            <div class="form-pill-container">${formHtml}</div>
            <span class="payout-note">${m.payoutNote}</span>
          </div>
        `;
        elements.mobileCards.appendChild(card);
      }
    });
  }

  // ===================== WIN/LOSS TABLE =====================
  function getManagerSeasonSummary() {
    const managers = state.dataset.managers || [];
    const chipTypes = (state.dataset.chipTypes && state.dataset.chipTypes.length > 0)
      ? state.dataset.chipTypes
      : [
          "Wildcard 1", "Wildcard 2",
          "Free Hit 1", "Free Hit 2",
          "Bench Boost 1", "Bench Boost 2",
          "Triple Captain 1", "Triple Captain 2"
        ];

    const summary = managers.map(m => {
      let wins = 0, losses = 0, neutrals = 0, netEarnings = 0, totalNetPoints = 0;
      const chipsUsedMap = {};

      for (let gw = 1; gw <= state.currentGw; gw++) {
        const standings = getGameweekStandings(gw);
        const item = standings.find(x => x.id === m.id);
        if (item) {
          totalNetPoints += item.netScore;
          if (item.payout > 0) { wins++; netEarnings += item.payout; }
          else if (item.payout < 0) { losses++; netEarnings += item.payout; }
          else { neutrals++; }
        }
      }

      // Check all 38 gameweek slots for recorded chip usage
      if (state.dataset.gameweeks && Array.isArray(state.dataset.gameweeks)) {
        state.dataset.gameweeks.forEach(gwObj => {
          if (gwObj && gwObj.chipsUsed && gwObj.chipsUsed[m.id]) {
            const raw = String(gwObj.chipsUsed[m.id]).toLowerCase();
            const gNum = gwObj.gw;
            if (raw.includes('wildcard') || raw.includes('wc')) {
              if (gNum <= 19) chipsUsedMap['Wildcard 1'] = gNum;
              else chipsUsedMap['Wildcard 2'] = gNum;
              chipsUsedMap['Wildcard'] = gNum;
            } else if (raw.includes('freehit') || raw.includes('free hit') || raw.includes('fh')) {
              if (gNum <= 19) chipsUsedMap['Free Hit 1'] = gNum;
              else chipsUsedMap['Free Hit 2'] = gNum;
              chipsUsedMap['Free Hit'] = gNum;
            } else if (raw.includes('bboost') || raw.includes('bench boost') || raw.includes('bb')) {
              if (gNum <= 19) chipsUsedMap['Bench Boost 1'] = gNum;
              else chipsUsedMap['Bench Boost 2'] = gNum;
              chipsUsedMap['Bench Boost'] = gNum;
            } else if (raw.includes('3xc') || raw.includes('triple captain') || raw.includes('tc')) {
              if (gNum <= 19) chipsUsedMap['Triple Captain 1'] = gNum;
              else chipsUsedMap['Triple Captain 2'] = gNum;
              chipsUsedMap['Triple Captain'] = gNum;
            } else {
              chipsUsedMap[gwObj.chipsUsed[m.id]] = gNum;
            }
          }
        });
      }

      const winRate = state.currentGw > 0 ? ((wins / state.currentGw) * 100).toFixed(1) : '0.0';
      const chipsStatus = chipTypes.map(c => ({
        chipName: c,
        used: !!chipsUsedMap[c],
        usedGw: chipsUsedMap[c] || null,
        colorClass: getChipColorClass(c)
      }));

      return { ...m, wins, losses, neutrals, winRate, netEarnings, totalNetPoints, chipsStatus };
    });

    return summary.sort((a, b) => b.netEarnings - a.netEarnings || b.wins - a.wins || b.totalNetPoints - a.totalNetPoints);
  }

  // ===================== 38-GAMEWEEK FORM MATRIX =====================
  function renderSeasonMatrixTable() {
    const container = elements.seasonMatrixContainer || document.getElementById('seasonMatrixContainer');
    if (!container) return;

    if (elements.matrixLegendCurrent) {
      elements.matrixLegendCurrent.textContent = `GW${state.currentGw}`;
    }

    const summary = getManagerSeasonSummary();
    if (!summary || summary.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);">No season form data available.</div>';
      return;
    }

    // Precalculate standings for all played gameweeks up to currentGw
    const gwStandingsMap = {};
    for (let gw = 1; gw <= state.currentGw; gw++) {
      gwStandingsMap[gw] = getGameweekStandings(gw);
    }

    // Build Table Header (GW1 to GW38)
    let theadGwCols = '';
    for (let gw = 1; gw <= 38; gw++) {
      const isCurrent = (gw === state.currentGw);
      const isPast = (gw < state.currentGw);
      const headerClass = isCurrent ? 'matrix-th-current' : (isPast ? 'matrix-th-past' : 'matrix-th-future');
      theadGwCols += `<th class="matrix-gw-th ${headerClass}">GW${gw}</th>`;
    }

    let tbodyRows = '';
    summary.forEach((m, idx) => {
      const pos = idx + 1;
      let rankClass = 'rank-neutral';
      if (pos === 1) rankClass = 'rank-1';
      else if (pos === 2) rankClass = 'rank-2';
      else if (pos === 3) rankClass = 'rank-3';

      let gwCells = '';
      for (let gw = 1; gw <= 38; gw++) {
        const isCurrent = (gw === state.currentGw);
        const isPast = (gw <= state.currentGw);
        const cellClass = isCurrent ? 'matrix-td-current' : '';

        if (isPast) {
          const standings = gwStandingsMap[gw] || [];
          const item = standings.find(x => x.id === m.id);
          if (item && item.netScore !== undefined) {
            let pillClass = 'form-n';

            if (item.payout > 0) {
              pillClass = 'form-w';
            } else if (item.payout < 0) {
              pillClass = 'form-l';
            }

            gwCells += `
              <td class="matrix-gw-td ${cellClass}">
                <span class="matrix-score-tile ${pillClass}">${item.netScore}</span>
              </td>
            `;
          } else {
            gwCells += `<td class="matrix-gw-td ${cellClass}"><span class="matrix-score-future">-</span></td>`;
          }
        } else {
          gwCells += `
            <td class="matrix-gw-td matrix-td-future">
              <span class="matrix-score-future">-</span>
            </td>
          `;
        }
      }

      tbodyRows += `
        <tr class="matrix-row" onclick="openManagerModal(${m.id})">
          <td class="sticky-col-pos text-center"><div class="rank-num ${rankClass}">${pos}</div></td>
          <td class="sticky-col-manager">
            <div class="manager-info">
              <span class="manager-name">${m.name}</span>
              <span class="team-name">${m.teamName}</span>
            </div>
          </td>
          ${gwCells}
        </tr>
      `;
    });

    container.innerHTML = `
      <table class="custom-table matrix-table">
        <thead>
          <tr>
            <th class="sticky-col-pos text-center" style="width:48px;">Pos</th>
            <th class="sticky-col-manager" style="min-width:185px;">Manager & Team</th>
            ${theadGwCols}
          </tr>
        </thead>
        <tbody>
          ${tbodyRows}
        </tbody>
      </table>
    `;
  }

  function renderWinLossSummaryTable() {
    const summary = getManagerSeasonSummary();
    if (!elements.winLossTableContainer) return;

    let html = `
      <table class="custom-table">
        <thead>
          <tr>
            <th class="text-center" style="width:50px;">Pos</th>
            <th>Manager & Team</th>
            <th class="text-center">Wins</th>
            <th class="text-center">Losses</th>
            <th class="text-center">Neutrals</th>
            <th class="text-center">Win Rate</th>
            <th class="text-center">Total Net Pts</th>
            <th class="text-right">Net Payout</th>
          </tr>
        </thead>
        <tbody>
    `;

    const maxPts = Math.max(...summary.map(s => s.totalNetPoints));

    summary.forEach((m, idx) => {
      const pos = idx + 1;
      let rankClass = 'rank-neutral';
      if (pos === 1) rankClass = 'rank-1';
      else if (pos === 2) rankClass = 'rank-2';
      else if (pos === 3) rankClass = 'rank-3';

      let earnClass = 'payout-neutral', earnText = '$0.00';
      if (m.netEarnings > 0) { earnClass = 'payout-win'; earnText = `+$${m.netEarnings}.00`; }
      else if (m.netEarnings < 0) { earnClass = 'payout-loss'; earnText = `-$${Math.abs(m.netEarnings)}.00`; }

      const isTopPts = m.totalNetPoints === maxPts;
      const ptsStyle = isTopPts ? 'class="season-pts-top"' : 'style="font-weight:700;color:var(--text-secondary);"';

      html += `
        <tr>
          <td class="text-center"><div class="rank-num ${rankClass}">${pos}</div></td>
          <td>
            <div class="manager-info">
              <span class="manager-name">${m.name}</span>
              <span class="team-name">${m.teamName}</span>
            </div>
          </td>
          <td class="text-center"><span class="stat-pill win">${m.wins} W</span></td>
          <td class="text-center"><span class="stat-pill loss">${m.losses} L</span></td>
          <td class="text-center"><span class="stat-pill neu">${m.neutrals} N</span></td>
          <td class="text-center"><span style="font-weight:700;font-family:'Outfit',sans-serif;">${m.winRate}%</span></td>
          <td class="text-center"><span ${ptsStyle}>${m.totalNetPoints}</span></td>
          <td class="text-right"><span class="payout-badge ${earnClass}">${earnText}</span></td>
        </tr>
      `;
    });

    html += '</tbody></table>';
    elements.winLossTableContainer.innerHTML = html;
  }

  // ===================== CHIP TRACKER =====================
  function renderChipTracker() {
    const managerData = getManagerSeasonSummary();
    elements.chipTrackerContainer.innerHTML = '';

    managerData.forEach(m => {
      const card = document.createElement('div');
      card.className = 'chip-card';

      const chipListHtml = m.chipsStatus.map(c => {
        const shortLabel = getChipLabel(c.chipName);
        if (c.used) {
           return `
             <div class="chip-pill-compact used ${c.colorClass}">
               <span class="cp-name">${shortLabel}</span>
               <span class="cp-gw">GW${c.usedGw}</span>
             </div>`;
        } else {
           return `
             <div class="chip-pill-compact available">
               <span class="cp-name">${shortLabel}</span>
             </div>`;
        }
      }).join('');

      card.innerHTML = `
        <div class="chip-card-header">
          <div>
            <div class="manager-name">${m.name}</div>
            <div class="team-name">${m.teamName}</div>
          </div>
        </div>
        <div class="chip-pills-row">${chipListHtml}</div>
      `;

      elements.chipTrackerContainer.appendChild(card);
    });
  }

  function populateStatusGwDropdown(activeGw) {
    const select = document.getElementById('statusGwSelect');
    const prevBtn = document.getElementById('statusPrevGwBtn');
    const nextBtn = document.getElementById('statusNextGwBtn');
    if (!select) return;
    let html = '';
    for (let gw = 1; gw <= 38; gw++) {
      const isCurrentMark = (gw === (state.currentGw || 1)) ? ' (Current)' : '';
      const selected = (gw === activeGw) ? 'selected' : '';
      html += `<option value="${gw}" ${selected}>Gameweek ${gw}${isCurrentMark}</option>`;
    }
    select.innerHTML = html;
    if (prevBtn) prevBtn.disabled = activeGw <= 1;
    if (nextBtn) nextBtn.disabled = activeGw >= 38;
  }

  window.selectStatusGw = function(val) {
    state.statusGw = parseInt(val, 10) || 1;
    renderGwStatus();
  };

  window.jumpToCurrentStatusGw = function() {
    state.statusGw = state.currentGw || 1;
    renderGwStatus();
  };

  window.changeStatusGw = function(delta) {
    const current = state.statusGw || state.currentGw || 1;
    const nextGw = Math.max(1, Math.min(38, current + delta));
    state.statusGw = nextGw;
    renderGwStatus();
  };

  function renderGwStatus() {
    const spotlightContainer = document.getElementById('gwSpotlightContainer');
    if (!spotlightContainer) return;

    const gw = state.currentGw || 1;
    let statusObj = state.eventStatuses[gw];

    const inputVal = (state.leagueIdInput ? state.leagueIdInput.value.trim().toLowerCase() : '');
    const isDemoMode = inputVal === 'demo' || state.isDemoMode === true;
    const isRealLeague = !isDemoMode;

    const activeManagers = state.dataset.managers || [];
    const currentGwData = state.dataset.gameweeks ? state.dataset.gameweeks.find(g => g.gw === gw) : null;
    const hasLiveScores = activeManagers.length > 0 && currentGwData && activeManagers.some(m => (currentGwData.scores[m.id] || 0) > 0);

    if (!statusObj) {
      statusObj = {
        gw: gw,
        finished: isDemoMode,
        data_checked: isDemoMode,
        bonus_added: isDemoMode,
        leagues: isDemoMode ? 'Updated' : (hasLiveScores ? 'Updated' : 'Pending'),
        daily_status: [],
        is_current: hasLiveScores || isDemoMode || gw === 1
      };
    } else {
      if (statusObj.is_current === undefined) statusObj.is_current = (gw === state.currentGw || hasLiveScores);
      if (hasLiveScores && !statusObj.leagues) statusObj.leagues = 'Updated';
    }

    // Determine daily_status for current/past/future GWs
    let dailyStatus = (statusObj && statusObj.daily_status && statusObj.daily_status.length > 0)
      ? statusObj.daily_status
      : null;

    if (!dailyStatus || dailyStatus.length === 0) {
      if (isDemoMode) {
        dailyStatus = [
          { date: '2026-08-22', points: 'r', bonus_added: true },
          { date: '2026-08-23', points: 'r', bonus_added: true }
        ];
      } else if (gw === 1) {
        // GW1 Live matchday tracking:
        // Friday: Finished & Bonus Added
        // Saturday: Match points updated, Bonus processing live
        // Sunday: Pending
        const isFinished = Boolean(statusObj.finished && statusObj.data_checked);
        dailyStatus = [
          { date: '2026-08-21', points: 'r', bonus_added: true },
          { date: '2026-08-22', points: 'r', bonus_added: isFinished },
          { date: '2026-08-23', points: isFinished ? 'r' : 'p', bonus_added: isFinished }
        ];
      } else {
        const isFinished = Boolean(statusObj.finished && statusObj.data_checked);
        let gwStart = new Date(2026, 7, 21);
        if (statusObj.deadline_time) gwStart = new Date(statusObj.deadline_time);
        else gwStart = new Date(gwStart.getTime() + (gw - 1) * 7 * 86400000);

        const d1 = new Date(gwStart.getTime() + 1 * 86400000).toISOString().split('T')[0];
        const d2 = new Date(gwStart.getTime() + 2 * 86400000).toISOString().split('T')[0];
        dailyStatus = [
          { date: d1, points: isFinished ? 'r' : 'p', bonus_added: isFinished },
          { date: d2, points: isFinished ? 'r' : 'p', bonus_added: isFinished }
        ];
      }
    }

    // Determine overall status label
    let overallStatusLabel = 'Upcoming';
    let overallStatusClass = 'pipe-badge-muted';

    if (isDemoMode || (statusObj.finished && statusObj.data_checked)) {
      overallStatusLabel = 'Finalized';
      overallStatusClass = 'pipe-badge-success';
    } else if (statusObj.is_current || hasLiveScores || (dailyStatus && dailyStatus.some(d => d.points === 'r'))) {
      overallStatusLabel = 'In Progress';
      overallStatusClass = 'pipe-badge-live';
    } else if (statusObj.finished) {
      overallStatusLabel = 'Updating';
      overallStatusClass = 'pipe-badge-live';
    }

    // Normalize dailyStatus based on UTC matchday dates: Friday & Saturday done, Sunday & Monday upcoming
    const todayIso = new Date().toISOString().split('T')[0]; // '2026-08-23'
    const isFinished = Boolean(statusObj.finished && statusObj.data_checked);

    const normalizedDailyStatus = dailyStatus.map(day => {
      const dateStr = day.date;
      if (isDemoMode || isFinished || dateStr < todayIso) {
        return { ...day, points: 'r', bonus_added: true };
      } else {
        return { ...day, points: 'p', bonus_added: false };
      }
    });

    // ── Compute progress bar ──────────────────────────────
    const doneDays    = normalizedDailyStatus.filter(d => d.points === 'r' && d.bonus_added).length;
    const activeDays  = normalizedDailyStatus.filter(d => d.points === 'r' && !d.bonus_added).length;
    const totalDays   = normalizedDailyStatus.length;
    const progressPct = totalDays > 0 ? Math.round((doneDays / totalDays) * 100) : 0;
    const progressLabel = `${doneDays} of ${totalDays} day${totalDays !== 1 ? 's' : ''} finalized`;

    // ── Helpers ───────────────────────────────────────────
    const CHECK  = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" style="margin-right:4px;vertical-align:middle"><path d="M1.5 5L3.8 7.5L8.5 2.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    const SPIN   = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" style="margin-right:4px;vertical-align:middle"><path d="M5 1A4 4 0 1 1 1 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
    const CLOCK  = `<span style="margin-right:4px;font-size:9px;vertical-align:middle">○</span>`;

    const makeTag = (type, label) => {
      const icon = type === 'done' ? CHECK : (type === 'active' ? SPIN : CLOCK);
      return `<span class="day-tag tag-${type}">${icon}${label}</span>`;
    };

    // ── Build rows matching official matchday calendar ──────────────
    const FIXTURES_MAP = {
      '2026-08-21': '1 Match (FT)',
      '2026-08-22': '6 Matches (FT)',
      '2026-08-23': '3 Matches',
      '2026-08-24': '1 Match'
    };

    const tableRows = normalizedDailyStatus.map((day, idx, arr) => {
      const [y, m, d] = day.date.split('-').map(Number);
      const dateObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
      const weekday = dateObj.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
      const dateFmt = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

      const ptsType   = day.points === 'r' ? 'done' : 'pending';
      const bonusType = day.bonus_added ? 'done' : (day.points === 'r' ? 'active' : 'pending');

      const leaguesDone = day.points === 'r' && day.bonus_added;
      const isLastProcessedDay = day.bonus_added && (idx === arr.length - 1 || !arr[idx+1].bonus_added);
      const leaguesUpdating = isLastProcessedDay && (statusObj.leagues || '').toLowerCase() === 'updating';
      const leaguesType = leaguesDone ? (leaguesUpdating ? 'active' : 'done') : (day.points === 'r' && day.bonus_added ? 'done' : 'pending');
      const leaguesLabel = leaguesDone ? (leaguesUpdating ? 'Updating…' : 'Updated') : 'Pending';
      const leaguesTagType = leaguesUpdating ? 'active' : leaguesType;

      // Row state: done / active / pending
      const isDone    = day.points === 'r' && day.bonus_added && !leaguesUpdating;
      const isActive  = !isDone && (day.points === 'r' || day.bonus_added || leaguesUpdating);
      const rowClass  = isDone ? 'row-done' : (isActive ? 'row-active' : 'row-pending');

      // Day Status Badge
      let dayStatusBadge = '';
      if (isFinished) {
        dayStatusBadge = `<span class="fpl-status-badge fpl-badge-final">FINAL</span>`;
      } else if (isDone) {
        dayStatusBadge = `<span class="fpl-status-badge fpl-badge-provisional">PROVISIONAL</span>`;
      } else if (isActive) {
        dayStatusBadge = `<span class="fpl-status-badge fpl-badge-in-progress">IN PROGRESS</span>`;
      } else {
        dayStatusBadge = `<span class="fpl-status-badge fpl-badge-upcoming">NOT STARTED</span>`;
      }

      const fixturesLabel = FIXTURES_MAP[day.date] || 'Matches';

      return `
        <tr class="daily-row ${rowClass}">
          <td class="daily-td-date">
            <span class="date-weekday">${weekday}</span>
            <span class="date-short">${dateFmt}</span>
          </td>
          <td>${dayStatusBadge}</td>
          <td><span class="fixtures-count-badge">${fixturesLabel}</span></td>
          <td>${makeTag(ptsType, ptsType === 'done' ? 'Updated' : 'Pending')}</td>
          <td>${makeTag(bonusType, bonusType === 'done' ? 'Added' : (bonusType === 'active' ? 'Processing' : 'Pending'))}</td>
          <td>${makeTag(leaguesTagType, leaguesLabel)}</td>
        </tr>
      `;
    }).join('');

    // ── Last-synced timestamp ─────────────────────────────
    const now = new Date();
    const syncTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const syncDate = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

    const tableHtml = `
      <div class="tracker-progress-bar-wrap">
        <div class="tracker-progress-bar-track">
          <div class="tracker-progress-bar-fill" style="width:${progressPct}%"></div>
        </div>
        <span class="tracker-progress-label">${progressLabel}</span>
      </div>
      <div class="premium-table-container">
        <table class="daily-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Day Status</th>
              <th>Fixtures</th>
              <th>Match Points</th>
              <th>Bonus Points</th>
              <th>League Standings</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>
      <div class="tracker-footer">
        <span class="tracker-sync-label">Last synced: ${syncDate}, ${syncTime}</span>
      </div>
    `;

    spotlightContainer.innerHTML = `
      <div class="pipe-card-premium">
        <div class="pipe-card-top">
          <div class="pipe-card-title-area">
            <div class="pipe-card-gw">Gameweek ${gw}</div>
            <div class="pipe-card-subtitle">Daily Processing Tracker</div>
          </div>
          <div class="pipe-card-right">
            <span class="pipe-badge ${overallStatusClass}">${overallStatusLabel}</span>
          </div>
        </div>
        ${tableHtml}
      </div>
    `;

  }

  // ===================== CHART =====================
  const CHART_COLORS = ['#00ff87', '#04f5ff', '#eab308', '#ff2882', '#a855f7', '#38bdf8', '#64748b'];

  function buildDatasets() {
    return state.dataset.managers.map((m, idx) => {
      const rankHistory = [];
      for (let gw = 1; gw <= state.maxGw; gw++) {
        const standings = getGameweekStandings(gw);
        const item = standings.find(x => x.id === m.id);
        rankHistory.push(item ? item.rank : null);
      }
      const color = CHART_COLORS[idx % CHART_COLORS.length];
      return {
        label: m.name,
        data: rankHistory,
        borderColor: color,
        backgroundColor: color,
        tension: 0,
        borderWidth: 2.5,
        pointRadius: 4,
        pointHoverRadius: 7,
        pointBorderWidth: 2,
        pointBackgroundColor: color
      };
    });
  }

  function getChartTextColor() { return state.theme === 'light' ? '#475569' : '#94a3b8'; }
  function getChartGridColor() { return state.theme === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'; }

  function initChart() {
    const ctx = document.getElementById('rankChart');
    if (!ctx) return;
    const labels = Array.from({ length: state.maxGw }, (_, i) => `GW${i + 1}`);
    state.chartInstance = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: buildDatasets() },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            reverse: true,
            min: 1,
            max: state.dataset.managers.length,
            ticks: { stepSize: 1, color: getChartTextColor(), font: { weight: '600' } },
            grid: { color: getChartGridColor() }
          },
          x: {
            ticks: { color: getChartTextColor(), font: { weight: '600' } },
            grid: { color: getChartGridColor() }
          }
        },
        plugins: {
          legend: {
            labels: { color: getChartTextColor(), font: { family: 'Plus Jakarta Sans', weight: '700' } }
          }
        }
      }
    });
  }

  function updateChartTheme() {
    if (!state.chartInstance) return;
    state.chartInstance.options.scales.y.ticks.color = getChartTextColor();
    state.chartInstance.options.scales.y.grid.color = getChartGridColor();
    state.chartInstance.options.scales.x.ticks.color = getChartTextColor();
    state.chartInstance.options.scales.x.grid.color = getChartGridColor();
    state.chartInstance.options.plugins.legend.labels.color = getChartTextColor();
    state.chartInstance.update();
  }

  function updateChart() {
    if (!state.chartInstance) return;
    state.chartInstance.data.datasets = buildDatasets();
    state.chartInstance.options.scales.y.max = state.dataset.managers.length;
    updateChartTheme();
  }

  // ===================== PERFORMANCE CHART =====================
  function initPerformanceChart() {
    const ctx = document.getElementById('performanceChart');
    if (!ctx) return;
    
    const summary = getManagerSeasonSummary();
    const labels = summary.map(s => s.name);
    
    state.perfChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Wins',
            data: summary.map(s => s.wins),
            backgroundColor: 'rgba(16, 185, 129, 0.7)',
            borderColor: '#10b981',
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: 'Losses',
            data: summary.map(s => s.losses),
            backgroundColor: 'rgba(239, 68, 68, 0.7)',
            borderColor: '#ef4444',
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: 'Neutrals',
            data: summary.map(s => s.neutrals),
            backgroundColor: 'rgba(148, 163, 184, 0.7)',
            borderColor: '#94a3b8',
            borderWidth: 1,
            borderRadius: 4
          }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            stacked: true,
            beginAtZero: true,
            ticks: { color: getChartTextColor(), font: { weight: '600' }, stepSize: 1 },
            grid: { color: getChartGridColor() }
          },
          y: {
            stacked: true,
            ticks: { color: getChartTextColor(), font: { weight: '600' } },
            grid: { display: false }
          }
        },
        plugins: {
          legend: { 
            display: true,
            labels: { color: getChartTextColor(), font: { family: 'Plus Jakarta Sans', weight: '700' } }
          }
        }
      }
    });
  }

  function updatePerformanceChartTheme() {
    if (!state.perfChartInstance) return;
    state.perfChartInstance.options.scales.y.ticks.color = getChartTextColor();
    state.perfChartInstance.options.scales.y.grid.color = getChartGridColor();
    state.perfChartInstance.options.scales.x.ticks.color = getChartTextColor();
    if (state.perfChartInstance.options.plugins.legend) {
      state.perfChartInstance.options.plugins.legend.labels.color = getChartTextColor();
    }
    state.perfChartInstance.update();
  }

  function updatePerformanceChart() {
    if (!state.perfChartInstance) return;
    const summary = getManagerSeasonSummary();
    
    state.perfChartInstance.data.labels = summary.map(s => s.name);
    state.perfChartInstance.data.datasets[0].data = summary.map(s => s.wins);
    state.perfChartInstance.data.datasets[1].data = summary.map(s => s.losses);
    state.perfChartInstance.data.datasets[2].data = summary.map(s => s.neutrals);
    
    updatePerformanceChartTheme();
  }

  // ===================== CLASSIC GOOGLE SHEETS VIEW =====================
  function renderClassicSheetView() {
    const tableEl = document.getElementById('classicSheetTable');
    const titleEl = document.getElementById('classicSheetLeagueTitle');
    const selectEl = document.getElementById('classicSheetMonthSelect');
    if (!tableEl) return;

    if (titleEl) {
      const rawLeague = state.dataset.leagueName || "Clash of Elite";
      const cleanLeague = rawLeague.replace(/\s*(fantasy\s*league|20\d\d[-–]20\d\d|\d\d\/\d\d)\s*/gi, ' ').trim();
      titleEl.textContent = `${cleanLeague} Fantasy League 2026-2027`;
    }

    const bannerEl = document.getElementById('classicSheetBanner');
    if (bannerEl) {
      bannerEl.style.backgroundColor = state.classicSheetBannerBg || '#73679f';
      bannerEl.style.color = state.classicSheetBannerText || '#ffffff';
    }

    const months = state.dataset.months || [];
    const currentGw = state.currentGw || 1;

    // Populate month / view select dropdown if empty
    if (selectEl && selectEl.options.length === 0) {
      const optRecent = document.createElement('option');
      optRecent.value = 'recent';
      optRecent.textContent = 'Recent 5 Gameweeks';
      selectEl.appendChild(optRecent);

      const optAll = document.createElement('option');
      optAll.value = 'all';
      optAll.textContent = 'All 38 Gameweeks (Full Season)';
      selectEl.appendChild(optAll);

      months.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.name;
        opt.textContent = `${m.name} (GW${Math.min(...m.gws)}-${Math.max(...m.gws)})`;
        selectEl.appendChild(opt);
      });

      // Default by user request: Recent 5 Gameweeks
      selectEl.value = 'recent';

      selectEl.addEventListener('change', () => {
        renderClassicSheetView();
      });
    }

    const selectedVal = selectEl ? selectEl.value : 'recent';
    let gwsToDisplay = [];
    let selectedMonthObj = null;

    if (selectedVal === 'all') {
      for (let g = 1; g <= 38; g++) {
        gwsToDisplay.push(g);
      }
    } else if (selectedVal === 'recent') {
      const startGw = Math.max(1, currentGw - 4);
      for (let g = startGw; g <= currentGw; g++) {
        gwsToDisplay.push(g);
      }
    } else {
      selectedMonthObj = months.find(m => m.name === selectedVal);
      if (selectedMonthObj) {
        const maxMonthGw = Math.max(...selectedMonthObj.gws);
        if (currentGw < maxMonthGw) {
          gwsToDisplay = selectedMonthObj.gws.filter(g => g <= currentGw);
          if (gwsToDisplay.length === 0) gwsToDisplay = [selectedMonthObj.gws[0]];
        } else {
          gwsToDisplay = [...selectedMonthObj.gws];
        }
      } else {
        gwsToDisplay = [currentGw];
      }
    }

    const currentStandings = getGameweekStandings(currentGw);
    const totalManagers = currentStandings.length;
    const splitSize = Math.floor(totalManagers / 2);
    const hasNeutral = totalManagers % 2 === 1;
    const neutralRank = hasNeutral ? splitSize + 1 : null;

    const showMots = Boolean(state.showMotsBadge);
    const showMotm = Boolean(state.showMotmBadge);

    const sdChipSelect = document.getElementById('classicSheetSdChipSelect');
    const sdChipMode = sdChipSelect ? sdChipSelect.value : (state.classicSheetSdChipMode || 'current');
    state.classicSheetSdChipMode = sdChipMode;

    const activeLatestGw = gwsToDisplay.filter(g => g <= currentGw).pop() || currentGw;

    function shouldShowSdChipForGw(g) {
      if (sdChipMode === 'all') return true;
      if (sdChipMode === 'current' && g === activeLatestGw) return true;
      return false;
    }

    function getChipCode(chipRaw) {
      if (!chipRaw) return '';
      const cn = String(chipRaw).toLowerCase();
      if (cn.includes('wildcard') || cn.includes('wc')) return 'WC';
      if (cn.includes('free hit') || cn.includes('freehit') || cn.includes('fh')) return 'FH';
      if (cn.includes('bench boost') || cn.includes('bboost') || cn.includes('bb')) return 'BB';
      if (cn.includes('triple captain') || cn.includes('3xc') || cn.includes('tc')) return 'TC';
      return String(chipRaw).toUpperCase();
    }

    // Calculate MOTS (Manager of the Season)
    let seasonLeader = null;
    if (showMots && currentStandings.length > 0) {
      const seasonList = [...currentStandings].sort((a, b) => b.seasonTotalNet - a.seasonTotalNet);
      seasonLeader = seasonList[0];
    }

    // Table Header
    let theadColsHtml = '';
    gwsToDisplay.forEach(g => {
      theadColsHtml += `<th class="cs-col-gw">GW${g}</th>`;
      if (shouldShowSdChipForGw(g)) {
        theadColsHtml += `<th class="cs-col-sd cs-th-sd">S.D.</th><th class="cs-col-chip cs-th-chip">Chip</th>`;
      }
    });

    let theadHtml = `
      <thead>
        <tr>
          <th class="cs-col-rank">Rank</th>
          <th class="cs-col-manager">Manager</th>
          <th class="cs-col-team">Team</th>
          <th class="cs-col-aba">ABA</th>
          ${theadColsHtml}
          <th class="cs-col-payment">Payment</th>
          ${showMots ? `<th class="cs-col-seasonal">Seasonal prize</th>` : ''}
        </tr>
      </thead>
    `;

    // Table Body
    let tbodyHtml = '<tbody>';

    currentStandings.forEach((m, idx) => {
      const rank = idx + 1;
      let rankBorderClass = 'cs-rank-loss';
      let paymentText = '';

      if (rank <= splitSize) {
        rankBorderClass = 'cs-rank-win';
        const payerRank = totalManagers - rank + 1;
        paymentText = `Get 3$ from ${payerRank}`;
      } else if (hasNeutral && rank === neutralRank) {
        rankBorderClass = 'cs-rank-neutral';
        paymentText = `Neutral (0$)`;
      } else {
        rankBorderClass = 'cs-rank-loss';
        const receiverRank = totalManagers - rank + 1;
        paymentText = `Pay 3$ to ${receiverRank}`;
      }

      const abaNum = ABA_ACCOUNTS[m.id] || '';

      // Build GW score cells & optional SD/Chip per GW
      let gwCellsHtml = '';
      gwsToDisplay.forEach(g => {
        if (g > currentGw) {
          gwCellsHtml += `<td class="cs-col-gw cs-cell-unplayed">-</td>`;
          if (shouldShowSdChipForGw(g)) {
            gwCellsHtml += `<td class="cs-col-sd"></td><td class="cs-col-chip"></td>`;
          }
          return;
        }

        const gStandings = getGameweekStandings(g);
        const gManager = gStandings.find(x => x.id === m.id);
        if (!gManager || (gManager.grossScore === 0 && gManager.hitCost === 0)) {
          gwCellsHtml += `<td class="cs-col-gw cs-cell-unplayed">-</td>`;
          if (shouldShowSdChipForGw(g)) {
            gwCellsHtml += `<td class="cs-col-sd"></td><td class="cs-col-chip"></td>`;
          }
          return;
        }

        const gScore = gManager.netScore !== undefined ? gManager.netScore : gManager.grossScore;
        let cellClass = 'cs-cell-neutral';
        if (gManager.outcomeCode === 'W' || gManager.rank <= splitSize) {
          cellClass = 'cs-cell-win';
        } else if (gManager.outcomeCode === 'L' || (hasNeutral ? gManager.rank > neutralRank : gManager.rank > splitSize)) {
          cellClass = 'cs-cell-loss';
        }

        gwCellsHtml += `<td class="cs-col-gw ${cellClass}">${gScore}</td>`;

        if (shouldShowSdChipForGw(g)) {
          const gData = state.dataset.gameweeks.find(x => x.gw === g);
          const hitCost = gData && gData.hits ? (gData.hits[m.id] || 0) : (gManager.hitCost || 0);
          const sdHtml = hitCost > 0
            ? `<td class="cs-col-sd" style="color:#dc2626;font-weight:900;font-size:15px;">-${hitCost}</td>`
            : `<td class="cs-col-sd"></td>`;

          const chipRaw = (gData && gData.chipsUsed && gData.chipsUsed[m.id]) || gManager.chip || '';
          const chipCode = getChipCode(chipRaw);
          const chipHtml = chipCode
            ? `<td class="cs-col-chip" style="color:#f59e0b;font-weight:900;font-size:15px;">${chipCode}</td>`
            : `<td class="cs-col-chip"></td>`;

          gwCellsHtml += `${sdHtml}${chipHtml}`;
        }
      });

      const motsCellHtml = (showMots && idx === 0)
        ? `<td class="cs-col-seasonal" rowspan="${totalManagers}">
            <div class="classic-sheet-mots-content">
              <div>Manager of the Season:</div>
              <div class="classic-sheet-mots-winner">${seasonLeader ? seasonLeader.name : 'Leader'}</div>
            </div>
           </td>`
        : '';

      tbodyHtml += `
        <tr>
          <td class="cs-col-rank ${rankBorderClass}">${rank}</td>
          <td class="cs-col-manager">${m.name}</td>
          <td class="cs-col-team">${m.teamName}</td>
          <td class="cs-col-aba">${abaNum || '-'}</td>
          ${gwCellsHtml}
          <td class="cs-col-payment">${paymentText}</td>
          ${motsCellHtml}
        </tr>
      `;
    });
    tbodyHtml += '</tbody>';

    tableEl.innerHTML = theadHtml + tbodyHtml;

    // Manager of the Month (MoM) Banner centered below table
    const momEl = document.getElementById('classicSheetMoMBanner');
    if (momEl) {
      if (showMotm) {
        let motmName = '';
        const targetMonth = selectedMonthObj || months.find(m => m.gws && m.gws.includes(currentGw)) || months[0];
        if (targetMonth && targetMonth.gws) {
          const motmScores = state.dataset.managers.map(mgr => {
            let pts = 0;
            targetMonth.gws.forEach(g => {
              if (g <= currentGw) {
                const gScore = getManagerLiveScore(mgr.id, g);
                const gData = state.dataset.gameweeks.find(x => x.gw === g);
                const hit = (gData && gData.hits) ? (gData.hits[mgr.id] || 0) : 0;
                pts += (gScore - hit);
              }
            });
            return { name: mgr.name, pts };
          }).sort((a, b) => b.pts - a.pts);

          if (motmScores[0] && motmScores[0].pts > 0) {
            motmName = motmScores[0].name;
          }
        }

        if (motmName) {
          momEl.innerHTML = `<div class="classic-sheet-mom-pill">MoM: ${motmName}</div>`;
        } else {
          momEl.innerHTML = '';
        }
      } else {
        momEl.innerHTML = '';
      }
    }
  }

  // ===================== MANAGER SQUAD DETAIL MODAL =====================
  window.closeManagerModal = function() {
    const modal = document.getElementById('managerDetailModal');
    const backdrop = document.getElementById('managerModalBackdrop');
    const btnPrev = document.getElementById('btnModalPrevManager');
    const btnNext = document.getElementById('btnModalNextManager');

    if (modal) {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
    }
    if (backdrop) backdrop.classList.remove('open');
    if (btnPrev) btnPrev.classList.remove('open');
    if (btnNext) btnNext.classList.remove('open');
    state.activeModalManagerId = null;
    document.body.style.overflow = '';
  };

  window.navigateManagerModal = function(direction) {
    const managers = state.dataset.managers || [];
    if (!managers || managers.length <= 1) return;

    const currentId = state.activeModalManagerId;
    let currentIdx = managers.findIndex(m => m.id === currentId);
    if (currentIdx === -1) currentIdx = 0;

    const targetIdx = (currentIdx + direction + managers.length) % managers.length;
    const targetManager = managers[targetIdx];
    if (targetManager) {
      openManagerModal(targetManager.id);
    }
  };

  window.openManagerModal = function(managerId) {
    const modal = document.getElementById('managerDetailModal');
    const backdrop = document.getElementById('managerModalBackdrop');
    const btnPrev = document.getElementById('btnModalPrevManager');
    const btnNext = document.getElementById('btnModalNextManager');
    const modalAvatar = document.getElementById('modalManagerAvatar');
    const modalName = document.getElementById('modalManagerName');
    const modalTeam = document.getElementById('modalTeamName');
    const modalFplId = document.getElementById('modalFplId');
    const modalGwBadge = document.getElementById('modalGwBadge');
    const modalDirectLink = document.getElementById('modalFplDirectLink');
    const modalBody = document.getElementById('modalContentBody');

    if (!modal || !modalBody) return;

    state.activeModalManagerId = Number(managerId);

    const gw = state.currentGw || 1;
    const manager = (state.dataset.managers || []).find(m => m.id === Number(managerId));
    if (!manager) return;

    // Header info
    if (modalAvatar) modalAvatar.textContent = manager.avatar || manager.name.substring(0, 2).toUpperCase();
    if (modalName) modalName.textContent = manager.name;
    if (modalTeam) modalTeam.textContent = `— ${manager.teamName}`;
    if (modalFplId) modalFplId.textContent = `(#${manager.id})`;
    if (modalGwBadge) modalGwBadge.textContent = `Gameweek ${gw} Squad & Team Details`;
    if (modalDirectLink) modalDirectLink.href = `https://fantasy.premierleague.com/entry/${manager.id}/event/${gw}`;

    modal.classList.add('open');
    if (backdrop) backdrop.classList.add('open');
    if (btnPrev) btnPrev.classList.add('open');
    if (btnNext) btnNext.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    // Retrieve squad picks from memory (state or pre-bundled FPL_LIVE_STATIC)
    const staticData = window.FPL_LIVE_STATIC || {};
    const squadPicksMap = (state.dataset.squadPicks && Object.keys(state.dataset.squadPicks).length > 0) 
      ? state.dataset.squadPicks 
      : (staticData.squadPicks || {});
    const playersMap = (state.dataset.players && Object.keys(state.dataset.players).length > 0)
      ? state.dataset.players
      : (staticData.players || {});
    const transfersHistoryMap = (state.dataset.transfersHistory && Object.keys(state.dataset.transfersHistory).length > 0)
      ? state.dataset.transfersHistory
      : (staticData.transfersHistory || {});

    const mgrPicks = squadPicksMap[String(manager.id)] || squadPicksMap[Number(manager.id)] || (staticData.squadPicks && (staticData.squadPicks[String(manager.id)] || staticData.squadPicks[Number(manager.id)]));
    let squadData = (mgrPicks && (mgrPicks[String(gw)] || mgrPicks[Number(gw)])) || null;

    const posNames = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' };
    const posClasses = { 1: 'pos-gkp', 2: 'pos-def', 3: 'pos-mid', 4: 'pos-fwd' };

    let overallRank = '-';
    let transfersCount = 0;
    let transferHits = '(0 hits)';
    let benchPts = 0;
    let activeChip = 'None';
    let captainName = '-';
    let hist = {};

    let startingRows = '';
    let benchRows = '';
    let startingPtsTotal = 0;
    let playedCount = 0;
    let yetToPlayCount = 0;
    let isBenchBoostActive = false;

    if (squadData && squadData.picks && squadData.picks.length > 0) {
      hist = squadData.entry_history || {};
      if (hist.overall_rank) overallRank = Number(hist.overall_rank).toLocaleString();
      if (hist.event_transfers !== undefined) transfersCount = hist.event_transfers;
      if (hist.event_transfers_cost !== undefined) {
        transferHits = hist.event_transfers_cost > 0 ? `(-${hist.event_transfers_cost} pts)` : '(0 hits)';
      }
      if (hist.points_on_bench !== undefined) benchPts = hist.points_on_bench;
      if (squadData.active_chip) activeChip = getChipLabel(squadData.active_chip);

      isBenchBoostActive = Boolean(
        activeChip && 
        (activeChip.toLowerCase().includes('bboost') || activeChip.toLowerCase().includes('bench boost') || activeChip.toUpperCase().includes('BB'))
      );

      // ===================== AUTO-SUBSTITUTIONS CALCULATION =====================
      function computeAutoSubs(picks, automaticSubs, pMap, isBenchBoost) {
        if (isBenchBoost || !picks || picks.length === 0) return [];

        // 1. Official automatic_subs from FPL API
        if (automaticSubs && automaticSubs.length > 0) {
          return automaticSubs.map(s => ({
            element_in: s.element_in,
            element_out: s.element_out,
            is_official: true
          }));
        }

        // 2. Live predictive auto-subs (starters with DNP substituted by bench in priority order)
        const starters = picks.filter(p => p.position <= 11);
        const bench = picks.filter(p => p.position > 11).sort((a, b) => a.position - b.position);

        const dnpStarters = starters.filter(p => {
          const pl = pMap[p.element];
          return pl && pl.match_status === 'dnp';
        });

        if (dnpStarters.length === 0) return [];

        const computed = [];
        const usedBenchIds = new Set();

        const currentFormation = { 1: 0, 2: 0, 3: 0, 4: 0 };
        starters.forEach(p => {
          const pl = pMap[p.element];
          const type = pl?.element_type || (p.position === 1 ? 1 : 2);
          currentFormation[type] = (currentFormation[type] || 0) + 1;
        });

        // Goalkeeper DNP
        const gkStarter = dnpStarters.find(p => p.position === 1);
        if (gkStarter) {
          const benchGk = bench.find(p => p.position === 12);
          if (benchGk) {
            const plGk = pMap[benchGk.element];
            if (plGk && plGk.match_status !== 'dnp') {
              computed.push({
                element_in: benchGk.element,
                element_out: gkStarter.element,
                is_official: false
              });
              usedBenchIds.add(benchGk.element);
            }
          }
        }

        // Outfield DNPs
        const outfieldDnps = dnpStarters.filter(p => p.position > 1);
        const outfieldBench = bench.filter(p => p.position > 12);

        for (const dnpStarter of outfieldDnps) {
          const pOutInfo = pMap[dnpStarter.element];
          const outType = pOutInfo?.element_type || 2;

          for (const benchPick of outfieldBench) {
            if (usedBenchIds.has(benchPick.element)) continue;

            const pInInfo = pMap[benchPick.element];
            if (!pInInfo || pInInfo.match_status === 'dnp') continue;

            const inType = pInInfo.element_type || 2;
            const testFormation = { ...currentFormation };
            testFormation[outType]--;
            testFormation[inType]++;

            // Valid FPL formation: 1 GK, 3-5 DEF, 2-5 MID, 1-3 FWD
            const isValid = testFormation[1] === 1 &&
                            testFormation[2] >= 3 && testFormation[2] <= 5 &&
                            testFormation[3] >= 2 && testFormation[3] <= 5 &&
                            testFormation[4] >= 1 && testFormation[4] <= 3;

            if (isValid) {
              computed.push({
                element_in: benchPick.element,
                element_out: dnpStarter.element,
                is_official: false
              });
              usedBenchIds.add(benchPick.element);
              currentFormation[outType]--;
              currentFormation[inType]++;
              break;
            }
          }
        }

        return computed;
      }

      const autoSubs = computeAutoSubs(squadData.picks, squadData.automatic_subs, playersMap, isBenchBoostActive);

      // Create display picks with auto-subs moved: Incoming player ➔ Starting XI, Outgoing DNP starter ➔ Bench
      const displayPicks = squadData.picks.map(p => ({ ...p }));
      autoSubs.forEach(s => {
        const outIdx = displayPicks.findIndex(p => p.element === s.element_out);
        const inIdx = displayPicks.findIndex(p => p.element === s.element_in);
        if (outIdx !== -1 && inIdx !== -1) {
          const outPos = displayPicks[outIdx].position;
          const inPos = displayPicks[inIdx].position;
          displayPicks[outIdx].position = inPos;
          displayPicks[inIdx].position = outPos;
          displayPicks[inIdx].was_subbed_in = true;
          displayPicks[outIdx].was_subbed_out = true;
          displayPicks[inIdx].subbed_for_id = s.element_out;
          displayPicks[outIdx].subbed_by_id = s.element_in;
          displayPicks[outIdx].original_bench_role = inPos === 12 ? 'GK' : `Sub ${inPos - 12}`;
        }
      });

      // Sort so Starting XI (1..11) comes first, followed by Bench (12..15)
      displayPicks.sort((a, b) => a.position - b.position);

      displayPicks.forEach(p => {
        const pl = playersMap[p.element] || {
          web_name: `Player #${p.element}`,
          element_type: p.element_type || (p.position === 1 ? 1 : 2),
          team: '-',
          event_points: 0,
          match_status: 'yet_to_play',
          status_label: '⏳ Yet to Play'
        };
        const posName = posNames[pl.element_type] || 'DEF';
        const posClass = posClasses[pl.element_type] || 'pos-def';
        const multiplier = p.multiplier || 1;
        const pts = (pl.event_points || 0) * (p.position <= 11 ? multiplier : 1);

        const isYetToPlay = pl.match_status === 'yet_to_play';

        if (p.is_captain) {
          captainName = `${pl.web_name} (${pts} pts)${isYetToPlay ? ' ⏳' : ''}`;
        }

        let roleTag = '';
        if (p.is_captain) {
          roleTag = `<span class="captain-role-badge">👑 CAPTAIN (${multiplier}x)</span>`;
        } else if (p.is_vice_captain) {
          roleTag = `<span class="vice-role-badge">🛡️ VICE</span>`;
        }

        let statusPill = '';
        if (pl.match_status === 'yet_to_play') {
          statusPill = `<span class="status-pill-yet-to-play">⏳ Yet to Play</span>`;
        } else if (pl.match_status === 'live') {
          statusPill = `<span class="status-pill-live">🟢 Live (${pl.minutes || 0}')</span>`;
        } else if (pl.match_status === 'dnp') {
          statusPill = `<span class="status-pill-dnp">✕ DNP</span>`;
        } else {
          statusPill = `<span class="status-pill-played">✓ Played</span>`;
        }

        let oppBadge = `<span style="color:var(--text-muted);font-size:11px;">-</span>`;
        if (pl.opponent && pl.opponent !== '-') {
          let oppShort = pl.opponent_short || pl.opponent;
          oppShort = String(oppShort).replace(/\s*\([HAha]\)/g, '').trim();
          if (oppShort && oppShort !== '-') {
            const diff = pl.difficulty || 3;
            const diffClass = `fdr-${diff}`;
            oppBadge = `<span class="opp-pill ${diffClass}">${oppShort}</span>`;
          }
        }

        if (p.position <= 11) {
          if (isYetToPlay) {
            yetToPlayCount++;
          } else {
            playedCount++;
          }

          let subInBadge = '';
          let rowClass = '';
          if (p.was_subbed_in) {
            const subOutPl = playersMap[p.subbed_for_id];
            const outName = subOutPl ? subOutPl.web_name : 'Starter';
            subInBadge = `<span class="auto-sub-badge sub-in" title="Auto-subbed into Starting XI for ${outName}">🔄 Subbed In ➔ ${outName}</span>`;
            rowClass = 'tr-subbed-in';
          }

          startingRows += `
            <tr class="${rowClass}">
              <td class="col-pos"><span class="pos-pill ${posClass}">${posName}</span></td>
              <td class="col-player">
                <div class="player-name-cell">
                  <span style="font-weight:700;">${pl.web_name}</span>
                  <span class="player-team-pill">${pl.team}</span>
                </div>
              </td>
              <td class="col-opp">${oppBadge}</td>
              <td class="col-status">${statusPill}</td>
              <td class="col-role">${roleTag} ${subInBadge}</td>
              <td class="col-pts text-center"><span class="player-points-badge" style="${isYetToPlay ? 'color:var(--text-muted);' : (p.was_subbed_in ? 'color:var(--pl-cyan);font-weight:800;' : '')}">${pts} pts</span></td>
            </tr>
          `;
          startingPtsTotal += pts;
        } else {
          if (isBenchBoostActive) {
            if (isYetToPlay) {
              yetToPlayCount++;
            } else {
              playedCount++;
            }
          }

          const subOrder = p.original_bench_role || (p.position === 12 ? 'GK' : `Sub ${p.position - 12}`);
          let benchOrderTag = `<span class="bench-order-badge">🪑 ${subOrder}</span>`;
          let rowClass = '';

          if (p.was_subbed_out) {
            const subInPl = playersMap[p.subbed_by_id];
            const inName = subInPl ? subInPl.web_name : 'Bench';
            benchOrderTag += ` <span class="auto-sub-badge sub-out" title="Auto-subbed out to Bench for ${inName}">🔄 Subbed Out ➔ ${inName}</span>`;
            rowClass = 'tr-subbed-out';
          }

          benchRows += `
            <tr class="${rowClass}">
              <td class="col-pos"><span class="pos-pill ${posClass}">${posName}</span></td>
              <td class="col-player">
                <div class="player-name-cell">
                  <span style="font-weight:700;">${pl.web_name}</span>
                  <span class="player-team-pill">${pl.team}</span>
                </div>
              </td>
              <td class="col-opp">${oppBadge}</td>
              <td class="col-status">${statusPill}</td>
              <td class="col-role">${benchOrderTag}</td>
              <td class="col-pts text-center"><span class="player-points-badge" style="${isYetToPlay ? 'color:var(--text-muted);' : (isBenchBoostActive ? 'color:var(--pl-cyan);font-weight:800;' : 'color:var(--text-muted);')}">${pts} pts</span></td>
            </tr>
          `;
        }
      });
    }

    const maxSquadCount = isBenchBoostActive ? 15 : 11;
    const squadScopeLabel = isBenchBoostActive ? '15 Players (BB Active ⚡)' : '11 Players';

    // ── Build Transfers This GW Section ─────────────────────
    const allTransfers = transfersHistoryMap[String(manager.id)] || [];
    const gwTransfers = allTransfers.filter(t => t.event === gw);
    let transfersHtml = '';

    if (gwTransfers.length > 0) {
      const transferItems = gwTransfers.map(t => {
        const pIn = playersMap[t.element_in] || { web_name: 'Player #' + t.element_in, team: '' };
        const pOut = playersMap[t.element_out] || { web_name: 'Player #' + t.element_out, team: '' };
        const costIn = t.element_in_cost ? `£${(t.element_in_cost / 10).toFixed(1)}M` : '';
        const costOut = t.element_out_cost ? `£${(t.element_out_cost / 10).toFixed(1)}M` : '';

        return `
          <div class="transfer-item-row" style="padding:6px 0;border-bottom:1px dashed var(--border-subtle);">
            <span class="transfer-pill-in">🟢 IN: <strong>${pIn.web_name}</strong> ${costIn ? `(${costIn})` : ''} <span class="player-team-pill">${pIn.team}</span></span>
            <span style="color:var(--text-muted);font-weight:700;margin:0 8px;">⇄</span>
            <span class="transfer-pill-out">🔴 OUT: <strong>${pOut.web_name}</strong> ${costOut ? `(${costOut})` : ''} <span class="player-team-pill">${pOut.team}</span></span>
          </div>
        `;
      }).join('');

      transfersHtml = `
        <div>
          <div class="modal-section-header">
            <span>🔄 Transfers This GW (${gwTransfers.length} transfer${gwTransfers.length > 1 ? 's' : ''}${transferHits !== '(0 hits)' ? ` · ${transferHits}` : ''})</span>
          </div>
          <div class="modal-transfers-box">
            ${transferItems}
          </div>
        </div>
      `;
    } else {
      transfersHtml = `
        <div>
          <div class="modal-section-header">
            <span>🔄 Transfers This GW</span>
          </div>
          <div class="modal-transfers-box" style="color:var(--text-muted);font-style:italic;">
            None (0 transfers made in Gameweek ${gw})
          </div>
        </div>
      `;
    }

    const transferCost = (hist.event_transfers_cost !== undefined) 
      ? hist.event_transfers_cost 
      : ((state.dataset.gameweeks && state.dataset.gameweeks[gw - 1] && state.dataset.gameweeks[gw - 1].hits && state.dataset.gameweeks[gw - 1].hits[manager.id]) || 0);

    const grossPoints = startingPtsTotal + (isBenchBoostActive ? benchPts : 0);
    const netGwPoints = grossPoints - transferCost;

    // ── Build Auto-Substitutions Banner Section ──────────────
    let autoSubBannerHtml = '';
    const squadAutoSubs = (typeof autoSubs !== 'undefined') ? autoSubs : [];
    if (squadAutoSubs.length > 0) {
      const isOfficial = squadAutoSubs[0].is_official;
      const subItems = squadAutoSubs.map(s => {
        const pOut = playersMap[s.element_out] || { web_name: 'Starter' };
        const pIn = playersMap[s.element_in] || { web_name: 'Bench' };
        const inPts = pIn.event_points || 0;
        return `
          <div class="auto-sub-item">
            <span class="auto-sub-pill-out">🔴 OUT: <strong>${pOut.web_name}</strong> (0 pts)</span>
            <span style="color:var(--text-muted);font-weight:800;margin:0 4px;">➔</span>
            <span class="auto-sub-pill-in">🟢 IN: <strong>${pIn.web_name}</strong> (+${inPts} pts)</span>
          </div>
        `;
      }).join('');

      autoSubBannerHtml = `
        <div class="modal-auto-sub-box">
          <div class="auto-sub-box-header">
            <span style="font-size:14px;">🔄</span>
            <span>Automatic Substitution${squadAutoSubs.length > 1 ? 's' : ''}</span>
            <span class="${isOfficial ? 'auto-sub-confirmed-tag' : 'auto-sub-live-tag'}">${isOfficial ? 'CONFIRMED' : 'LIVE PREVIEW'}</span>
          </div>
          <div>
            ${subItems}
          </div>
        </div>
      `;
    }

    modalBody.innerHTML = `
      <!-- Vital Stats Ribbon -->
      <div class="modal-stats-grid">
        <div class="modal-stat-card">
          <span class="stat-label">🎯 GW${gw} Net Points</span>
          <span class="stat-val" style="color:var(--pl-cyan);">${netGwPoints} pts ${transferCost > 0 ? `<span style="font-size:10.5px;color:#f87171;font-weight:700;">(-${transferCost})</span>` : ''}</span>
        </div>
        <div class="modal-stat-card">
          <span class="stat-label">⚽ Played</span>
          <span class="stat-val" style="color:#10b981;">${playedCount} <span style="font-size:11px;color:var(--text-muted);font-weight:600;">/ ${maxSquadCount}</span></span>
        </div>
        <div class="modal-stat-card">
          <span class="stat-label">⏳ Yet to Play</span>
          <span class="stat-val" style="color:#f59e0b;">${yetToPlayCount} <span style="font-size:11px;color:var(--text-muted);font-weight:600;">/ ${maxSquadCount}</span></span>
        </div>
        <div class="modal-stat-card">
          <span class="stat-label">🔄 Transfers</span>
          <span class="stat-val">${transfersCount} <span style="font-size:11px;font-weight:600;color:var(--text-muted);">${transferHits}</span></span>
        </div>
        <div class="modal-stat-card">
          <span class="stat-label">⚡ Active Chip</span>
          <span class="stat-val" style="color:${activeChip !== 'None' ? '#a855f7' : 'var(--text-primary)'};">${activeChip}</span>
        </div>
        <div class="modal-stat-card">
          <span class="stat-label">👑 Captain</span>
          <span class="stat-val" style="color:#facc15;">${captainName}</span>
        </div>
      </div>

      ${autoSubBannerHtml}

      <!-- Starting XI Table -->
      <div>
        <div class="modal-section-header">
          <span>⚽ Starting XI (${startingPtsTotal} pts)</span>
          <span style="font-size:11px;font-weight:600;color:var(--text-muted);">${squadScopeLabel} (${playedCount} Played · ${yetToPlayCount} Remaining)</span>
        </div>
        <table class="modal-squad-table">
          <colgroup>
            <col class="col-pos" style="width: 7%;">
            <col class="col-player" style="width: 28%;">
            <col class="col-opp" style="width: 15%;">
            <col class="col-status" style="width: 18%;">
            <col class="col-role" style="width: 20%;">
            <col class="col-pts" style="width: 12%;">
          </colgroup>
          <thead>
            <tr>
              <th class="col-pos">Pos</th>
              <th class="col-player">Player</th>
              <th class="col-opp">Opponent</th>
              <th class="col-status">Status</th>
              <th class="col-role">Role</th>
              <th class="col-pts text-center">Points</th>
            </tr>
          </thead>
          <tbody>
            ${startingRows || '<tr><td colspan="6" style="text-align:center;padding:16px;color:var(--text-muted);">Squad data loading or not yet submitted for this Gameweek.</td></tr>'}
          </tbody>
        </table>
      </div>

      <!-- Bench Table -->
      <div>
        <div class="modal-section-header">
          <span>🪑 Substitutes Bench (${benchPts} pts)${isBenchBoostActive ? ' <span style="font-size:10px;color:#a855f7;font-weight:800;background:rgba(168,85,247,0.12);padding:2px 6px;border-radius:4px;margin-left:6px;">⚡ ACTIVE IN BENCH BOOST</span>' : ''}</span>
          <span style="font-size:11px;font-weight:600;color:var(--text-muted);">4 Players</span>
        </div>
        <table class="modal-squad-table">
          <colgroup>
            <col class="col-pos" style="width: 7%;">
            <col class="col-player" style="width: 28%;">
            <col class="col-opp" style="width: 15%;">
            <col class="col-status" style="width: 18%;">
            <col class="col-role" style="width: 20%;">
            <col class="col-pts" style="width: 12%;">
          </colgroup>
          <thead>
            <tr>
              <th class="col-pos">Pos</th>
              <th class="col-player">Player</th>
              <th class="col-opp">Opponent</th>
              <th class="col-status">Status</th>
              <th class="col-role">Role</th>
              <th class="col-pts text-center">Points</th>
            </tr>
          </thead>
          <tbody>
            ${benchRows || '<tr><td colspan="6" style="text-align:center;padding:16px;color:var(--text-muted);">Bench data not available.</td></tr>'}
          </tbody>
        </table>
      </div>

      <!-- Transfers This GW Breakdown -->
      ${transfersHtml}
    `;
  };

  document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('managerDetailModal');
    const isModalOpen = modal && modal.classList.contains('open');

    if (e.key === 'Escape') {
      closeManagerModal();
    } else if (isModalOpen && e.key === 'ArrowLeft') {
      e.preventDefault();
      navigateManagerModal(-1);
    } else if (isModalOpen && e.key === 'ArrowRight') {
      e.preventDefault();
      navigateManagerModal(1);
    }
  });

  document.addEventListener('DOMContentLoaded', init);
})();
