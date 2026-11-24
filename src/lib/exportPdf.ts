import { jsPDF } from "jspdf";
import { Match, Player, Pot, Team } from "@/types/tournament";
import { getMatchScore } from "@/lib/stats";

const NAVY: [number, number, number] = [15, 37, 87];
const GOLD: [number, number, number] = [212, 155, 53];
const LIGHT_BG: [number, number, number] = [241, 245, 252];
const BORDER: [number, number, number] = [195, 206, 224];
const TEXT_DARK: [number, number, number] = [20, 30, 50];
const TEXT_MUTED: [number, number, number] = [95, 108, 130];

async function fetchLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch("/logo-copa-hosteria.jpg");
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function drawHeader(
  doc: jsPDF,
  logoDataUrl: string | null,
  title: string,
  subtitle: string
) {
  const pageW = doc.internal.pageSize.getWidth();

  // Top navy banner
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, 28, "F");

  // Gold bottom accent bar
  doc.setFillColor(...GOLD);
  doc.rect(0, 28, pageW, 1.5, "F");

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "JPEG", 12, 4, 20, 20);
  }

  const textX = logoDataUrl ? 36 : 14;
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("COPA HOSTERÍA · 4° EDICIÓN (28.11.2026)", textX, 12);

  doc.setTextColor(240, 196, 107);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(title.toUpperCase(), textX, 19);

  doc.setTextColor(210, 222, 245);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(subtitle, textX, 24.5);
}

function drawFooter(doc: jsPDF, pageNumber: number, totalPages: number) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...BORDER);
  doc.line(12, pageH - 12, pageW - 12, pageH - 12);
  doc.setTextColor(...TEXT_MUTED);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Copa Hostería · Planilla Oficial para Planillero", 12, pageH - 7);
  doc.text(`Página ${pageNumber} de ${totalPages}`, pageW - 12, pageH - 7, {
    align: "right",
  });
}

