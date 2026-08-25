const fs = require('fs');
const path = require('path');

let demoData;
try {
  demoData = require('../demoData.js');
} catch (e) {
  demoData = null;
}

let liveData;
try {
  liveData = JSON.parse(fs.readFileSync(path.join(__dirname, '../live_data.json'), 'utf8'));
} catch (e) {
  liveData = null;
}

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const NOTIFICATION_EMAIL = process.env.NOTIFICATION_EMAIL;
const FPL_LEAGUE_ID = (process.env.FPL_LEAGUE_ID || '389585').trim();

if (!RESEND_API_KEY || !NOTIFICATION_EMAIL) {
  console.error('❌ Missing RESEND_API_KEY or NOTIFICATION_EMAIL environment variables.');
  process.exit(1);
}

// ABA Bank Account numbers mapping (exact webapp mapping)
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

// Exact WebApp Chip Label
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

function getChipBadgeHtml(chipName) {
  if (!chipName) return '<span style="color:#94a3b8;font-size:13px;">-</span>';
  const label = getChipLabel(chipName);
  const n = chipName.toLowerCase();
  if (n.includes('wildcard') || n.includes('wc')) {
    return `<span style="display:inline-block;padding:2px 7px;border-radius:4px;font-size:10.5px;font-weight:800;background:#fef3c7;color:#b45309;border:1px solid #fcd34d;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">${label}</span>`;
  }
  if (n.includes('free hit') || n.includes('freehit') || n.includes('fh')) {
    return `<span style="display:inline-block;padding:2px 7px;border-radius:4px;font-size:10.5px;font-weight:800;background:#e0f2fe;color:#0369a1;border:1px solid #7dd3fc;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">${label}</span>`;
  }
  if (n.includes('bench boost') || n.includes('bboost') || n.includes('bb')) {
    return `<span style="display:inline-block;padding:2px 7px;border-radius:4px;font-size:10.5px;font-weight:800;background:#ffedd5;color:#c2410c;border:1px solid #fdba74;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">${label}</span>`;
  }
  if (n.includes('triple captain') || n.includes('3xc') || n.includes('tc')) {
    return `<span style="display:inline-block;padding:2px 7px;border-radius:4px;font-size:10.5px;font-weight:800;background:#fce7f3;color:#9d174d;border:1px solid #f472b6;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">${label}</span>`;
  }
  return `<span style="display:inline-block;padding:2px 7px;border-radius:4px;font-size:10.5px;font-weight:800;background:#f1f5f9;color:#475569;border:1px solid #cbd5e1;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">${label}</span>`;
}

async function fetchFplJson(targetUrl, timeoutMs = 5000) {
  const directAndProxies = [
    targetUrl,
    `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`
  ];

  for (const url of directAndProxies) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (resp.ok) {
        const data = await resp.json();
        if (data) return data;
      }
    } catch (e) {}
  }
  return null;
}

