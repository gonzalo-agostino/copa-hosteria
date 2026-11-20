import { jsPDF } from "jspdf";
import { Match, Player, Team } from "@/types/tournament";
import { getMatchScore, getSuspendedPlayersForMatch } from "@/lib/stats";

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
  w: number,
  suspendedMap?: Map<string, string>
): number {
  const rowH = 7;
  const headerH = 8;

  // Team title bar
  doc.setFillColor(...NAVY);
  doc.rect(x, y, w, headerH, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text(team.name.toUpperCase(), x + 3, y + 5.4);

  // Column headers
  const colHeaderY = y + headerH;
  doc.setFillColor(...LIGHT_BG);
  doc.rect(x, colHeaderY, w, 6, "F");
  doc.setDrawColor(...BORDER);
  doc.rect(x, colHeaderY, w, 6, "S");

  const colN = x + 2;
  const colName = x + 10;
  const colG = x + w - 34;
  const colA = x + w - 25;
  const colTA = x + w - 16;
  const colTR = x + w - 7;

  doc.setTextColor(...TEXT_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("N°", colN, colHeaderY + 4.2);
  doc.text("Jugador", colName, colHeaderY + 4.2);
  doc.text("G", colG, colHeaderY + 4.2, { align: "center" });
  doc.text("A", colA, colHeaderY + 4.2, { align: "center" });
  doc.text("TA", colTA, colHeaderY + 4.2, { align: "center" });
  doc.text("TR", colTR, colHeaderY + 4.2, { align: "center" });

  let cursorY = colHeaderY + 6;
  const playersCount = Math.max(team.playerIds.length, 7);

  for (let i = 0; i < playersCount; i++) {
    const pid = team.playerIds[i];
    const player = pid ? playerMap.get(pid) : undefined;
    const isSuspended = pid ? suspendedMap?.has(pid) : false;

    if (i % 2 === 1) {
      doc.setFillColor(249, 251, 255);
      doc.rect(x, cursorY, w, rowH, "F");
    }

    doc.setDrawColor(...BORDER);
    doc.rect(x, cursorY, w, rowH, "S");

    // Vertical column dividers
    doc.line(x + 8.5, cursorY, x + 8.5, cursorY + rowH);
    doc.line(x + w - 38.5, cursorY, x + w - 38.5, cursorY + rowH);
    doc.line(x + w - 29.5, cursorY, x + w - 29.5, cursorY + rowH);
    doc.line(x + w - 20.5, cursorY, x + w - 20.5, cursorY + rowH);
    doc.line(x + w - 11.5, cursorY, x + w - 11.5, cursorY + rowH);

    if (player) {
      const stars = player.stars > 0 ? ` (${"*".repeat(player.stars)})` : "";
      const suspTag = isSuspended ? " [SUSP]" : "";
      const label = `${player.name}${stars}${suspTag}`;
      doc.setTextColor(isSuspended ? 185 : TEXT_DARK[0], isSuspended ? 28 : TEXT_DARK[1], isSuspended ? 28 : TEXT_DARK[2]);
      doc.setFont("helvetica", isSuspended ? "bold" : "normal");
      doc.setFontSize(8);
      doc.text(label.slice(0, 28), colName, cursorY + 4.8);
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
  playerMap: Map<string, Player>,
  allMatches: Match[]
) {
  const pageW = doc.internal.pageSize.getWidth();
  const home = teamMap.get(match.homeTeamId);
  const away = teamMap.get(match.awayTeamId);
  const score = getMatchScore(match);
  const suspended = getSuspendedPlayersForMatch(allMatches, match);

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

  let nextY = boxY + 30;

  // Suspension warning if applicable
  if (suspended.size > 0) {
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(220, 38, 38);
    const lines = Array.from(suspended.entries()).map(
      ([pid, reason]) => `• ${playerMap.get(pid)?.name ?? "Jugador"}: ${reason}`
    );
    const warnH = 8 + lines.length * 4.5;
    doc.roundedRect(12, nextY, pageW - 24, warnH, 2, 2, "FD");
    doc.setTextColor(185, 28, 28);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("ALERTA DE SUSPENDIDOS PARA ESTE PARTIDO:", 15, nextY + 5.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    lines.forEach((line, idx) => {
      doc.text(line, 16, nextY + 10.5 + idx * 4.5);
    });
    nextY += warnH + 5;
  }

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
      colW,
      suspended
    );
  }
  if (away) {
    bottomRight = drawTeamRosterTable(
      doc,
      away,
      playerMap,
      18 + colW,
      nextY,
      colW,
      suspended
    );
  }

  let notesY = Math.max(bottomLeft, bottomRight) + 7;

  // Legend
  doc.setTextColor(...TEXT_MUTED);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.text(
    "Referencias: G = Goles · A = Asistencias · TA = Tarjeta Amarilla (2 TA = Expulsado + 1 fecha) · TR = Tarjeta Roja · (*) = Estrellas de campeón",
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
  doc.text("DETALLE DE GOLES, ASISTENCIAS, TARJETAS Y OBSERVACIONES", 15, notesY + 4.8);
  notesY += 7;

  const notesBoxH = Math.max(40, 252 - notesY);
  doc.setDrawColor(...BORDER);
  doc.rect(12, notesY, pageW - 24, notesBoxH, "S");

  if (match.events.length > 0) {
    doc.setTextColor(...TEXT_DARK);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    match.events.slice(0, 12).forEach((ev, idx) => {
      const pName = playerMap.get(ev.playerId)?.name ?? "Jugador";
      const tName = teamMap.get(ev.teamId)?.name ?? "";
      const assistName = ev.assistPlayerId
        ? playerMap.get(ev.assistPlayerId)?.name
        : null;
      const typeLabel =
        ev.type === "gol"
          ? `GOL${assistName ? ` (Asist: ${assistName})` : ""}`
          : ev.type === "roja"
            ? "ROJA DIRECTA (EXPULSADO)"
            : ev.isSecondYellow
              ? "2ª AMARILLA (EXPULSADO)"
              : "AMARILLA";
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

    const home = teamMap.get(m.homeTeamId)?.name ?? "Local";
    const away = teamMap.get(m.awayTeamId)?.name ?? "Visitante";
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
  allMatches: Match[]
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const logoDataUrl = await fetchLogoDataUrl();
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const playerMap = new Map(players.map((p) => [p.id, p]));

  renderSingleMatchPage(doc, logoDataUrl, match, teamMap, playerMap, allMatches);
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
    renderSingleMatchPage(doc, logoDataUrl, match, teamMap, playerMap, matches);
  }

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter(doc, p, totalPages);
  }

  doc.save("copa-hosteria-2026-planillas-partidos.pdf");
}
