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
    theme: localStorage.getItem('fpl_admin_theme') || 'dark',
    motsPrizePool: 50,
    dataset: JSON.parse(JSON.stringify(window.DEMO_DATA)),
    chartInstance: null,
    perfChartInstance: null
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
    chipTrackerContainer:   document.getElementById('chipTrackerContainer'),
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

  // ===================== INITIALIZATION =====================
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
        if (state.viewMode === 'overall') {
          state.showMotmBadge = false;
          if (elements.toggleMotmBtn) elements.toggleMotmBtn.classList.remove('active');
        } else {
          state.showMotmBadge = true;
          if (elements.toggleMotmBtn) elements.toggleMotmBtn.classList.add('active');
        }
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
        if (!state.showMotmBadge && elements.viewModeSelect) {
          elements.viewModeSelect.value = 'overall';
        }
        renderStandingsTable();
      });
    }

    if (elements.toggleMotsBtn) {
      elements.toggleMotsBtn.addEventListener('click', () => {
        state.showMotsBadge = !state.showMotsBadge;
        elements.toggleMotsBtn.classList.toggle('active', state.showMotsBadge);
        renderStandingsTable();
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
          elements.syncStatusTag.className = 'sync-status-tag live';
          elements.syncStatusTag.textContent = 'DEMO MODE';
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
  async function syncLiveFplLeague() {
    const inputCode = elements.leagueIdInput.value.trim();
    if (!inputCode) {
      alert('Please enter a valid FPL League ID or Join Code.');
      return;
    }

    elements.syncStatusTag.className = 'sync-status-tag pending';
    elements.syncStatusTag.textContent = `Syncing #${inputCode}...`;

    // Clear demo data immediately so it doesn't persist if fetch fails
    state.dataset.managers = [];
    state.dataset.gameweeks = state.dataset.gameweeks.map(gw => ({
      gw: gw.gw,
      scores: {}, hits: {}, transfers: {}, benchPoints: {}, captainPoints: {}, chipsUsed: {}
    }));
    renderAll();

    try {
      const proxyUrl = `https://corsproxy.io/?https://fantasy.premierleague.com/api/leagues-classic/${inputCode}/standings/`;
      const resp = await fetch(proxyUrl);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const data = await resp.json();
      if (data && data.standings && data.standings.results && data.standings.results.length > 0) {
        const count = data.standings.results.length;
        elements.syncStatusTag.className = 'sync-status-tag live';
        elements.syncStatusTag.textContent = `LIVE (${count} Members)`;

        if (data.league && data.league.name) {
          elements.leagueNameHeader.textContent = data.league.name;
          if (elements.leagueNameDisplay) elements.leagueNameDisplay.textContent = data.league.name;
        }

        state.dataset.managers = data.standings.results.map(r => ({
          id: r.entry,
          name: r.player_name,
          teamName: r.entry_name,
          avatar: r.player_name.split(' ').map(n => n[0]).join('')
        }));

        updateMemberCountBadge();
        renderAll();
      } else {
        throw new Error('No live standings found');
      }
    } catch (err) {
      console.warn('Live FPL Sync Notice:', err);
      elements.syncStatusTag.className = 'sync-status-tag pending';
      elements.syncStatusTag.textContent = `Code #${inputCode} Saved`;
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
      if (gwData) sum += (gwData.scores[managerId] || 0) - (gwData.hits ? (gwData.hits[managerId] || 0) : 0);
    }
    return sum;
  }

  function getChipColorClass(chipName) {
    if (!chipName) return '';
    const n = chipName.toLowerCase();
    if (n.includes('wildcard'))       return 'chip-wildcard';
    if (n.includes('free hit'))       return 'chip-free-hit';
    if (n.includes('bench boost'))    return 'chip-bench-boost';
    if (n.includes('triple captain')) return 'chip-triple-captain';
    return '';
  }

  // Short display label — always includes the set number (e.g. "WC 1", "FH 2")
  function getChipLabel(chipName) {
    if (!chipName) return '';
    const n = chipName.toLowerCase();
    const num = chipName.match(/\d+/)?.[0] || '';
    if (n.includes('wildcard'))       return `WC ${num}`;
    if (n.includes('free hit'))       return `FH ${num}`;
    if (n.includes('bench boost'))    return `BB ${num}`;
    if (n.includes('triple captain')) return `TC ${num}`;
    return chipName;
  }

  // ===================== STANDINGS ENGINE =====================
  function getGameweekStandings(gw) {
    const gwData = state.dataset.gameweeks.find(g => g.gw === gw);
    if (!gwData) return [];

    const activeManagers = state.dataset.managers;
    const total = activeManagers.length;

    let managers = activeManagers.map(m => {
      const grossScore    = gwData.scores[m.id] || 0;
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
    // winners = losers = floor(N/2) — neutral only when N is odd (1 middle manager)
    const splitSize  = Math.floor(total / 2);
    const hasNeutral = total % 2 === 1; // true only when N is odd
    const neutralRank = hasNeutral ? splitSize + 1 : null; // exact middle rank

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

      // Tiebreaker indicator — only at zone boundaries where payout changes
      const lastWinScore    = managers[splitSize - 1]?.netScore;           // last winner
      const firstOtherScore = managers[splitSize]?.netScore;               // first neutral or loser
      const lastNeutralScore = hasNeutral ? managers[splitSize]?.netScore : null;
      const firstLoserScore  = hasNeutral ? managers[splitSize + 1]?.netScore : null;

      const atTopBoundary = (rank === splitSize || rank === splitSize + 1)
        && lastWinScore === firstOtherScore;
      const atBottomBoundary = hasNeutral
        && (rank === neutralRank || rank === neutralRank + 1)
        && lastNeutralScore === firstLoserScore;
      const isTied = atTopBoundary || atBottomBoundary;

      // Payout note — mirrors the split size
      let note = '';
      if (rank <= splitSize) {
        const payer = managers[total - rank];
        note = `Gets from ${payer ? payer.name.split(' ')[0] : 'Bottom'}`;
      } else if (hasNeutral && rank === neutralRank) {
        note = 'Neutral';
      } else {
        const receiver = managers[total - rank];
        note = `Pays to ${receiver ? receiver.name.split(' ')[0] : 'Top'}`;
      }

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

      const lastWinScore    = managers[splitSize - 1]?.netScore;
      const firstOtherScore = managers[splitSize]?.netScore;
      const lastNeutralScore = hasNeutral ? managers[splitSize]?.netScore : null;
      const firstLoserScore  = hasNeutral ? managers[splitSize + 1]?.netScore : null;

      const atTopBoundary = (rank === splitSize || rank === splitSize + 1) && lastWinScore === firstOtherScore;
      const atBottomBoundary = hasNeutral && (rank === neutralRank || rank === neutralRank + 1) && lastNeutralScore === firstLoserScore;
      const isTied = atTopBoundary || atBottomBoundary;

      let note = '';
      if (rank <= splitSize) {
        const payer = managers[total - rank];
        note = `Gets from ${payer ? payer.name.split(' ')[0] : 'Bottom'}`;
      } else if (hasNeutral && rank === neutralRank) {
        note = 'Neutral';
      } else {
        const receiver = managers[total - rank];
        note = `Pays to ${receiver ? receiver.name.split(' ')[0] : 'Top'}`;
      }

      return { ...m, rank, payout, statusClass, outcomeCode, isTied, payoutNote: note, monthObj };
    });
  }

  function getFormGuide(managerId) {
    const form = [];
    const startGw = Math.max(1, state.currentGw - 4);
    for (let gw = startGw; gw <= state.currentGw; gw++) {
      const standings = getGameweekStandings(gw);
      const m = standings.find(x => x.id === managerId);
      if (m) form.push(m.outcomeCode);
    }
    return form;
  }

  // ===================== RENDER ALL =====================
  function renderAll() {
    const hasData = state.dataset.managers && state.dataset.managers.length > 0;
    
    document.getElementById('section-standings').style.display = hasData ? 'block' : 'none';
    document.getElementById('section-performance').style.display = hasData ? 'block' : 'none';
    document.getElementById('section-trajectory').style.display = hasData ? 'block' : 'none';
    document.getElementById('section-empty').style.display = hasData ? 'none' : 'block';

    if (!hasData) return;

    renderStandingsTable();
    renderWinLossSummaryTable();
    renderChipTracker();
    updateChart();
    updatePerformanceChart();
  }

  // ===================== STANDINGS TABLE =====================
  function renderStandingsTable() {
    const isMonthlyView = state.viewMode && state.viewMode !== 'overall';
    const standings = isMonthlyView ? getMonthlyStandings(state.viewMode) : getGameweekStandings(state.currentGw);
    
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

    // Render MOTM Banner
    const motmBannerContainer = document.getElementById('motmBannerContainer');
    if (motmBannerContainer) {
      if ((state.showMotmBadge || isMonthlyView) && motmInfo.leader) {
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
          <span style="font-weight:700;color:var(--text-secondary);">${m.grossScore}</span>
        </td>
        <td class="text-center">${transferDisplay}</td>
        <td class="text-center">
          <span class="gw-score">${m.netScore}</span>
        </td>
        <td class="text-center">
          <span class="season-pts${m.seasonTotalNet === maxSeasonPts ? ' season-pts-top' : ''}">${m.seasonTotalNet}</span>
        </td>
        <td class="text-center">${chipColumnContent}</td>
        <td class="text-center">
          <div class="form-pill-container">${formHtml}</div>
        </td>
        <td class="text-right">
          <div class="payout-container">
            ${payoutBadge}
            <span class="payout-note">${m.payoutNote}</span>
          </div>
        </td>
      `;
      elements.standingsBody.appendChild(tr);

      // =========== #10 MOBILE CARD ===========
      if (elements.mobileCards) {
        const card = document.createElement('div');
        card.className = `mobile-manager-card ${m.statusClass}${m.isTied ? ' tr-tied' : ''}`;
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
            <div class="mobile-stat-item">
              <span class="mobile-stat-label">Net Pts</span>
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
    const managers = state.dataset.managers;
    const chipTypes = state.dataset.chipTypes;

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
          if (item.chip) chipsUsedMap[item.chip] = gw;
        }
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
      return {
        label: m.name,
        data: rankHistory,
        borderColor: CHART_COLORS[idx % CHART_COLORS.length],
        backgroundColor: CHART_COLORS[idx % CHART_COLORS.length],
        tension: 0.2,
        borderWidth: 2
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

  document.addEventListener('DOMContentLoaded', init);
})();