async function run() {
  console.log(`🔍 Checking FPL status for League: ${FPL_LEAGUE_ID}...`);

  let leagueName = "CLASH OF ELITE 2026-2027";
  let managers = [];
  let currentGw = 1;
  let gameweeks = [];
  let months = [];
  let isPreSeasonMode = false;
  let isGwFinished = false;

  // State File Tracking to avoid duplicate emails
  const stateFilePath = path.join(__dirname, '../.last_sent_gw.json');
  let lastSentGw = 0;
  if (fs.existsSync(stateFilePath)) {
    try {
      const stateData = JSON.parse(fs.readFileSync(stateFilePath, 'utf8'));
      lastSentGw = stateData.lastSentGw || 0;
    } catch (e) {}
  }

  const isManualRun = process.env.GITHUB_EVENT_NAME === 'workflow_dispatch';

  const realManagerMap = {
    2019453: { name: "Seyha ly", teamName: "The Red Devil" },
    2067578: { name: "Kun Phaktra", teamName: "The Blue Warriors" },
    2026160: { name: "Piseth Nhim", teamName: "DESSTRo" },
    2026484: { name: "Bora Chhe", teamName: "Bora's Team" },
    2024611: { name: "Vibol Dang", teamName: "The White Emperor" },
    2023789: { name: "Monor Noem", teamName: "NORA FC" },
    2023013: { name: "នរសិង្ហ កន្សៃ", teamName: "G.O.A.T" }
  };

  // 1. Load directly from live_data.json
  if (liveData) {
    const targetLeague = (liveData.leagues && (liveData.leagues[FPL_LEAGUE_ID] || Object.values(liveData.leagues)[0])) || null;
    if (targetLeague && targetLeague.managers && targetLeague.managers.length > 0) {
      console.log(`📌 Loaded live league data for ${targetLeague.leagueName || leagueName} with ${targetLeague.managers.length} managers!`);
      if (targetLeague.leagueName) leagueName = targetLeague.leagueName.toUpperCase();
      managers = targetLeague.managers.map(m => ({
        id: m.id,
        name: realManagerMap[m.id]?.name || m.name,
        teamName: realManagerMap[m.id]?.teamName || m.teamName
      }));
      currentGw = liveData.currentGw || targetLeague.currentGw || 1;
      gameweeks = targetLeague.gameweeks || [];
      months = targetLeague.months || [];

      const gwStatus = liveData.eventStatuses ? liveData.eventStatuses[currentGw] : null;
      if (gwStatus) {
        isGwFinished = !!(gwStatus.finished || gwStatus.data_checked);
      }
    }
  }

  // 2. Fallback to live FPL API if not loaded from live_data.json
  if (managers.length === 0 && /^\d+$/.test(FPL_LEAGUE_ID)) {
    try {
      const standingsUrl = `https://fantasy.premierleague.com/api/leagues-classic/${FPL_LEAGUE_ID}/standings/`;
      const data = await fetchFplJson(standingsUrl, 5000);

      if (data) {
        if (data.league && data.league.name) {
          leagueName = data.league.name.toUpperCase();
        }

        if (data.standings && data.standings.results && data.standings.results.length > 0) {
          managers = data.standings.results.map(r => ({
            id: r.entry,
            name: realManagerMap[r.entry]?.name || r.player_name || "Manager",
            teamName: realManagerMap[r.entry]?.teamName || r.entry_name
          }));

          const bootData = await fetchFplJson('https://fantasy.premierleague.com/api/bootstrap-static/', 5000);
          if (bootData && bootData.events) {
            const currentEvent = bootData.events.find(e => e.is_current) || bootData.events.find(e => e.is_next);
            if (currentEvent) {
              currentGw = currentEvent.id;
              isGwFinished = currentEvent.finished || currentEvent.data_checked;
            }
          }
        }
      }
    } catch (err) {
      console.warn('⚠️ Could not fetch live FPL API:', err.message);
    }
  }

  // 3. Fallback to Demo Data ONLY if no managers exist
  if (managers.length === 0 && demoData) {
    console.log('📌 Using Demo dataset fallback...');
    isPreSeasonMode = true;
    managers = demoData.managers;
    currentGw = 1;
    gameweeks = demoData.gameweeks;
    months = demoData.months || [];
  }

  if (managers.length === 0) {
    console.error('❌ No manager data available to send email.');
    process.exit(1);
  }

  // Guards for automated scheduled cron triggers
  if (isPreSeasonMode && !isManualRun) {
    console.log(`ℹ️ Pre-season mode active. Skipping automated scheduled email.`);
    process.exit(0);
  }

  if (!isPreSeasonMode && !isGwFinished && !isManualRun) {
    console.log(`ℹ️ Gameweek ${currentGw} is still in progress. Waiting until matches & points are finalized.`);
    process.exit(0);
  }

  if (!isManualRun && currentGw === lastSentGw) {
    console.log(`ℹ️ Gameweek ${currentGw} notification already sent previously (lastSentGw: ${lastSentGw}). Skipping duplicate email.`);
    process.exit(0);
  }

  // ===================== EXACT WEBAPP CALCULATION ENGINE =====================
  const entryFee = 3.00;
  const total = managers.length;
  const splitSize = Math.floor(total / 2);
  const hasNeutral = total % 2 === 1;
  const neutralRank = hasNeutral ? splitSize + 1 : null;

  function computeAutoSubs(picks, automaticSubs, pMap, isBenchBoost) {
    if (isBenchBoost || !picks || picks.length === 0) return [];
    if (automaticSubs && automaticSubs.length > 0) {
      return automaticSubs.map(s => ({
        element_in: s.element_in,
        element_out: s.element_out,
        is_official: true
      }));
    }

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

    const gkStarter = dnpStarters.find(p => p.position === 1);
    if (gkStarter) {
      const benchGk = bench.find(p => p.position === 12);
      if (benchGk) {
        const plGk = pMap[benchGk.element];
        if (plGk && plGk.match_status !== 'dnp') {
          computed.push({ element_in: benchGk.element, element_out: gkStarter.element, is_official: false });
          usedBenchIds.add(benchGk.element);
        }
      }
    }

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

        const isValid = testFormation[1] === 1 &&
                        testFormation[2] >= 3 && testFormation[2] <= 5 &&
                        testFormation[3] >= 2 && testFormation[3] <= 5 &&
                        testFormation[4] >= 1 && testFormation[4] <= 3;

        if (isValid) {
          computed.push({ element_in: benchPick.element, element_out: dnpStarter.element, is_official: false });
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
    const gwData = gameweeks.find(g => g.gw === gw);
    let fallbackScore = (gwData && gwData.scores) ? (gwData.scores[mId] || 0) : 0;

    const squadPicksMap = (liveData && liveData.squadPicks) || {};
    const playersMap = (liveData && liveData.players) || {};

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

  function getManagerSeasonNetUpToGw(mId, upToGw) {
    let sum = 0;
    for (let g = 1; g <= upToGw; g++) {
      const gData = gameweeks.find(x => x.gw === g);
      const gross = getManagerLiveScore(mId, g);
      const hits = (gData && gData.hits) ? (gData.hits[mId] || 0) : 0;
      sum += (gross - hits);
    }
    return sum;
  }

  function getGameweekStandings(gw) {
    const gwData = gameweeks.find(g => g.gw === gw);
    if (!gwData) return [];

    let mList = managers.map(m => {
      const grossScore = getManagerLiveScore(m.id, gw);
      const hitCost = gwData.hits ? (gwData.hits[m.id] || 0) : 0;
      const transfers = gwData.transfers ? (gwData.transfers[m.id] ?? (hitCost > 0 ? Math.floor(hitCost / 4) + 1 : 0)) : (hitCost > 0 ? Math.floor(hitCost / 4) + 1 : 0);
      const netScore = grossScore - hitCost;
      const bench = gwData.benchPoints ? (gwData.benchPoints[m.id] || 0) : 0;
      const captain = gwData.captainPoints ? (gwData.captainPoints[m.id] || 0) : 0;
      const chip = gwData.chipsUsed ? (gwData.chipsUsed[m.id] || null) : null;
      const seasonTotalNet = getManagerSeasonNetUpToGw(m.id, gw);
      const aba = ABA_ACCOUNTS[m.id] || '';
      return { ...m, grossScore, hitCost, transfers, netScore, bench, captain, chip, seasonTotalNet, aba };
    });

    // 4-Layer Custom Tiebreaker Sort
    mList.sort((a, b) => {
      if (b.netScore !== a.netScore) return b.netScore - a.netScore;
      if (b.bench !== a.bench) return b.bench - a.bench;
      if (b.captain !== a.captain) return b.captain - a.captain;
      if (a.hitCost !== b.hitCost) return a.hitCost - b.hitCost;
      return b.seasonTotalNet - a.seasonTotalNet;
    });

    const hasPlayedMatches = mList.some(m => m.grossScore > 0 || m.hitCost > 0);

    return mList.map((m, idx) => {
      const rank = idx + 1;
      let payout = 0, outcomeCode = 'N', note = '';
      let rankBg = '#f1f5f9', rankColor = '#475569', rankBorder = '1px solid #cbd5e1';
      let rowBg = '#ffffff', rowBorderLeft = '4px solid #cbd5e1';

      if (!hasPlayedMatches) {
        payout = 0; outcomeCode = '-'; note = 'Neutral';
      } else {
        if (rank <= splitSize) {
          payout = entryFee; outcomeCode = 'W';
          const payer = mList[total - rank];
          note = `Gets from ${payer ? payer.name : 'Bottom'}`;
          rowBg = '#ecfdf5'; rowBorderLeft = '4px solid #10b981';
          if (rank === 1) { rankBg = '#f59e0b'; rankColor = '#ffffff'; rankBorder = 'none'; }
          else if (rank === 2) { rankBg = '#e2e8f0'; rankColor = '#1e293b'; rankBorder = '1px solid #cbd5e1'; }
          else if (rank === 3) { rankBg = '#fdba74'; rankColor = '#431407'; rankBorder = 'none'; }
        } else if (hasNeutral && rank === neutralRank) {
          payout = 0; outcomeCode = 'N';
          note = 'Neutral';
          rowBg = '#f1f5f9'; rowBorderLeft = '4px solid #94a3b8';
          rankBg = '#e2e8f0'; rankColor = '#475569';
        } else {
          payout = -entryFee; outcomeCode = 'L';
          const receiver = mList[total - rank];
          note = `Pays to ${receiver ? receiver.name : 'Top'}`;
          rowBg = '#fef2f2'; rowBorderLeft = '4px solid #ef4444';
          rankBg = '#fee2e2'; rankColor = '#ef4444'; rankBorder = '1px solid #fca5a5';
        }
      }

      return { ...m, rank, payout, outcomeCode, note, rankBg, rankColor, rankBorder, rowBg, rowBorderLeft };
    });
  }

  // Exact WebApp Form Guide (strictly previous GWs only)
  function getFormGuide(managerId) {
    if (currentGw <= 1) {
      return ['-'];
    }
    const form = [];
    const endGw = currentGw - 1;
    const startGw = Math.max(1, endGw - 4);
    for (let gw = startGw; gw <= endGw; gw++) {
      const gStandings = getGameweekStandings(gw);
      const m = gStandings.find(x => x.id === managerId);
      if (m && m.outcomeCode && m.outcomeCode !== '-') {
        form.push(m.outcomeCode);
      }
    }
    return form.length > 0 ? form : ['-'];
  }

  // Get current gameweek standings
  let standings = getGameweekStandings(currentGw);
  const maxSeasonPts = Math.max(...standings.map(m => m.seasonTotalNet));

  // MOTM Banner calculation
  let bannerHtml = '';
  const activeMonth = months.find(m => m.gws && m.gws.includes(currentGw));
  if (activeMonth) {
    const monthEndGw = Math.max(...activeMonth.gws);
    if (currentGw >= monthEndGw) {
      const motmScores = managers.map(m => {
        let pts = 0;
        activeMonth.gws.forEach(g => {
          const gData = gameweeks.find(x => x.gw === g);
          if (gData && gData.scores) pts += (gData.scores[m.id] || 0) - (gData.hits ? (gData.hits[m.id] || 0) : 0);
        });
        return { name: m.name, pts };
      }).sort((a, b) => b.pts - a.pts);

      const motmLeader = motmScores[0];
      if (motmLeader) {
        bannerHtml += `
          <div style="padding:12px 18px;margin-bottom:16px;border-radius:8px;font-size:14px;font-weight:700;background:linear-gradient(135deg, #fcd34d, #f59e0b);color:#3b1700;border:1px solid #eab308;">
            <span>🏆 <strong>${activeMonth.name} Manager of the Month</strong>: <span style="font-size:14px;font-weight:900;padding:3px 10px;border-radius:6px;background:#3b1700;color:#fcd34d;margin-left:6px;display:inline-block;">${motmLeader.name} (${motmLeader.pts} pts)</span></span>
          </div>
        `;
      }
    }
  }

  const timestamp = Date.now();

  // High-Fidelity Web-App Match HTML Email Template
  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 24px 12px; }
        .card-wrapper { max-width: 980px; margin: 0 auto; background: #ffffff; border-radius: 14px; padding: 24px 26px; border: 1px solid #e2e8f0; box-shadow: 0 4px 20px rgba(0,0,0,0.05); position: relative; }
        .card-top-bar { height: 4px; background: linear-gradient(90deg, #00ff87, #04f5ff); border-top-left-radius: 14px; border-top-right-radius: 14px; margin: -24px -26px 20px -26px; }
        
        .header-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        .header-title { font-size: 16px; font-weight: 800; color: #0f172a; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; }
        .gw-badge { background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; font-weight: 800; font-size: 11px; padding: 4px 10px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.5px; display: inline-block; }
        
        .standings-table { width: 100%; border-collapse: separate; border-spacing: 0 6px; }
        .standings-table th { background: transparent; color: #64748b; font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; padding: 10px 8px; text-align: center; border-bottom: 1px solid #e2e8f0; white-space: nowrap; }
        .standings-table th.text-left { text-align: left; }
        .standings-table td { padding: 12px 8px; font-size: 13px; vertical-align: middle; white-space: nowrap; }

        .rank-circle { width: 24px; height: 24px; border-radius: 50%; display: inline-block; line-height: 24px; font-weight: 800; font-size: 12px; text-align: center; }
        .manager-name { font-weight: 800; color: #0f172a; font-size: 12.5px; white-space: nowrap; }
        .team-name { font-size: 10.5px; color: #64748b; margin-top: 2px; font-weight: 500; white-space: nowrap; }
        
        .aba-pill { font-family: monospace; font-size: 11px; font-weight: 700; color: #1e293b; background: #f1f5f9; border: 1px solid #e2e8f0; padding: 2px 7px; border-radius: 5px; display: inline-block; letter-spacing: 0.3px; }
        .net-pts { font-weight: 800; color: #0f172a; font-size: 15px; text-align: center; }

        .hit-badge { display: inline-block; padding: 2px 5px; border-radius: 4px; font-size: 10px; font-weight: 800; background: #ffffff; color: #b91c1c; border: 1px solid #fca5a5; margin-left: 3px; }

        .form-pill { display: inline-block; width: 18px; height: 18px; line-height: 18px; border-radius: 50%; font-size: 9.5px; font-weight: 900; text-align: center; margin: 0 1px; color: #fff; }
        .form-w { background: #10b981; }
        .form-l { background: #ef4444; }
        .form-n { background: #64748b; }

        .payout-badge { display: inline-block; padding: 3px 12px; border-radius: 20px; font-size: 12px; font-weight: 800; text-align: center; min-width: 58px; }
        .payout-win { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
        .payout-loss { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }
        .payout-neutral { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
        .payout-note { display: block; font-size: 10px; color: #64748b; margin-top: 2px; font-weight: 600; text-align: center; }
      </style>
    </head>
    <body>
      <div style="display:none;max-height:0;overflow:hidden;">Gameweek ${currentGw} Results for ${leagueName}</div>
      <div class="card-wrapper">
        <div class="card-top-bar"></div>
        <table class="header-table">
          <tr>
            <td style="border:none;padding:0 0 10px 0;vertical-align:middle;">
              <h1 class="header-title">Gameweek Standings &amp; Weekly Payouts — ${leagueName}</h1>
            </td>
            <td style="border:none;padding:0 0 10px 0;text-align:right;vertical-align:middle;white-space:nowrap;width:120px;">
              <span class="gw-badge">Gameweek ${currentGw}</span>
            </td>
          </tr>
        </table>

        ${bannerHtml}

        <table class="standings-table">
          <thead>
            <tr>
              <th style="width:36px;">Pos</th>
              <th class="text-left" style="width:135px;">Manager &amp; Team</th>
              <th style="width:95px;">ABA</th>
              <th style="width:48px;">Gross</th>
              <th style="width:75px;">Transfers</th>
              <th style="width:60px;">Net Pts</th>
              <th style="width:75px;">Season Pts <span style="font-size:10px;color:#94a3b8;">⇅</span></th>
              <th style="width:70px;">Chip</th>
              <th style="width:80px;">Form</th>
              <th class="text-center" style="width:145px;">GW Payout</th>
            </tr>
          </thead>
          <tbody>
            ${standings.map(m => `
              <tr style="background:${m.rowBg};border-left:${m.rowBorderLeft};">
                <td style="text-align:center;border-top-left-radius:6px;border-bottom-left-radius:6px;">
                  <div class="rank-circle" style="background:${m.rankBg};color:${m.rankColor};border:${m.rankBorder};">${m.rank}</div>
                </td>
                <td class="text-left">
                  <div class="manager-name">${m.name}</div>
                  <div class="team-name">${m.teamName}</div>
                </td>
                <td style="text-align:center;">
                  ${m.aba ? `<span class="aba-pill">${m.aba}</span>` : '<span style="color:#94a3b8;">-</span>'}
                </td>
                <td style="text-align:center;font-weight:700;color:#475569;">${m.grossScore}</td>
                <td style="text-align:center;font-weight:700;color:#475569;">
                  ${m.transfers}${m.hitCost > 0 ? `<span class="hit-badge">-${m.hitCost}</span>` : ''}
                </td>
                <td class="net-pts">${m.netScore}</td>
                <td style="text-align:center;">
                  ${m.seasonTotalNet === maxSeasonPts
                    ? `<span style="background:#f59e0b;color:#451a03;font-weight:900;padding:2px 8px;border-radius:12px;font-size:12px;display:inline-block;">${m.seasonTotalNet}</span>`
                    : `<span style="color:#0284c7;font-weight:800;font-size:13px;">${m.seasonTotalNet}</span>`}
                </td>
                <td style="text-align:center;">
                  ${getChipBadgeHtml(m.chip)}
                </td>
                <td style="text-align:center;">
                  ${getFormGuide(m.id).map(c => c === 'W'
                    ? `<span class="form-pill form-w">W</span>`
                    : c === 'L'
                    ? `<span class="form-pill form-l">L</span>`
                    : c === 'N'
                    ? `<span class="form-pill form-n">N</span>`
                    : `<span style="color:#94a3b8;font-weight:700;">-</span>`).join('')}
                </td>
                <td style="text-align:center;border-top-right-radius:6px;border-bottom-right-radius:6px;">
                  <div style="display:inline-block;text-align:center;">
                    <span class="payout-badge ${m.payout > 0 ? 'payout-win' : m.payout < 0 ? 'payout-loss' : 'payout-neutral'}">
                      ${m.payout > 0 ? `+$${m.payout}.00` : m.payout < 0 ? `-$${Math.abs(m.payout)}.00` : `$0.00`}
                    </span>
                    <span class="payout-note">${m.note}</span>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>

      </div>
    </body>
    </html>
  `;

  const uniqueSubject = `🏆 Gameweek ${currentGw} Results: ${leagueName} [GW${currentGw}-${timestamp.toString().slice(-4)}]`;

  // Send Email via Resend API
  console.log(`📧 Sending email notification to ${NOTIFICATION_EMAIL}...`);
  const resendResp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'FPL Dashboard <onboarding@resend.dev>',
      to: [NOTIFICATION_EMAIL],
      subject: uniqueSubject,
      html: emailHtml
    })
  });

  if (resendResp.ok) {
    const resData = await resendResp.json();
    console.log('✅ Email sent successfully! ID:', resData.id);

    // Save state so we don't send duplicate emails for the same live GW on cron schedule
    if (!isPreSeasonMode) {
      try {
        fs.writeFileSync(stateFilePath, JSON.stringify({ lastSentGw: currentGw, updatedAt: new Date().toISOString() }, null, 2));
        console.log(`💾 Saved lastSentGw = ${currentGw} to state tracking file.`);
      } catch (e) {}
    }
  } else {
    const errText = await resendResp.text();
    console.error('❌ Failed to send email via Resend:', errText);
    process.exit(1);
  }
}

run();