function drawTeamRosterTable(
  doc: jsPDF,
  team: Team,
  playerMap: Map<string, Player>,
  x: number,
  y: number,
  w: number
): number {
  const rowH = 7;
  const headerH = 8;

  // Team title bar
  const dtPlayer = team.dtId ? playerMap.get(team.dtId) : undefined;
  doc.setFillColor(...NAVY);
  doc.rect(x, y, w, headerH, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text(team.name.toUpperCase(), x + 3, y + 5.4);
  if (dtPlayer) {
    doc.setTextColor(240, 196, 107);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(`DT: ${dtPlayer.name}`.slice(0, 26), x + w - 3, y + 5.3, {
      align: "right",
    });
  }

  // Column headers
  const colHeaderY = y + headerH;
  doc.setFillColor(...LIGHT_BG);
  doc.rect(x, colHeaderY, w, 6, "F");
  doc.setDrawColor(...BORDER);
  doc.rect(x, colHeaderY, w, 6, "S");

  const colN = x + 2;
  const colName = x + 10;
  const colG = x + w - 16;
  const colA = x + w - 7;

  doc.setTextColor(...TEXT_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("N°", colN, colHeaderY + 4.2);
  doc.text("Jugador", colName, colHeaderY + 4.2);
  doc.text("G", colG, colHeaderY + 4.2, { align: "center" });
  doc.text("A", colA, colHeaderY + 4.2, { align: "center" });

  let cursorY = colHeaderY + 6;
  const playersCount = Math.max(team.playerIds.length, 7);

  for (let i = 0; i < playersCount; i++) {
    const pid = team.playerIds[i];
    const player = pid ? playerMap.get(pid) : undefined;

    if (i % 2 === 1) {
      doc.setFillColor(249, 251, 255);
      doc.rect(x, cursorY, w, rowH, "F");
    }

    doc.setDrawColor(...BORDER);
    doc.rect(x, cursorY, w, rowH, "S");

    // Vertical column dividers
    doc.line(x + 8.5, cursorY, x + 8.5, cursorY + rowH);
    doc.line(x + w - 20.5, cursorY, x + w - 20.5, cursorY + rowH);
    doc.line(x + w - 11.5, cursorY, x + w - 11.5, cursorY + rowH);

    if (player) {
      const cap = team.captainId === pid ? " (C)" : "";
      const stars = player.stars > 0 ? ` (${"*".repeat(player.stars)})` : "";
      const label = `${player.name}${cap}${stars}`;
      doc.setTextColor(...TEXT_DARK);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(label.slice(0, 32), colName, cursorY + 4.8);
    }

    cursorY += rowH;
  }

  return cursorY;
}

function renderSingleMatchPage(
  doc: jsPDF,
  logoDataUrl: string | null,
  match: Match,
  teamMap: Map<string, Team>,
  playerMap: Map<string, Player>
) {
  const pageW = doc.internal.pageSize.getWidth();
  const home = teamMap.get(match.homeTeamId);
  const away = teamMap.get(match.awayTeamId);
  const score = getMatchScore(match);

  drawHeader(
    doc,
    logoDataUrl,
    `Planilla de Partido · ${match.roundLabel}`,
    `${home?.name ?? "Local"} vs ${away?.name ?? "Visitante"}`
  );

  // Scoreboard box
  const boxY = 35;
  doc.setFillColor(...LIGHT_BG);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.5);
  doc.roundedRect(12, boxY, pageW - 24, 24, 3, 3, "FD");
  doc.setLineWidth(0.2);

  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text((home?.name ?? "LOCAL").toUpperCase(), 48, boxY + 11, {
    align: "center",
  });
  doc.text((away?.name ?? "VISITANTE").toUpperCase(), pageW - 48, boxY + 11, {
    align: "center",
  });

  // Score boxes
  const hasScore = match.status !== "pendiente" || match.events.length > 0;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...NAVY);
  doc.roundedRect(pageW / 2 - 22, boxY + 4, 16, 15, 2, 2, "FD");
  doc.roundedRect(pageW / 2 + 6, boxY + 4, 16, 15, 2, 2, "FD");

  doc.setFontSize(14);
  doc.setTextColor(...NAVY);
  doc.text("-", pageW / 2, boxY + 13.5, { align: "center" });
  if (hasScore) {
    doc.text(String(score.home), pageW / 2 - 14, boxY + 13.5, {
      align: "center",
    });
    doc.text(String(score.away), pageW / 2 + 14, boxY + 13.5, {
      align: "center",
    });
  }

  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("Cancha: ____________   Hora: ________", pageW / 2, boxY + 22, {
    align: "center",
  });

  const nextY = boxY + 30;

  // Two side-by-side roster tables
  const colW = (pageW - 30) / 2;
  let bottomLeft = nextY;
  let bottomRight = nextY;

  if (home) {
    bottomLeft = drawTeamRosterTable(
      doc,
      home,
      playerMap,
      12,
      nextY,
      colW
    );
  }
  if (away) {
    bottomRight = drawTeamRosterTable(
      doc,
      away,
      playerMap,
      18 + colW,
      nextY,
      colW
    );
  }

  let notesY = Math.max(bottomLeft, bottomRight) + 7;

  // Legend
  doc.setTextColor(...TEXT_MUTED);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.text(
    "Referencias: G = Goles · A = Asistencias · (C) = Capitán · (*) = Estrellas de campeón",
    12,
    notesY
  );
  notesY += 6;

  // Events log or blank lines for handwritten notes
  doc.setFillColor(...NAVY);
  doc.rect(12, notesY, pageW - 24, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("DETALLE DE GOLES, ASISTENCIAS Y OBSERVACIONES", 15, notesY + 4.8);
  notesY += 7;

  const notesBoxH = Math.max(40, 252 - notesY);
  doc.setDrawColor(...BORDER);
  doc.rect(12, notesY, pageW - 24, notesBoxH, "S");

  const goalEvents = match.events.filter((ev) => ev.type === "gol");
  if (goalEvents.length > 0) {
    doc.setTextColor(...TEXT_DARK);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    goalEvents.slice(0, 12).forEach((ev, idx) => {
      const pName = playerMap.get(ev.playerId)?.name ?? "Jugador";
      const tName = teamMap.get(ev.teamId)?.name ?? "";
      const assistName = ev.assistPlayerId
        ? playerMap.get(ev.assistPlayerId)?.name
        : null;
      const typeLabel = `GOL${assistName ? ` (Asist: ${assistName})` : ""}`;
      doc.text(
        `${idx + 1}. [${tName}] ${pName} — ${typeLabel}`,
        15,
        notesY + 5.5 + idx * 5.2
      );
    });
  } else {
    // Ruled lines for pen & paper
    doc.setDrawColor(222, 229, 240);
    for (let ly = notesY + 8; ly < notesY + notesBoxH - 3; ly += 8) {
      doc.line(15, ly, pageW - 15, ly);
    }
  }

  // Signatures
  const sigY = 272;
  doc.setDrawColor(...TEXT_MUTED);
  doc.line(16, sigY, 68, sigY);
  doc.line(pageW / 2 - 26, sigY, pageW / 2 + 26, sigY);
  doc.line(pageW - 68, sigY, pageW - 16, sigY);

  doc.setTextColor(...TEXT_MUTED);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Planillero", 42, sigY + 4.5, { align: "center" });
  doc.text("Árbitro", pageW / 2, sigY + 4.5, { align: "center" });
  doc.text("Organización", pageW - 42, sigY + 4.5, { align: "center" });
}

export async function exportTeamsSheetPdf(
  teams: Team[],
  players: Player[],
  matches: Match[]
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const logoDataUrl = await fetchLogoDataUrl();
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const pageW = doc.internal.pageSize.getWidth();
  const colW = (pageW - 30) / 2;

  drawHeader(
    doc,
    logoDataUrl,
    "Planilla Oficial de Equipos y Planteles",
    `${teams.length} equipos · Lista para control del planillero en cancha`
  );

  let yLeft = 36;
  let yRight = 36;

  teams.forEach((team, idx) => {
    const isLeft = idx % 2 === 0;
    const x = isLeft ? 12 : 18 + colW;
    const currentY = isLeft ? yLeft : yRight;

    // Add page if overflowing
    if (currentY > 210) {
      doc.addPage();
      drawHeader(
        doc,
        logoDataUrl,
        "Planilla Oficial de Equipos (Cont.)",
        "Lista para control del planillero en cancha"
      );
      yLeft = 36;
      yRight = 36;
    }

    const startY = isLeft ? yLeft : yRight;
    const endY = drawTeamRosterTable(doc, team, playerMap, x, startY, colW);
    if (isLeft) yLeft = endY + 7;
    else yRight = endY + 7;
  });

  // Add fixture summary sheet if matches exist
  if (matches.length > 0) {
    doc.addPage();
    renderFixtureSummaryPage(doc, logoDataUrl, teams, matches);
  }

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter(doc, p, totalPages);
  }

  doc.save("copa-hosteria-2026-planilla-equipos.pdf");
}

