const fs = require('fs');
const path = require('path');

let demoData;
try {
  demoData = require('../demoData.js');
} catch (e) {
  demoData = null;
}

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const NOTIFICATION_EMAIL = process.env.NOTIFICATION_EMAIL;
const FPL_LEAGUE_ID = process.env.FPL_LEAGUE_ID || 'demo';

if (!RESEND_API_KEY || !NOTIFICATION_EMAIL) {
  console.error('❌ Missing RESEND_API_KEY or NOTIFICATION_EMAIL environment variables.');
  process.exit(1);
}

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

async function run() {
  console.log(`🔍 Checking FPL status for League: ${FPL_LEAGUE_ID}...`);

  let leagueName = "Clash of Elite Fantasy League";
  let managers = [];
  let currentGw = 10;
  let gameweeks = [];
  let isDemoMode = false;

  // Try fetching live FPL API if numeric league ID
  if (/^\d+$/.test(FPL_LEAGUE_ID.trim())) {
    try {
      const resp = await fetch(`https://fantasy.premierleague.com/api/leagues-classic/${FPL_LEAGUE_ID.trim()}/standings/`);
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.standings && data.standings.results && data.standings.results.length > 0) {
          leagueName = data.league?.name || `League #${FPL_LEAGUE_ID}`;
          managers = data.standings.results.map(r => ({
            id: r.entry,
            name: r.player_name,
            teamName: r.entry_name
          }));

          const bootResp = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/');
          if (bootResp.ok) {
            const bootData = await bootResp.json();
            const currentEvent = bootData.events.find(e => e.is_current) || bootData.events.find(e => e.is_next);
            if (currentEvent) currentGw = currentEvent.id;
          }
        }
      }
    } catch (err) {
      console.warn('⚠️ Could not fetch live FPL API, falling back to Demo dataset:', err.message);
    }
  }

  // Fallback to Demo Data if no live managers found (e.g. pre-season or join code like 8d70fl)
  if (managers.length === 0 && demoData) {
    console.log('📌 Using Demo League dataset for email preview...');
    isDemoMode = true;
    leagueName = demoData.leagueName || "Clash of Elite Fantasy League";
    managers = demoData.managers;
    currentGw = 10;
    gameweeks = demoData.gameweeks;
  }

  if (managers.length === 0) {
    console.error('❌ No manager data available to send email.');
    process.exit(1);
  }

  // Compute Gameweek Standings & Payouts for currentGw
  const gwData = gameweeks.find(g => g.gw === currentGw) || gameweeks[gameweeks.length - 1];
  const entryFee = 3.00;
  const total = managers.length;
  const splitSize = Math.floor(total / 2);
  const hasNeutral = total % 2 === 1;
  const neutralRank = hasNeutral ? splitSize + 1 : null;

  // Function to compute season net up to gw
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

  // Compute form for last 5 GWs
  function getFormGuide(mId) {
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
    return form;
  }

  let standings = managers.map(m => {
    const grossScore = gwData && gwData.scores ? (gwData.scores[m.id] || 0) : 0;
    const hitCost = gwData && gwData.hits ? (gwData.hits[m.id] || 0) : 0;
    const transfers = gwData && gwData.transfers ? (gwData.transfers[m.id] ?? (hitCost > 0 ? Math.floor(hitCost / 4) + 1 : 0)) : (hitCost > 0 ? Math.floor(hitCost / 4) + 1 : 0);
    const netScore = grossScore - hitCost;
    const seasonTotalNet = getSeasonNetUpToGw(m.id, currentGw);
    const chip = gwData && gwData.chipsUsed ? (gwData.chipsUsed[m.id] || null) : null;
    const form = getFormGuide(m.id);

    return { ...m, grossScore, hitCost, transfers, netScore, seasonTotalNet, chip, form };
  });

  standings.sort((a, b) => b.netScore - a.netScore);

  standings = standings.map((m, idx) => {
    const rank = idx + 1;
    let payout = 0;
    let note = '';
    let rankBg = '#334155';
    let rankColor = '#f8fafc';

    if (rank === 1) { rankBg = 'linear-gradient(135deg, #f59e0b, #d97706)'; rankColor = '#ffffff'; }
    else if (rank === 2) { rankBg = 'linear-gradient(135deg, #94a3b8, #64748b)'; rankColor = '#ffffff'; }
    else if (rank === 3) { rankBg = 'linear-gradient(135deg, #d97706, #b45309)'; rankColor = '#ffffff'; }
    else if (rank > splitSize && (!hasNeutral || rank !== neutralRank)) { rankBg = 'linear-gradient(135deg, #ef4444, #b91c1c)'; rankColor = '#ffffff'; }

    if (rank <= splitSize) {
      payout = entryFee;
      const payer = standings[total - rank];
      note = `Gets from ${payer ? payer.name.split(' ')[0] : 'Bottom'}`;
    } else if (hasNeutral && rank === neutralRank) {
      payout = 0;
      note = 'Neutral';
    } else {
      payout = -entryFee;
      const receiver = standings[total - rank];
      note = `Pays to ${receiver ? receiver.name.split(' ')[0] : 'Top'}`;
    }

    return { ...m, rank, payout, note, rankBg, rankColor };
  });

  const maxSeasonPts = Math.max(...standings.map(m => m.seasonTotalNet));
  const winnerName = standings[0] ? standings[0].name : "N/A";
  const topScore = standings[0] ? standings[0].netScore : 0;

  // Build High-Fidelity HTML Email Template matching the Web App Dashboard Card
  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Inter', system-ui, -apple-system, sans-serif; background-color: #060913; color: #f8fafc; margin: 0; padding: 20px; }
        .card-wrapper { max-width: 800px; margin: 0 auto; background: rgba(19, 27, 46, 0.95); border-radius: 16px; padding: 24px; border: 1px solid rgba(255,255,255,0.12); box-shadow: 0 16px 40px rgba(0,0,0,0.6); }
        .card-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.1); margin-bottom: 16px; }
        .header-title { font-size: 18px; font-weight: 800; color: #ffffff; margin: 0; }
        .league-name-highlight { color: #04f5ff; }
        .gw-badge { background: #04f5ff; color: #060913; font-weight: 900; font-size: 12px; padding: 4px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px; }
        
        .motm-banner { display: flex; align-items: center; justify-content: space-between; padding: 12px 18px; margin-bottom: 16px; border-radius: 8px; font-size: 14px; font-weight: 700; background: linear-gradient(135deg, #fcd34d, #f59e0b); color: #3b1700; border: 1px solid #eab308; box-shadow: 0 4px 16px rgba(234, 179, 8, 0.3); }
        .motm-name { font-size: 15px; font-weight: 900; padding: 2px 10px; border-radius: 6px; background: #3b1700; color: #fcd34d; margin-left: 6px; }

        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { background: rgba(6, 9, 19, 0.6); color: #94a3b8; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; padding: 12px 10px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.1); }
        th.text-left { text-align: left; }
        th.text-right { text-align: right; }
        td { padding: 14px 10px; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 14px; vertical-align: middle; }

        .rank-circle { width: 30px; height: 30px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-weight: 900; font-size: 13px; margin: 0 auto; color: #fff; }
        .manager-name { font-weight: 800; color: #f8fafc; font-size: 14px; }
        .team-name { font-size: 12px; color: #94a3b8; margin-top: 2px; }
        
        .net-pts { font-weight: 900; color: #04f5ff; font-size: 15px; text-align: center; }
        .season-pts { font-weight: 800; color: #e2e8f0; text-align: center; }
        .season-top { color: #f59e0b; font-weight: 900; text-shadow: 0 0 8px rgba(245,158,11,0.4); }

        .chip-tag { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 800; text-transform: uppercase; background: rgba(99,102,241,0.2); color: #818cf8; border: 1px solid rgba(99,102,241,0.4); }
        
        .form-pill { display: inline-block; width: 18px; height: 18px; line-height: 18px; border-radius: 50%; font-size: 10px; font-weight: 900; text-align: center; margin: 0 1px; color: #fff; }
        .form-w { background: #10b981; }
        .form-l { background: #ef4444; }
        .form-n { background: #64748b; }

        .payout-badge { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 13px; font-weight: 900; text-align: right; }
        .payout-win { background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); }
        .payout-loss { background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); }
        .payout-neutral { background: rgba(148, 163, 184, 0.15); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.3); }
        .payout-note { display: block; font-size: 10px; color: #94a3b8; margin-top: 3px; font-weight: 600; }

        .footer { text-align: center; margin-top: 20px; font-size: 11px; color: #64748b; font-family: sans-serif; }
        .demo-tag { background: #f59e0b; color: #000; font-size: 10px; font-weight: 900; padding: 3px 8px; border-radius: 4px; display: inline-block; letter-spacing: 0.5px; }
      </style>
    </head>
    <body>
      <div class="card-wrapper">
        <div class="card-header">
          <div>
            ${isDemoMode ? '<div class="demo-tag">DEMO PREVIEW DATA</div><br>' : ''}
            <h1 class="header-title">Gameweek Standings &amp; Weekly Payouts — <span class="league-name-highlight">${leagueName}</span></h1>
          </div>
          <div>
            <span class="gw-badge">Gameweek ${currentGw}</span>
          </div>
        </div>

        <div class="motm-banner">
          <span>🏆 <strong>Gameweek ${currentGw} Winner</strong>: <span class="motm-name">${winnerName} (${topScore} pts)</span></span>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width:40px;">Pos</th>
              <th class="text-left">Manager &amp; Team</th>
              <th>Gross</th>
              <th>Transfers</th>
              <th>Net Pts</th>
              <th>Season Pts</th>
              <th>Chip Used</th>
              <th>Form (Last 5)</th>
              <th class="text-right">GW Payout</th>
            </tr>
          </thead>
          <tbody>
            ${standings.map(m => `
              <tr>
                <td style="text-align:center;">
                  <div class="rank-circle" style="background:${m.rankBg};">${m.rank}</div>
                </td>
                <td class="text-left">
                  <div class="manager-name">${m.name}</div>
                  <div class="team-name">${m.teamName}</div>
                </td>
                <td style="text-align:center;font-weight:700;color:#94a3b8;">${m.grossScore}</td>
                <td style="text-align:center;font-weight:700;color:#cbd5e1;">
                  ${m.transfers}${m.hitCost > 0 ? ` <span style="color:#ef4444;font-size:11px;">(-${m.hitCost})</span>` : ''}
                </td>
                <td class="net-pts">${m.netScore}</td>
                <td class="season-pts ${m.seasonTotalNet === maxSeasonPts ? 'season-top' : ''}">${m.seasonTotalNet}</td>
                <td style="text-align:center;">
                  ${m.chip ? `<span class="chip-tag">${getChipLabel(m.chip)}</span>` : '<span style="color:#64748b;">-</span>'}
                </td>
                <td style="text-align:center;">
                  ${m.form.map(c => `<span class="form-pill ${c === 'W' ? 'form-w' : c === 'L' ? 'form-l' : 'form-n'}">${c}</span>`).join('')}
                </td>
                <td class="text-right">
                  <span class="payout-badge ${m.payout > 0 ? 'payout-win' : m.payout < 0 ? 'payout-loss' : 'payout-neutral'}">
                    ${m.payout > 0 ? `+$${m.payout}.00` : m.payout < 0 ? `-$${Math.abs(m.payout)}.00` : `$0.00`}
                  </span>
                  <span class="payout-note">${m.note}</span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          <p>Automated Email Report generated by FPL League Dashboard Notifier</p>
        </div>
      </div>
    </body>
    </html>
  `;

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
      subject: `🏆 Gameweek ${currentGw} Results: ${leagueName}`,
      html: emailHtml
    })
  });

  if (resendResp.ok) {
    const resData = await resendResp.json();
    console.log('✅ Email sent successfully! ID:', resData.id);
  } else {
    const errText = await resendResp.text();
    console.error('❌ Failed to send email via Resend:', errText);
    process.exit(1);
  }
}

run();
