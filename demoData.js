// FPL Private League Demo Dataset with 2 Sets of Chips per Season (Official 8 Chips System)
window.DEMO_DATA = {
  leagueName: "Clash of Elite Fantasy League",
  entryFee: 3.00,
  
  // Official FPL 8 Chips List (2 of each chip: Set 1 for GW1-19, Set 2 for GW20-38)
  chipTypes: [
    "Wildcard 1", "Wildcard 2",
    "Free Hit 1", "Free Hit 2",
    "Bench Boost 1", "Bench Boost 2",
    "Triple Captain 1", "Triple Captain 2"
  ],

  // 7 Managers
  managers: [
    { id: 1, name: "Alex Turner", teamName: "Turner's Titans", avatar: "AT" },
    { id: 2, name: "Sarah Chen", teamName: "Chen FC", avatar: "SC" },
    { id: 3, name: "Marcus Vance", teamName: "Vance Vanguard", avatar: "MV" },
    { id: 4, name: "Elena Rostova", teamName: "Rostova Rockets", avatar: "ER" },
    { id: 5, name: "Dave Miller", teamName: "Miller's Mavericks", avatar: "DM" },
    { id: 6, name: "James Sterling", teamName: "Sterling XI", avatar: "JS" },
    { id: 7, name: "Tom Wright", teamName: "Wright's Warriors", avatar: "TW" }
  ],

  // Calendar Months mapping for MOTM
  months: [
    { name: "August", gws: [1, 2, 3] },
    { name: "September", gws: [4, 5, 6] },
    { name: "October", gws: [7, 8, 9, 10] }
  ],

  // Gameweeks 1 to 10 with Gross Scores, Transfer Hits, Bench Points, Captain Points, & Chips Used
  gameweeks: [
    {
      gw: 1,
      finished: true,
      data_checked: true,
      bonus_added: true,
      leagues: "Updated",
      scores: { 1: 78, 2: 65, 3: 82, 4: 54, 5: 60, 6: 71, 7: 48 },
      hits: { 1: 0, 2: 0, 3: 4, 4: 0, 5: 0, 6: 0, 7: 4 },
      transfers: { 1: 0, 2: 0, 3: 2, 4: 0, 5: 0, 6: 0, 7: 2 },
      benchPoints: { 1: 12, 2: 8, 3: 4, 4: 15, 5: 6, 6: 10, 7: 2 },
      captainPoints: { 1: 24, 2: 18, 3: 26, 4: 14, 5: 16, 6: 22, 7: 12 },
      chipsUsed: { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null, 7: null }
    },
    {
      gw: 2,
      scores: { 1: 62, 2: 74, 3: 58, 4: 69, 5: 55, 6: 61, 7: 50 },
      hits: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 4, 6: 0, 7: 0 },
      transfers: { 1: 1, 2: 1, 3: 1, 4: 0, 5: 2, 6: 1, 7: 1 },
      benchPoints: { 1: 6, 2: 14, 3: 8, 4: 10, 5: 3, 6: 5, 7: 11 },
      captainPoints: { 1: 16, 2: 22, 3: 14, 4: 20, 5: 12, 6: 18, 7: 10 },
      chipsUsed: { 1: null, 2: null, 3: null, 4: "Wildcard 1", 5: null, 6: null, 7: null }
    },
    {
      gw: 3,
      scores: { 1: 85, 2: 68, 3: 79, 4: 62, 5: 71, 6: 58, 7: 64 },
      hits: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 },
      transfers: { 1: 1, 2: 1, 3: 2, 4: 1, 5: 1, 6: 0, 7: 1 },
      benchPoints: { 1: 15, 2: 9, 3: 11, 4: 6, 5: 8, 6: 12, 7: 4 },
      captainPoints: { 1: 28, 2: 16, 3: 24, 4: 18, 5: 22, 6: 14, 7: 20 },
      chipsUsed: { 1: "Triple Captain 1", 2: null, 3: null, 4: null, 5: null, 6: null, 7: null }
    },
    {
      gw: 4,
      scores: { 1: 59, 2: 81, 3: 67, 4: 73, 5: 70, 6: 64, 7: 52 },
      hits: { 1: 4, 2: 0, 3: 0, 4: 0, 5: 0, 6: 4, 7: 0 },
      transfers: { 1: 2, 2: 1, 3: 1, 4: 1, 5: 1, 6: 2, 7: 0 },
      benchPoints: { 1: 4, 2: 16, 3: 7, 4: 12, 5: 9, 6: 6, 7: 8 },
      captainPoints: { 1: 14, 2: 26, 3: 18, 4: 22, 5: 20, 6: 16, 7: 12 },
      chipsUsed: { 1: null, 2: "Bench Boost 1", 3: null, 4: null, 5: null, 6: null, 7: null }
    },
    {
      gw: 5,
      scores: { 1: 73, 2: 70, 3: 88, 4: 59, 5: 66, 6: 72, 7: 61 },
      hits: { 1: 0, 2: 0, 3: 0, 4: 4, 5: 0, 6: 0, 7: 0 },
      transfers: { 1: 1, 2: 1, 3: 0, 4: 2, 5: 1, 6: 1, 7: 1 },
      benchPoints: { 1: 10, 2: 8, 3: 18, 4: 5, 5: 11, 6: 9, 7: 7 },
      captainPoints: { 1: 22, 2: 20, 3: 30, 4: 14, 5: 18, 6: 24, 7: 16 },
      chipsUsed: { 1: null, 2: null, 3: "Free Hit 1", 4: null, 5: null, 6: null, 7: null }
    },
    {
      gw: 6,
      scores: { 1: 68, 2: 76, 3: 63, 4: 71, 5: 82, 6: 60, 7: 55 },
      hits: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 4 },
      transfers: { 1: 1, 2: 2, 3: 1, 4: 1, 5: 0, 6: 1, 7: 2 },
      benchPoints: { 1: 7, 2: 12, 3: 6, 4: 9, 5: 15, 6: 4, 7: 3 },
      captainPoints: { 1: 20, 2: 24, 3: 16, 4: 22, 5: 28, 6: 14, 7: 12 },
      chipsUsed: { 1: null, 2: null, 3: null, 4: null, 5: "Wildcard 1", 6: null, 7: null }
    },
    {
      gw: 7,
      scores: { 1: 77, 2: 69, 3: 74, 4: 65, 5: 58, 6: 80, 7: 62 },
      hits: { 1: 0, 2: 4, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 },
      transfers: { 1: 1, 2: 2, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1 },
      benchPoints: { 1: 11, 2: 5, 3: 10, 4: 8, 5: 6, 6: 14, 7: 9 },
      captainPoints: { 1: 24, 2: 18, 3: 22, 4: 16, 5: 14, 6: 26, 7: 18 },
      chipsUsed: { 1: null, 2: null, 3: null, 4: null, 5: null, 6: "Triple Captain 1", 7: null }
    },
    {
      gw: 8,
      scores: { 1: 65, 2: 72, 3: 80, 4: 68, 5: 75, 6: 62, 7: 59 },
      hits: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 },
      transfers: { 1: 1, 2: 1, 3: 0, 4: 1, 5: 1, 6: 1, 7: 1 },
      benchPoints: { 1: 8, 2: 11, 3: 13, 4: 7, 5: 10, 6: 5, 7: 6 },
      captainPoints: { 1: 18, 2: 22, 3: 26, 4: 20, 5: 24, 6: 16, 7: 14 },
      chipsUsed: { 1: null, 2: null, 3: "Wildcard 1", 4: null, 5: null, 6: null, 7: null }
    },
    {
      gw: 9,
      scores: { 1: 82, 2: 64, 3: 71, 4: 77, 5: 63, 6: 69, 7: 56 },
      hits: { 1: 0, 2: 0, 3: 4, 4: 0, 5: 0, 6: 0, 7: 0 },
      transfers: { 1: 1, 2: 1, 3: 2, 4: 1, 5: 1, 6: 1, 7: 1 },
      benchPoints: { 1: 14, 2: 6, 3: 5, 4: 13, 5: 8, 6: 10, 7: 4 },
      captainPoints: { 1: 26, 2: 14, 3: 20, 4: 24, 5: 16, 6: 22, 7: 12 },
      chipsUsed: { 1: "Bench Boost 1", 2: null, 3: null, 4: null, 5: null, 6: null, 7: null }
    },
    {
      gw: 10,
      finished: true,
      data_checked: false,
      bonus_added: true,
      leagues: "Updating",
      daily_status: [
        { date: "2023-10-27", points: "r", bonus_added: true },
        { date: "2023-10-28", points: "r", bonus_added: true },
        { date: "2023-10-29", points: "p", bonus_added: false }
      ],
      scores: { 1: 70, 2: 85, 3: 66, 4: 72, 5: 70, 6: 68, 7: 61 },
      hits: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 4, 6: 0, 7: 0 },
      transfers: { 1: 1, 2: 0, 3: 1, 4: 1, 5: 2, 6: 1, 7: 0 },
      benchPoints: { 1: 9, 2: 15, 3: 7, 4: 11, 5: 10, 6: 8, 7: 5 },
      captainPoints: { 1: 22, 2: 28, 3: 18, 4: 24, 5: 20, 6: 20, 7: 16 },
      chipsUsed: { 1: null, 2: "Wildcard 1", 3: null, 4: null, 5: null, 6: null, 7: "Wildcard 1" }
    }
  ]
};