function renderFixtureSummaryPage(
  doc: jsPDF,
  logoDataUrl: string | null,
  teams: Team[],
  matches: Match[]
) {
  const pageW = doc.internal.pageSize.getWidth();
  const teamMap = new Map(teams.map((t) => [t.id, t]));

  drawHeader(
    doc,
    logoDataUrl,
    "Fixture Oficial · Resumen de Fechas",
    `${matches.length} partidos programados`
  );

  const sorted = [...matches].sort((a, b) => {
    if (a.round !== b.round) return a.round - b.round;
    return a.createdAt.localeCompare(b.createdAt);
  });

  let cursorY = 36;
  let lastRound = "";

  for (const m of sorted) {
    if (cursorY > 265) {
      doc.addPage();
      drawHeader(
        doc,
        logoDataUrl,
        "Fixture Oficial · Resumen de Fechas (Cont.)",
        `${matches.length} partidos programados`
      );
      cursorY = 36;
    }

    if (m.roundLabel !== lastRound) {
      lastRound = m.roundLabel;
      doc.setFillColor(...NAVY);
      doc.rect(12, cursorY, pageW - 24, 7, "F");
      doc.setTextColor(240, 196, 107);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(m.roundLabel.toUpperCase(), 15, cursorY + 4.8);
      cursorY += 7;
    }

    const home = teamMap.get(m.homeTeamId)?.name ?? m.homePlaceholder ?? "Local";
    const away = teamMap.get(m.awayTeamId)?.name ?? m.awayPlaceholder ?? "Visitante";
    const score = getMatchScore(m);
    const hasScore = m.status !== "pendiente" || m.events.length > 0;

    doc.setDrawColor(...BORDER);
    doc.rect(12, cursorY, pageW - 24, 8.5, "S");
    doc.setTextColor(...TEXT_DARK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(home, pageW / 2 - 18, cursorY + 5.7, { align: "right" });
    doc.text(away, pageW / 2 + 18, cursorY + 5.7, { align: "left" });

    doc.setDrawColor(...NAVY);
    doc.rect(pageW / 2 - 14, cursorY + 1.3, 10, 6, "S");
    doc.rect(pageW / 2 + 4, cursorY + 1.3, 10, 6, "S");
    doc.text("-", pageW / 2, cursorY + 5.7, { align: "center" });

    if (hasScore) {
      doc.text(String(score.home), pageW / 2 - 9, cursorY + 5.7, {
        align: "center",
      });
      doc.text(String(score.away), pageW / 2 + 9, cursorY + 5.7, {
        align: "center",
      });
    }

    cursorY += 8.5;
  }
}

export async function exportMatchSheetPdf(
  match: Match,
  teams: Team[],
  players: Player[],
  _allMatches?: Match[]
) {
  void _allMatches;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const logoDataUrl = await fetchLogoDataUrl();
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const playerMap = new Map(players.map((p) => [p.id, p]));

  renderSingleMatchPage(doc, logoDataUrl, match, teamMap, playerMap);
  drawFooter(doc, 1, 1);

  const homeSlug = (teamMap.get(match.homeTeamId)?.name ?? "local")
    .toLowerCase()
    .replace(/\s+/g, "-");
  const awaySlug = (teamMap.get(match.awayTeamId)?.name ?? "visitante")
    .toLowerCase()
    .replace(/\s+/g, "-");
  doc.save(`copa-hosteria-planilla-${homeSlug}-vs-${awaySlug}.pdf`);
}

export async function exportFullFixturePdf(
  teams: Team[],
  players: Player[],
  matches: Match[]
) {
  if (matches.length === 0) return;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const logoDataUrl = await fetchLogoDataUrl();
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const playerMap = new Map(players.map((p) => [p.id, p]));

  // Page 1: Fixture summary
  renderFixtureSummaryPage(doc, logoDataUrl, teams, matches);

  // Subsequent pages: 1 printable match sheet per match
  const sorted = [...matches].sort((a, b) => {
    if (a.round !== b.round) return a.round - b.round;
    return a.createdAt.localeCompare(b.createdAt);
  });

  for (const match of sorted) {
    doc.addPage();
    renderSingleMatchPage(doc, logoDataUrl, match, teamMap, playerMap);
  }

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter(doc, p, totalPages);
  }

  doc.save("copa-hosteria-2026-planillas-partidos.pdf");
}

