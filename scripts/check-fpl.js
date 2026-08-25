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
const FPL_LEAGUE_ID = process.env.FPL_LEAGUE_ID || '389585';

if (!RESEND_API_KEY || !NOTIFICATION_EMAIL) {
  console.error('❌ Missing RESEND_API_KEY or NOTIFICATION_EMAIL environment variables.');
  process.exit(1);
}

// ABA Bank Account numbers mapping
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

function getChipLabel(chipName) {
  if (!chipName) return '-';
  const n = chipName.toLowerCase();
  const num = chipName.match(/\d+/)?.[0] || '';
  if (n.includes('wildcard'))       return `WC ${num}`;
  if (n.includes('free hit'))       return `FH ${num}`;
  if (n.includes('bench boost'))    return `BB ${num}`;
  if (n.includes('triple captain')) return `TC ${num}`;
  return chipName;
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

  let leagueName = "Clash of Elite 2026-2027";
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
    2023013: { name: "នរ សិង្ហ កន្សៃ", teamName: "G.O.A.T" }
  };

  // 1. First priority: Load from live_data.json if valid
  if (liveData && liveData.managers && liveData.managers.length > 0) {
    console.log('📌 Loading data from live_data.json...');
    managers = liveData.managers.map(m => ({
      id: m.id,
      name: realManagerMap[m.id]?.name || m.name,
      teamName: realManagerMap[m.id]?.teamName || m.teamName
    }));
    currentGw = liveData.currentGw || 1;
    gameweeks = liveData.gameweeks || [];
    months = liveData.months || [];

    const gwStatus = liveData.eventStatuses ? liveData.eventStatuses[currentGw] : null;
    if (gwStatus) {
      isGwFinished = !!(gwStatus.finished || gwStatus.data_checked);
    }
  }

  // 2. Try fetching live FPL API if numeric league ID and not already finished
  if (managers.length === 0 && /^\d+$/.test(FPL_LEAGUE_ID.trim())) {
    try {
      const standingsUrl = `https://fantasy.premierleague.com/api/leagues-classic/${FPL_LEAGUE_ID.trim()}/standings/`;
      const data = await fetchFplJson(standingsUrl, 5000);

      if (data) {
        if (data.league && data.league.name) {
          leagueName = data.league.name;
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
        } else if (data.new_entries && data.new_entries.results && data.new_entries.results.length > 0) {
          isPreSeasonMode = true;
          managers = data.new_entries.results.map(r => ({
            id: r.entry,
            name: realManagerMap[r.entry]?.name || r.player_name || `${r.player_first_name || ''} ${r.player_last_name || ''}`.trim() || r.entry_name,
            teamName: realManagerMap[r.entry]?.teamName || r.entry_name
          }));
        }
      }
    } catch (err) {
      console.warn('⚠️ Could not fetch live FPL API:', err.message);
    }
  }

  // Fallback to Demo Data ONLY if no managers exist
  if (managers.length === 0 && demoData) {
    console.log('📌 Using Demo dataset fallback...');
    isPreSeasonMode = true;
    managers = demoData.managers;
    currentGw = 10;
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

  // Compute Gameweek Standings & Payouts for currentGw
  const gwData = gameweeks.find(g => g.gw === currentGw) || gameweeks[gameweeks.length - 1] || {};
  const entryFee = 3.00;
  const total = managers.length;
  const splitSize = Math.floor(total / 2);
  const hasNeutral = total % 2 === 1;
  const neutralRank = hasNeutral ? splitSize + 1 : null;

  function getSeasonNetUpToGw(mId, upToGw) {
    let sum = 0;
    for (let g = 1; g <= upToGw; g++) {
      const gData = gameweeks.find(x => x.gw === g);
      if (gData && gData.scores) {
        sum += (gData.scores[mId] || 0) - (gData.hits ? (gData.hits[mId] || 0) : 0);
      }
    }
    return sum;
  }

  function getFormGuide(mId) {
    if (isPreSeasonMode) {
      return ['-', '-', '-', '-', '-'];
    }
    const form = [];
    const startGw = Math.max(1, currentGw - 4);
    for (let g = startGw; g <= currentGw; g++) {
      const gData = gameweeks.find(x => x.gw === g);
      if (!gData || !gData.scores) continue;

      let gManagers = managers.map(m => {
        const gross = gData.scores[m.id] || 0;
        const hit = gData.hits ? (gData.hits[m.id] || 0) : 0;
        return { id: m.id, net: gross - hit };
      });
      gManagers.sort((a, b) => b.net - a.net);

      const mIndex = gManagers.findIndex(x => x.id === mId);
      const mRank = mIndex + 1;
      let code = 'N';
      if (mRank <= splitSize) code = 'W';
      else if (hasNeutral && mRank === neutralRank) code = 'N';
      else code = 'L';

      form.push(code);
    }
    return form.length > 0 ? form : ['-', '-', '-', '-', '-'];
  }

  let standings = managers.map(m => {
    const grossScore = gwData.scores ? (gwData.scores[m.id] || 0) : 0;
    const hitCost = gwData.hits ? (gwData.hits[m.id] || 0) : 0;
    const transfers = gwData.transfers ? (gwData.transfers[m.id] ?? (hitCost > 0 ? Math.floor(hitCost / 4) + 1 : 0)) : (hitCost > 0 ? Math.floor(hitCost / 4) + 1 : 0);
    const netScore = grossScore - hitCost;
    const bench = gwData.benchPoints ? (gwData.benchPoints[m.id] || 0) : 0;
    const captain = gwData.captainPoints ? (gwData.captainPoints[m.id] || 0) : 0;
    const seasonTotalNet = getSeasonNetUpToGw(m.id, currentGw);
    const chip = gwData.chipsUsed ? (gwData.chipsUsed[m.id] || null) : null;
    const form = getFormGuide(m.id);
    const aba = ABA_ACCOUNTS[m.id] || '';

    return { ...m, grossScore, hitCost, transfers, netScore, bench, captain, seasonTotalNet, chip, form, aba };
  });

  // 4-Layer Tiebreaker Sort
  standings.sort((a, b) => {
    if (b.netScore !== a.netScore) return b.netScore - a.netScore;
    if (b.bench !== a.bench) return b.bench - a.bench;
    if (b.captain !== a.captain) return b.captain - a.captain;
    if (a.hitCost !== b.hitCost) return a.hitCost - b.hitCost;
    return b.seasonTotalNet - a.seasonTotalNet;
  });

  standings = standings.map((m, idx) => {
    const rank = idx + 1;
    let payout = 0;
    let note = '';
    let rankBg = '#334155';
    let rowBg = 'transparent';

    if (rank === 1) { rankBg = 'linear-gradient(135deg, #f59e0b, #d97706)'; }
    else if (rank === 2) { rankBg = 'linear-gradient(135deg, #94a3b8, #64748b)'; }
    else if (rank === 3) { rankBg = 'linear-gradient(135deg, #d97706, #b45309)'; }
    else if (rank > splitSize && (!hasNeutral || rank !== neutralRank)) { rankBg = 'linear-gradient(135deg, #ef4444, #b91c1c)'; }

    if (rank <= splitSize) {
      payout = entryFee;
      const payer = standings[total - rank];
      note = `Gets from ${payer ? payer.name : 'Bottom'}`;
      rowBg = 'rgba(16, 185, 129, 0.08)';
    } else if (hasNeutral && rank === neutralRank) {
      payout = 0;
      note = 'Neutral';
      rowBg = 'transparent';
    } else {
      payout = -entryFee;
      const receiver = standings[total - rank];
      note = `Pays to ${receiver ? receiver.name : 'Top'}`;
      rowBg = 'rgba(239, 68, 68, 0.08)';
    }

    return { ...m, rank, payout, note, rankBg, rowBg };
  });

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
          <div class="motm-banner">
            <span>🏆 <strong>${activeMonth.name} Manager of the Month</strong>: <span class="motm-name">${motmLeader.name} (${motmLeader.pts} pts)</span></span>
          </div>
        `;
      }
    }
  }

  // Pre-fetch Premier League fixtures HTML
  let fixturesEmailHtml = '';
  try {
    const fixResp = await fetch(`https://fantasy.premierleague.com/api/fixtures/?event=${currentGw}`);
    if (fixResp.ok) {
      const rawFix = await fixResp.json();
      const bootResp = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/');
      let teamMap = {};
      if (bootResp.ok) {
        const bootData = await bootResp.json();
        if (bootData && bootData.teams) {
          bootData.teams.forEach(t => { teamMap[t.id] = t.name; });
        }
      }

      if (rawFix && rawFix.length > 0) {
        const rows = rawFix.map(f => {
          const home = teamMap[f.team_h] || `Team ${f.team_h}`;
          const away = teamMap[f.team_a] || `Team ${f.team_a}`;
          const score = f.finished ? `${f.team_h_score} - ${f.team_a_score}` : (f.started ? `LIVE ${f.team_h_score}-${f.team_a_score}` : 'vs');
          const status = f.finished ? 'FT' : (f.started ? 'LIVE 🔴' : (f.kickoff_time ? new Date(f.kickoff_time).toLocaleDateString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : 'Scheduled'));
          return `
            <tr style="border-bottom:1px solid #1e293b;">
              <td style="padding:8px 12px;text-align:right;font-weight:700;color:#f8fafc;width:40%;">${home}</td>
              <td style="padding:8px;text-align:center;width:20%;">
                <span style="display:inline-block;padding:3px 10px;border-radius:6px;background:rgba(255,255,255,0.06);color:#00ff87;font-weight:800;font-size:12px;">${score}</span>
                <span style="display:block;font-size:9px;color:#94a3b8;margin-top:2px;font-weight:700;">${status}</span>
              </td>
              <td style="padding:8px 12px;text-align:left;font-weight:700;color:#f8fafc;width:40%;">${away}</td>
            </tr>
          `;
        }).join('');

        fixturesEmailHtml = `
          <div style="margin-top:28px;background:#0f172a;border-radius:12px;padding:16px;border:1px solid #1e293b;">
            <h3 style="margin:0 0 14px 0;color:#00ff87;font-family:'Outfit',sans-serif;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">⚽ Premier League Gameweek ${currentGw} Match Results</h3>
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
              ${rows}
            </table>
          </div>
        `;
      }
    }
  } catch (err) {
    console.warn('⚠️ Fixture fetch for email failed:', err.message);
  }

  const timestamp = Date.now();

  // Build High-Fidelity HTML Email Template
  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #060913; color: #f8fafc; margin: 0; padding: 20px 10px; }
        .card-wrapper { max-width: 980px; margin: 0 auto; background: #0c1222; border-radius: 16px; padding: 24px 28px; border: 1px solid #1e293b; border-top: 3px solid #00ff87; box-shadow: 0 16px 40px rgba(0,0,0,0.6); }
        
        .header-table { width: 100%; border-collapse: collapse; border-bottom: 1px solid #1e293b; margin-bottom: 16px; }
        .header-title { font-size: 18px; font-weight: 800; color: #ffffff; margin: 0; line-height: 1.3; }
        .league-name-highlight { color: #04f5ff; }
        .gw-badge { background: #04f5ff; color: #060913; font-weight: 900; font-size: 11px; padding: 5px 12px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px; display: inline-block; }
        
        .motm-banner { padding: 12px 18px; margin-bottom: 20px; border-radius: 8px; font-size: 14px; font-weight: 700; background: linear-gradient(135deg, #fcd34d, #f59e0b); color: #3b1700; border: 1px solid #eab308; box-shadow: 0 4px 16px rgba(234, 179, 8, 0.3); }
        .motm-name { font-size: 15px; font-weight: 900; padding: 3px 10px; border-radius: 6px; background: #3b1700; color: #fcd34d; margin-left: 6px; display: inline-block; }

        .standings-table { width: 100%; border-collapse: separate; border-spacing: 0 4px; margin-top: 8px; }
        .standings-table th { background: #060913; color: #94a3b8; font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; padding: 10px 6px; text-align: center; border-bottom: 1px solid #1e293b; white-space: nowrap; }
        .standings-table th.text-left { text-align: left; }
        .standings-table th.text-center { text-align: center; }
        .standings-table td { padding: 10px 6px; font-size: 12.5px; vertical-align: middle; white-space: nowrap; }

        .rank-circle { width: 26px; height: 26px; border-radius: 50%; display: inline-block; line-height: 26px; font-weight: 900; font-size: 12px; text-align: center; color: #fff; }
        .manager-name { font-weight: 800; color: #f8fafc; font-size: 12.5px; white-space: nowrap; }
        .team-name { font-size: 10.5px; color: #94a3b8; margin-top: 2px; white-space: nowrap; }
        
        .net-pts { font-weight: 900; color: #f8fafc; font-size: 15px; text-align: center; }

        .chip-tag { display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 10px; font-weight: 800; text-transform: uppercase; background: rgba(234, 179, 8, 0.15); color: #eab308; border: 1px solid rgba(234, 179, 8, 0.4); }
        .hit-badge { display: inline-block; padding: 2px 5px; border-radius: 4px; font-size: 10px; font-weight: 900; background: rgba(239, 68, 68, 0.2); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.4); margin-left: 3px; }

        .form-pill { display: inline-block; width: 17px; height: 17px; line-height: 17px; border-radius: 50%; font-size: 9.5px; font-weight: 900; text-align: center; margin: 0 1px; color: #fff; }
        .form-w { background: #10b981; }
        .form-l { background: #ef4444; }
        .form-n { background: #64748b; }

        .payout-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11.5px; font-weight: 900; text-align: center; min-width: 55px; }
        .payout-win { background: rgba(16, 185, 129, 0.2); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.4); }
        .payout-loss { background: rgba(239, 68, 68, 0.2); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.4); }
        .payout-neutral { background: rgba(148, 163, 184, 0.2); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.4); }
        .payout-note { display: block; font-size: 9.5px; color: #94a3b8; margin-top: 2px; font-weight: 600; text-align: center; }

        .aba-pill { font-family: monospace; font-size: 11px; font-weight: 700; color: #cbd5e1; background: rgba(255,255,255,0.06); border: 1px solid #334155; padding: 2px 6px; border-radius: 4px; display: inline-block; letter-spacing: 0.3px; }
      </style>
    </head>
    <body>
      <div style="display:none;max-height:0;overflow:hidden;">Gameweek ${currentGw} Results for ${leagueName} - Ref ${timestamp}</div>
      <div class="card-wrapper">
        <table class="header-table">
          <tr>
            <td style="border:none;padding:0 0 14px 0;vertical-align:middle;">
              ${isPreSeasonMode ? '<span style="background:#f59e0b;color:#000;font-size:10px;font-weight:900;padding:3px 8px;border-radius:4px;display:inline-block;letter-spacing:0.5px;margin-bottom:6px;">PRE-SEASON PREVIEW</span><br>' : ''}
              <h1 class="header-title">Gameweek Standings &amp; Weekly Payouts — <span class="league-name-highlight">${leagueName}</span></h1>
            </td>
            <td style="border:none;padding:0 0 14px 0;text-align:right;vertical-align:middle;white-space:nowrap;width:120px;">
              <span class="gw-badge">Gameweek ${currentGw}</span>
            </td>
          </tr>
        </table>

        ${bannerHtml}

        <table class="standings-table">
          <thead>
            <tr>
              <th style="width:34px;">Pos</th>
              <th class="text-left">Manager &amp; Team</th>
              <th style="width:95px;">ABA</th>
              <th style="width:46px;">Gross</th>
              <th style="width:75px;">Transfers</th>
              <th style="width:60px;">Net Pts</th>
              <th style="width:70px;">Season Pts</th>
              <th style="width:70px;">Chip</th>
              <th style="width:95px;">Form</th>
              <th class="text-center" style="width:140px;">GW Payout</th>
            </tr>
          </thead>
          <tbody>
            ${standings.map(m => `
              <tr style="background:${m.rowBg};">
                <td style="text-align:center;border-top-left-radius:6px;border-bottom-left-radius:6px;">
                  <div class="rank-circle" style="background:${m.rankBg};">${m.rank}</div>
                </td>
                <td class="text-left">
                  <div class="manager-name">${m.name}</div>
                  <div class="team-name">${m.teamName}</div>
                </td>
                <td style="text-align:center;">
                  ${m.aba ? `<span class="aba-pill">${m.aba}</span>` : '<span style="color:#64748b;">-</span>'}
                </td>
                <td style="text-align:center;font-weight:700;color:#cbd5e1;">${m.grossScore}</td>
                <td style="text-align:center;font-weight:700;color:#cbd5e1;">
                  ${m.transfers}${m.hitCost > 0 ? `<span class="hit-badge">-${m.hitCost}</span>` : ''}
                </td>
                <td class="net-pts">${m.netScore}</td>
                <td style="text-align:center;">
                  ${m.seasonTotalNet === maxSeasonPts
                    ? `<span style="background:#00ff87;color:#060913;font-weight:900;padding:2px 7px;border-radius:12px;font-size:11.5px;display:inline-block;box-shadow:0 0 10px rgba(0,255,135,0.4);">${m.seasonTotalNet}</span>`
                    : `<span style="color:#04f5ff;font-weight:800;">${m.seasonTotalNet}</span>`}
                </td>
                <td style="text-align:center;">
                  ${m.chip ? `<span class="chip-tag">${getChipLabel(m.chip)}</span>` : '<span style="color:#64748b;">-</span>'}
                </td>
                <td style="text-align:center;">
                  ${m.form.map(c => c === 'W'
                    ? `<span class="form-pill form-w">W</span>`
                    : c === 'L'
                    ? `<span class="form-pill form-l">L</span>`
                    : c === 'N'
                    ? `<span class="form-pill form-n">N</span>`
                    : `<span style="color:#64748b;font-weight:700;margin:0 2px;">-</span>`).join('')}
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

        ${fixturesEmailHtml}

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