export async function exportTournamentRulesPdf(teams: Team[] = []) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const logoDataUrl = await fetchLogoDataUrl();
  const pageW = doc.internal.pageSize.getWidth();

  drawHeader(
    doc,
    logoDataUrl,
    "Reglamento Oficial del Torneo",
    "Formato de disputa, sistema de puntuación, desempates y fase final"
  );

  const teamName = (idx: number) => teams[idx]?.name ?? `Equipo ${idx + 1}`;

  let y = 36;

  const drawSectionHeader = (num: string, title: string) => {
    doc.setFillColor(...NAVY);
    doc.roundedRect(12, y, pageW - 24, 8, 1.8, 1.8, "F");
    doc.setFillColor(...GOLD);
    doc.roundedRect(12, y, 10, 8, 1.8, 1.8, "F");

    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(num, 17, y + 5.5, { align: "center" });

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(title.toUpperCase(), 25, y + 5.5);
    y += 11.5;
  };

  const drawBullet = (boldPrefix: string, rest: string) => {
    doc.setFillColor(...GOLD);
    doc.circle(15.5, y - 1.1, 1, "F");
    doc.setTextColor(...TEXT_DARK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(boldPrefix, 18.5, y);
    const prefixW = doc.getTextWidth(boldPrefix);
    doc.setFont("helvetica", "normal");
    const wrapped = doc.splitTextToSize(rest, pageW - 32 - prefixW);
    doc.text(wrapped[0] ?? "", 18.5 + prefixW + 1, y);
    if (wrapped.length > 1) {
      for (let i = 1; i < wrapped.length; i++) {
        y += 4.6;
        doc.text(wrapped[i], 18.5, y);
      }
    }
    y += 5.6;
  };

  // SECTION 1: FORMATO GENERAL
  drawSectionHeader("1", "Formato General y Equipos");
  drawBullet(
    "Participantes:",
    "7 equipos de 6 jugadores cada uno (42 jugadores confirmados), conformados por sorteo oficial con 6 bombos (Bombo 1 de Arqueros + Bombos B a F)."
  );
  drawBullet(
    "Identificación de Equipos:",
    `1. ${teamName(0)} (Blanco) · 2. ${teamName(1)} (Rojo) · 3. ${teamName(2)} (Amarillo) · 4. ${teamName(3)} (Verde) · 5. ${teamName(4)} (Violeta) · 6. ${teamName(5)} (Negro) · 7. ${teamName(6)} (Naranja).`
  );
  y += 2;

  // SECTION 2: FASE DE GRUPOS Y PUNTUACIÓN
  drawSectionHeader("2", "Fase de Grupos (Tabla Única · 7 Partidos)");
  drawBullet(
    "Modalidad:",
    "Los 7 equipos compiten en una Tabla Única de posiciones. Cada equipo disputa exactamente 2 partidos en la Fase de Grupos (F1 a F7)."
  );
  drawBullet(
    "Puntaje:",
    "La victoria suma 3 puntos, el empate suma 1 punto y la derrota 0 puntos."
  );

  // Compact 7-match schedule box
  const schedItems = [
    ["F1", "15:30 hs", `${teamName(0)}  vs.  ${teamName(3)}`],
    ["F2", "16:00 hs", `${teamName(1)}  vs.  ${teamName(6)}`],
    ["F3", "16:40 hs", `${teamName(4)}  vs.  ${teamName(2)}`],
    ["F4", "17:20 hs", `${teamName(5)}  vs.  ${teamName(0)}`],
    ["F5", "18:00 hs", `${teamName(3)}  vs.  ${teamName(1)}`],
    ["F6", "18:40 hs", `${teamName(6)}  vs.  ${teamName(4)}`],
    ["F7", "19:20 hs", `${teamName(2)}  vs.  ${teamName(5)}`],
  ];

  const boxH = 7 + schedItems.length * 6;
  doc.setFillColor(...LIGHT_BG);
  doc.setDrawColor(...BORDER);
  doc.roundedRect(15, y, pageW - 30, boxH, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...NAVY);
  doc.text("CRONOGRAMA OFICIAL · FASE DE GRUPOS", 19, y + 5);

  schedItems.forEach(([code, time, matchup], idx) => {
    const rowY = y + 10 + idx * 6;
    doc.setFillColor(...GOLD);
    doc.roundedRect(19, rowY - 3.6, 12, 4.8, 1, 1, "F");
    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.8);
    doc.text(code, 25, rowY, { align: "center" });

    doc.setTextColor(...TEXT_DARK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(matchup, 36, rowY);

    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.2);
    doc.text(time.toUpperCase(), pageW - 20, rowY, { align: "right" });
  });

  y += boxH + 5.5;

  // SECTION 3: CLASIFICACIÓN Y CRITERIOS DE DESEMPATE
  drawSectionHeader("3", "Clasificación a Semifinales y Criterios de Desempate");
  drawBullet(
    "Clasificación:",
    "Para definir los cruces de semifinales, clasificarán los primeros cuatro (4) equipos que mayores puntos tengan en la Tabla Única (la victoria suma 3 puntos y el empate 1 punto)."
  );

  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(
    "En caso de empate en puntos entre dos o más equipos, se define en el siguiente orden:",
    15.5,
    y
  );
  y += 3.5;

  const tiebreakers = [
    ["1° Criterio", "Mayor diferencia de gol (DG = Goles a favor menos Goles en contra)."],
    ["2° Criterio", "Mayor cantidad de goles a favor (GF)."],
    ["3° Criterio", "Menos goles en contra (GC)."],
    ["4° Criterio", "Se tira la moneda (sorteo directo en mesa de control)."],
  ];

  const tbBoxH = 4 + tiebreakers.length * 6.5;
  doc.setFillColor(254, 249, 235);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.45);
  doc.roundedRect(15, y, pageW - 30, tbBoxH, 2, 2, "FD");
  doc.setLineWidth(0.2);

  tiebreakers.forEach(([stepLabel, desc], idx) => {
    const rowY = y + 6 + idx * 6.5;
    doc.setFillColor(...NAVY);
    doc.roundedRect(19, rowY - 3.7, 22, 5, 1, 1, "F");
    doc.setTextColor(245, 206, 120);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.8);
    doc.text(stepLabel.toUpperCase(), 30, rowY, { align: "center" });

    doc.setTextColor(...TEXT_DARK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.8);
    doc.text(desc, 45, rowY);
  });

  y += tbBoxH + 6;

  // SECTION 4: FASE FINAL (SEMIFINALES Y FINAL)
  drawSectionHeader("4", "Fase Final (Semifinales y Gran Final)");
  drawBullet(
    "SEMI 1 (20:00 HS):",
    "1° Zona  vs.  4° Zona  (eliminación directa a un partido)."
  );
  drawBullet(
    "SEMI 2 (20:40 HS):",
    "2° Zona  vs.  3° Zona  (eliminación directa a un partido)."
  );
  drawBullet(
    "GRAN FINAL (21:30 HS):",
    "Ganador SEMI 1  vs.  Ganador SEMI 2."
  );
  drawBullet(
    "Definición en Mata-Mata:",
    "En caso de empate en las Semifinales o en la Gran Final, el ganador se define por tanda de penales."
  );
  y += 2;

  // SECTION 5: PLANILLA Y ESTADÍSTICAS
  drawSectionHeader("5", "Planilla Oficial y Estadísticas");
  drawBullet(
    "Goles y Asistencias:",
    "En cada partido el planillero registra todos los goles y asistencias para el ranking de la 4° Edición y el historial general de la Copa Hostería."
  );
  drawBullet(
    "Sin Tarjetas:",
    "No se registran tarjetas en planilla."
  );

  // Footer without any URL
  const pageH = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...BORDER);
  doc.line(12, pageH - 12, pageW - 12, pageH - 12);
  doc.setTextColor(...TEXT_MUTED);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("Copa Hostería · 4° Edición (28.11.2026)", 12, pageH - 7);
  doc.setFont("helvetica", "normal");
  doc.text("Reglamento Oficial", pageW - 12, pageH - 7, {
    align: "right",
  });

  doc.save("copa-hosteria-reglamento-oficial-2026.pdf");
}

export async function exportDrawCutoutSheetsPdf(
  pots: Pot[],
  players: Player[]
) {
  if (pots.length === 0) return;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const logoDataUrl = await fetchLogoDataUrl();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const marginX = 12;

  const getBomboLetter = (pot: Pot, idx: number) => {
    const letters = ["A", "B", "C", "D", "E", "F", "G", "H"];
    return letters[idx] ?? String(pot.number);
  };

  // PAGE 1: Cut-out labels for each physical Bombo (A, B, C, D, E, F)
  drawHeader(
    doc,
    logoDataUrl,
    "Etiquetas Recortables para Cada Bombo (A - F)",
    "Cortar por la línea punteada para identificar cada recipiente o bolsa del sorteo"
  );

  const labelCols = 2;
  const labelGapX = 8;
  const labelGapY = 8;
  const labelW = (pageW - marginX * 2 - labelGapX) / labelCols;
  const labelH = 44;
  const labelStartY = 38;

  pots.forEach((pot, idx) => {
    const letter = getBomboLetter(pot, idx);
    const col = idx % labelCols;
    const row = Math.floor(idx / labelCols);
    const lx = marginX + col * (labelW + labelGapX);
    const ly = labelStartY + row * (labelH + labelGapY);

    // Dashed outer cut border
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(110, 125, 150);
    doc.setLineWidth(0.4);
    (
      doc as unknown as {
        setLineDashPattern: (p: number[], ph: number) => void;
      }
    ).setLineDashPattern([2.5, 2], 0);
    doc.rect(lx, ly, labelW, labelH, "FD");
    (
      doc as unknown as {
        setLineDashPattern: (p: number[], ph: number) => void;
      }
    ).setLineDashPattern([], 0);
    doc.setLineWidth(0.2);

    // Navy top header inside cut card
    doc.setFillColor(...NAVY);
    doc.rect(lx + 2, ly + 2, labelW - 4, 10, "F");
    doc.setTextColor(245, 206, 120);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("COPA HOSTERÍA · SORTEO OFICIAL", lx + labelW / 2, ly + 8.3, {
      align: "center",
    });

    // Big bold BOMBO A / B / C / D / E / F
    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(26);
    doc.text(`BOMBO ${letter}`, lx + labelW / 2, ly + 26, {
      align: "center",
    });

    // Subtitle without player count
    const isGoalkeepers = pot.name.toLowerCase().includes("arquero");
    const subLabel = isGoalkeepers
      ? "ARQUEROS"
      : "4° EDICIÓN · 28.11.2026";

    doc.setFillColor(...GOLD);
    doc.roundedRect(lx + 10, ly + 31, labelW - 20, 7.5, 1.5, 1.5, "F");
    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(subLabel, lx + labelW / 2, ly + 36, {
      align: "center",
    });
  });

  // PAGES 3+: Cut-out paper slips for players (2 Bombos per page, dashed cut lines)
  const slipCols = 2;
  const slipGapX = 6;
  const slipGapY = 3.5;
  const slipW = (pageW - marginX * 2 - slipGapX) / slipCols;
  const slipH = 19;

  for (let i = 0; i < pots.length; i += 2) {
    doc.addPage();
    drawHeader(
      doc,
      logoDataUrl,
      "Papelitos Recortables para Bolillero Físico",
      "Cortar por la línea punteada y doblar para colocar en cada bombo"
    );

    let y = 35;
    const pagePots = pots.slice(i, i + 2);

    pagePots.forEach((pot, localIdx) => {
      const potLetter = getBomboLetter(pot, i + localIdx);
      const isGoalkeepers = pot.name.toLowerCase().includes("arquero");

      // Bombo section bar
      doc.setFillColor(...NAVY);
      doc.roundedRect(marginX, y, pageW - marginX * 2, 7.5, 1.5, 1.5, "F");
      doc.setTextColor(245, 206, 120);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.text(
        `BOMBO ${potLetter}${isGoalkeepers ? " · ARQUEROS" : ""}  (${pot.playerIds.length} TITULARES${
          pot.reservePlayerIds && pot.reservePlayerIds.length > 0
            ? ` + ${pot.reservePlayerIds.length} SUPLENTE`
            : ""
        })`,
        marginX + 4,
        y + 5.2
      );
      y += 10.5;

      const entries: { player: Player; isReserve: boolean }[] = [];
      pot.playerIds.forEach((pid) => {
        const p = playerMap.get(pid);
        if (p) entries.push({ player: p, isReserve: false });
      });
      (pot.reservePlayerIds ?? []).forEach((rid) => {
        const rp = playerMap.get(rid);
        if (rp) entries.push({ player: rp, isReserve: true });
      });

      entries.forEach((entry, idx) => {
        const col = idx % slipCols;
        const row = Math.floor(idx / slipCols);
        const sx = marginX + col * (slipW + slipGapX);
        const sy = y + row * (slipH + slipGapY);

        // Dashed cut border
        doc.setFillColor(entry.isReserve ? 254 : 255, entry.isReserve ? 249 : 255, entry.isReserve ? 235 : 255);
        doc.setDrawColor(110, 125, 150);
        doc.setLineWidth(0.35);
        (doc as unknown as { setLineDashPattern: (p: number[], ph: number) => void }).setLineDashPattern([2.2, 2], 0);
        doc.rect(sx, sy, slipW, slipH, "FD");
        (doc as unknown as { setLineDashPattern: (p: number[], ph: number) => void }).setLineDashPattern([], 0);
        doc.setLineWidth(0.2);

        // Small Bombo tag on top-left of slip
        doc.setFillColor(...(entry.isReserve ? GOLD : NAVY));
        doc.rect(sx + 2.5, sy + 2.5, 26, 4.6, "F");
        doc.setTextColor(...(entry.isReserve ? NAVY : ([245, 206, 120] as [number, number, number])));
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.8);
        doc.text(
          entry.isReserve
            ? `BOMBO ${potLetter} · SUPL.`
            : `BOMBO ${potLetter}`,
          sx + 15.5,
          sy + 5.7,
          { align: "center" }
        );

        // Small tournament tag on top-right
        doc.setTextColor(...TEXT_MUTED);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.text("COPA HOSTERÍA", sx + slipW - 3, sy + 5.5, {
          align: "right",
        });

        // Big bold player name centered in the slip
        doc.setTextColor(...NAVY);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text(entry.player.name.toUpperCase(), sx + slipW / 2, sy + 14, {
          align: "center",
        });
      });

      const totalRows = Math.ceil(entries.length / slipCols);
      y += totalRows * (slipH + slipGapY) + 7;
    });
  }

  // Clean footers without any URL
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...BORDER);
    doc.line(12, pageH - 12, pageW - 12, pageH - 12);
    doc.setTextColor(...TEXT_MUTED);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("Copa Hostería · 4° Edición (28.11.2026)", 12, pageH - 7);
    doc.setFont("helvetica", "normal");
    doc.text(`Página ${p} de ${totalPages}`, pageW - 12, pageH - 7, {
      align: "right",
    });
  }

  doc.save("copa-hosteria-bombos-y-papelitos-2026.pdf");
}
