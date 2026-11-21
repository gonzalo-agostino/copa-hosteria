import { Match, Player, Team } from "@/types/tournament";
import { getMatchScore } from "@/lib/stats";

export function buildWhatsAppTeamsText(teams: Team[], players: Player[]): string {
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const lines: string[] = [
    "🏆 *COPA HOSTERÍA - 4° EDICIÓN (28.11.2026)* 🏆",
    "⚽ *EQUIPOS CONFIRMADOS DEL SORTEO*",
    "",
  ];

  teams.forEach((team, idx) => {
    lines.push(`🔷 *${idx + 1}. ${team.name.toUpperCase()}*`);
    if (team.playerIds.length === 0) {
      lines.push("   _(Sin jugadores asignados)_");
    } else {
      team.playerIds.forEach((pid) => {
        const p = playerMap.get(pid);
        if (!p) return;
        const cap = team.captainId === pid ? " (C)" : "";
        const stars = p.stars > 0 ? ` ${"★".repeat(p.stars)}` : "";
        lines.push(`   • ${p.name}${cap}${stars}`);
      });
    }
    lines.push("");
  });

  lines.push("📅 *Nos vemos el 28.11.2026 en la cancha!* 🔥");
  return lines.join("\n");
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function loadLogoImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function downloadTeamsPosterPng(teams: Team[], players: Player[]) {
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const logoImg = await loadLogoImage("/logo-copa-hosteria.jpg");

  const cols = 2;
  const rows = Math.ceil(teams.length / cols);
  const maxPlayers = Math.max(7, ...teams.map((t) => t.playerIds.length));

  const width = 1080;
  const headerH = 260;
  const footerH = 84;
  const cardGap = 28;
  const padX = 48;
  const cardW = (width - padX * 2 - cardGap) / cols;
  const cardH = 82 + maxPlayers * 40 + 22;
  const height = headerH + rows * cardH + (rows - 1) * cardGap + footerH + 36;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Deep royal blue background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, "#0A1B42");
  bgGrad.addColorStop(0.5, "#0F2557");
  bgGrad.addColorStop(1, "#16357A");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Subtle gold radial glow at top
  const glow = ctx.createRadialGradient(width / 2, 120, 20, width / 2, 120, 440);
  glow.addColorStop(0, "rgba(212, 155, 53, 0.28)");
  glow.addColorStop(1, "rgba(212, 155, 53, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, 440);

  // Outer gold frame
  ctx.strokeStyle = "rgba(212, 155, 53, 0.55)";
  ctx.lineWidth = 3;
  drawRoundedRect(ctx, 20, 20, width - 40, height - 40, 28);
  ctx.stroke();

  // Official Logo in Header
  if (logoImg) {
    const logoSize = 148;
    const logoX = padX + 18;
    const logoY = 58;
    ctx.save();
    drawRoundedRect(ctx, logoX, logoY, logoSize, logoSize, 22);
    ctx.clip();
    ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
    ctx.restore();
    ctx.strokeStyle = "#D49B35";
    ctx.lineWidth = 3;
    drawRoundedRect(ctx, logoX, logoY, logoSize, logoSize, 22);
    ctx.stroke();

    // Header text aligned beside logo
    const textX = logoX + logoSize + 32;
    ctx.textAlign = "left";
    ctx.fillStyle = "#D49B35";
    ctx.font = "700 20px system-ui, -apple-system, sans-serif";
    ctx.fillText("★  SORTEO OFICIAL DE EQUIPOS  ★", textX, 102);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "900 54px system-ui, -apple-system, sans-serif";
    ctx.fillText("COPA HOSTERÍA", textX, 160);

    ctx.fillStyle = "#F0C46B";
    ctx.font = "700 26px system-ui, -apple-system, sans-serif";
    ctx.fillText("4° EDICIÓN  ·  28.11.2026", textX, 200);
  } else {
    ctx.fillStyle = "#D49B35";
    ctx.font = "700 20px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("★  SORTEO OFICIAL DE EQUIPOS  ★", width / 2, 88);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "900 54px system-ui, -apple-system, sans-serif";
    ctx.fillText("COPA HOSTERÍA", width / 2, 150);

    ctx.fillStyle = "#F0C46B";
    ctx.font = "700 24px system-ui, -apple-system, sans-serif";
    ctx.fillText("4° EDICIÓN  ·  28.11.2026", width / 2, 192);
  }

  // Gold divider line
  ctx.strokeStyle = "rgba(212, 155, 53, 0.5)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padX + 40, 232);
  ctx.lineTo(width - padX - 40, 232);
  ctx.stroke();

  // Team Cards
  teams.forEach((team, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = padX + col * (cardW + cardGap);
    const y = headerH + row * (cardH + cardGap);

    // Card background
    ctx.fillStyle = "rgba(10, 27, 66, 0.78)";
    drawRoundedRect(ctx, x, y, cardW, cardH, 20);
    ctx.fill();

    // Card border
    ctx.strokeStyle = "rgba(212, 155, 53, 0.42)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Team header bar
    ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
    drawRoundedRect(ctx, x + 2, y + 2, cardW - 4, 62, 18);
    ctx.fill();

    // Team color dot
    ctx.fillStyle = team.color;
    ctx.beginPath();
    ctx.arc(x + 34, y + 34, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Team Name
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "800 24px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(team.name.toUpperCase(), x + 60, y + 42);

    // Players list
    team.playerIds.forEach((pid, pIdx) => {
      const p = playerMap.get(pid);
      if (!p) return;
      const py = y + 98 + pIdx * 40;

      // Number circle
      ctx.fillStyle = "rgba(212, 155, 53, 0.22)";
      ctx.beginPath();
      ctx.arc(x + 30, py - 7, 13, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#F0C46B";
      ctx.font = "700 14px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(pIdx + 1), x + 30, py - 2);

      // Player name (+ Captain badge)
      const isCaptain = team.captainId === pid;
      ctx.fillStyle = isCaptain ? "#F5CE78" : "#F8FAFC";
      ctx.font = isCaptain
        ? "800 21px system-ui, -apple-system, sans-serif"
        : "600 21px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(isCaptain ? `${p.name} (C)` : p.name, x + 54, py);

      // Champion stars
      if (p.stars > 0) {
        ctx.fillStyle = "#D49B35";
        ctx.font = "700 20px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "right";
        ctx.fillText("★".repeat(p.stars), x + cardW - 22, py);
      }
    });
  });

  // Footer
  ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
  ctx.font = "600 18px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(
    "COPA HOSTERÍA · 4° EDICIÓN · 28.11.2026",
    width / 2,
    height - 38
  );

  // Trigger download
  const link = document.createElement("a");
  link.download = "copa-hosteria-2026-equipos.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function getChampionLabel(stars: number): string {
  if (stars === 1) return "★  CAMPEÓN COPA HOSTERÍA  ★";
  if (stars === 2) return "★★  BICAMPEÓN COPA HOSTERÍA  ★★";
  if (stars >= 3) return `${"★".repeat(stars)}  MULTICAMPEÓN COPA HOSTERÍA  ${"★".repeat(stars)}`;
  return "CONVOCADO · 4° EDICIÓN";
}

export async function downloadPlayerCardPng(
  player: Player,
  team?: Team | null,
  potNumber?: number | null
) {
  const [logoImg, photoImg] = await Promise.all([
    loadLogoImage("/logo-copa-hosteria.jpg"),
    player.photoUrl ? loadLogoImage(player.photoUrl) : Promise.resolve(null),
  ]);

  const width = 1080;
  const height = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Deep royal blue background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, "#071433");
  bgGrad.addColorStop(0.45, "#0F2557");
  bgGrad.addColorStop(1, "#16357A");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Golden radial aura behind avatar
  const aura = ctx.createRadialGradient(width / 2, 470, 40, width / 2, 470, 430);
  aura.addColorStop(0, "rgba(212, 155, 53, 0.34)");
  aura.addColorStop(0.6, "rgba(212, 155, 53, 0.08)");
  aura.addColorStop(1, "rgba(212, 155, 53, 0)");
  ctx.fillStyle = aura;
  ctx.fillRect(0, 80, width, 820);

  // Outer double gold frame
  ctx.strokeStyle = "#D49B35";
  ctx.lineWidth = 5;
  drawRoundedRect(ctx, 28, 28, width - 56, height - 56, 40);
  ctx.stroke();

  ctx.strokeStyle = "rgba(240, 196, 107, 0.35)";
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, 44, 44, width - 88, height - 88, 30);
  ctx.stroke();

  // Top Header with official logo
  if (logoImg) {
    const logoSize = 96;
    const logoX = 76;
    const logoY = 74;
    ctx.save();
    drawRoundedRect(ctx, logoX, logoY, logoSize, logoSize, 18);
    ctx.clip();
    ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
    ctx.restore();
    ctx.strokeStyle = "#D49B35";
    ctx.lineWidth = 2.5;
    drawRoundedRect(ctx, logoX, logoY, logoSize, logoSize, 18);
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "900 40px system-ui, -apple-system, sans-serif";
    ctx.fillText("COPA HOSTERÍA", logoX + logoSize + 24, 118);

    ctx.fillStyle = "#F0C46B";
    ctx.font = "700 22px system-ui, -apple-system, sans-serif";
    ctx.fillText("4° EDICIÓN  ·  28.11.2026", logoX + logoSize + 24, 154);
  } else {
    ctx.textAlign = "center";
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "900 44px system-ui, -apple-system, sans-serif";
    ctx.fillText("COPA HOSTERÍA · 4° EDICIÓN", width / 2, 130);
  }

  // Pot badge top-right (if drawn from a pot)
  if (potNumber) {
    const pillW = 190;
    const pillH = 48;
    const pillX = width - 76 - pillW;
    const pillY = 98;
    ctx.fillStyle = "rgba(212, 155, 53, 0.18)";
    drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 24);
    ctx.fill();
    ctx.strokeStyle = "rgba(240, 196, 107, 0.7)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#F0C46B";
    ctx.font = "800 22px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`BOMBO ${potNumber}`, pillX + pillW / 2, pillY + 32);
  }

  // Gold divider
  ctx.strokeStyle = "rgba(212, 155, 53, 0.45)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(76, 196);
  ctx.lineTo(width - 76, 196);
  ctx.stroke();

  // Champion / Status Pill
  const champLabel = getChampionLabel(player.stars);
  const badgeW = player.stars > 0 ? 640 : 440;
  const badgeH = 54;
  const badgeX = (width - badgeW) / 2;
  const badgeY = 224;
  ctx.fillStyle =
    player.stars > 0 ? "rgba(212, 155, 53, 0.22)" : "rgba(255, 255, 255, 0.08)";
  drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 27);
  ctx.fill();
  ctx.strokeStyle =
    player.stars > 0 ? "#F0C46B" : "rgba(255, 255, 255, 0.25)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = player.stars > 0 ? "#F5CE78" : "#DBEAFE";
  ctx.font = "800 22px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(champLabel, width / 2, badgeY + 35);

  // Player Circular Photo / Avatar
  const cx = width / 2;
  const cy = 468;
  const radius = 158;

  // Outer gold ring
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 12, 0, Math.PI * 2);
  ctx.strokeStyle = player.stars > 0 ? "#F0C46B" : "rgba(212, 155, 53, 0.65)";
  ctx.lineWidth = 6;
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();

  if (photoImg) {
    // Center-crop cover
    const scale = Math.max(
      (radius * 2) / photoImg.width,
      (radius * 2) / photoImg.height
    );
    const dw = photoImg.width * scale;
    const dh = photoImg.height * scale;
    ctx.drawImage(photoImg, cx - dw / 2, cy - dh / 2, dw, dh);
  } else {
    const avGrad = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
    avGrad.addColorStop(0, "#1D4396");
    avGrad.addColorStop(1, "#0A1B42");
    ctx.fillStyle = avGrad;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.fillStyle = "#F0C46B";
    ctx.font = "900 116px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(getInitials(player.name), cx, cy + 6);
    ctx.textBaseline = "alphabetic";
  }
  ctx.restore();

  // Player Name
  ctx.textAlign = "center";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "900 62px system-ui, -apple-system, sans-serif";
  ctx.fillText(player.name.toUpperCase(), width / 2, 708);

  // Position & Stars row
  const subParts: string[] = [];
  if (player.position) subParts.push(player.position.toUpperCase());
  if (player.stars > 0) subParts.push("★".repeat(player.stars));
  if (subParts.length > 0) {
    ctx.fillStyle = "#F5CE78";
    ctx.font = "800 30px system-ui, -apple-system, sans-serif";
    ctx.fillText(subParts.join("   ·   "), width / 2, 756);
  }

  // Team Banner (if drawn to a team)
  const teamBoxY = 796;
  if (team) {
    const tW = 760;
    const tH = 92;
    const tX = (width - tW) / 2;
    ctx.fillStyle = "rgba(7, 20, 51, 0.85)";
    drawRoundedRect(ctx, tX, teamBoxY, tW, tH, 24);
    ctx.fill();
    ctx.strokeStyle = team.color === "#F8FAFC" ? "#F0C46B" : team.color;
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // Jersey color circle
    ctx.fillStyle = team.color;
    ctx.beginPath();
    ctx.arc(tX + 54, teamBoxY + tH / 2, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 3;
    ctx.stroke();

    const isCaptain = team.captainId === player.id;
    ctx.textAlign = "left";
    ctx.fillStyle = isCaptain ? "#F5CE78" : "rgba(219, 234, 254, 0.78)";
    ctx.font = "700 18px system-ui, -apple-system, sans-serif";
    ctx.fillText(
      isCaptain ? "© CAPITÁN DEL EQUIPO" : "EQUIPO ASIGNADO",
      tX + 98,
      teamBoxY + 34
    );

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "900 34px system-ui, -apple-system, sans-serif";
    ctx.fillText(team.name.toUpperCase(), tX + 98, teamBoxY + 72);
  }

  // Historical Stats Cards (2 side-by-side boxes)
  const statsY = team ? 928 : 842;
  const boxGap = 28;
  const boxW = (width - 152 - boxGap) / 2;
  const boxH = 236;
  const leftX = 76;
  const rightX = leftX + boxW + boxGap;

  // Box 1: Campeonatos
  ctx.fillStyle = "rgba(7, 20, 51, 0.82)";
  drawRoundedRect(ctx, leftX, statsY, boxW, boxH, 24);
  ctx.fill();
  ctx.strokeStyle = "rgba(212, 155, 53, 0.45)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = "#F0C46B";
  ctx.font = "700 21px system-ui, -apple-system, sans-serif";
  ctx.fillText("HISTORIAL DE TÍTULOS", leftX + boxW / 2, statsY + 46);

  ctx.fillStyle = player.stars > 0 ? "#F5CE78" : "#94A3B8";
  ctx.font = "900 64px system-ui, -apple-system, sans-serif";
  ctx.fillText(
    player.stars > 0 ? "★".repeat(player.stars) : "—",
    leftX + boxW / 2,
    statsY + 132
  );

  ctx.fillStyle = "#E2E8F0";
  ctx.font = "700 22px system-ui, -apple-system, sans-serif";
  ctx.fillText(
    player.stars === 1
      ? "1 vez Campeón"
      : player.stars > 1
        ? `${player.stars} veces Campeón`
        : "En busca de su 1ª estrella",
    leftX + boxW / 2,
    statsY + 188
  );

  // Box 2: Goles en temporadas pasadas
  const goals2024 = player.goals2024 ?? 0;
  const goals2025 = player.goals2025 ?? 0;
  const totalPastGoals = goals2024 + goals2025;

  ctx.fillStyle = "rgba(7, 20, 51, 0.82)";
  drawRoundedRect(ctx, rightX, statsY, boxW, boxH, 24);
  ctx.fill();
  ctx.strokeStyle = "rgba(212, 155, 53, 0.45)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#F0C46B";
  ctx.font = "700 21px system-ui, -apple-system, sans-serif";
  ctx.fillText("GOLES TEMPORADAS PASADAS", rightX + boxW / 2, statsY + 46);

  ctx.fillStyle = totalPastGoals > 0 ? "#FFFFFF" : "#94A3B8";
  ctx.font = "900 78px system-ui, -apple-system, sans-serif";
  ctx.fillText(String(totalPastGoals), rightX + boxW / 2, statsY + 138);

  const breakdown: string[] = [];
  if (goals2024 > 0) breakdown.push(`2024: ${goals2024}G`);
  if (goals2025 > 0) breakdown.push(`2025: ${goals2025}G`);
  ctx.fillStyle = "#E2E8F0";
  ctx.font = "700 22px system-ui, -apple-system, sans-serif";
  ctx.fillText(
    breakdown.length > 0
      ? breakdown.join("  ·  ")
      : "Sin goles previos registrados",
    rightX + boxW / 2,
    statsY + 188
  );

  // Footer
  ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
  ctx.font = "700 20px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(
    "COPA HOSTERÍA  ·  4° EDICIÓN  ·  28.11.2026",
    width / 2,
    height - 76
  );

  // Trigger download
  const slug = player.name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const link = document.createElement("a");
  link.download = `copa-hosteria-tarjeta-${slug}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

export async function downloadSingleTeamCardPng(
  team: Team,
  players: Player[]
) {
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const teamPlayers = team.playerIds
    .map((pid) => playerMap.get(pid))
    .filter((p): p is Player => Boolean(p));

  const [logoImg, ...playerPhotos] = await Promise.all([
    loadLogoImage("/logo-copa-hosteria.jpg"),
    ...teamPlayers.map((p) =>
      p.photoUrl ? loadLogoImage(p.photoUrl) : Promise.resolve(null)
    ),
  ]);

  const width = 1080;
  const rowCount = Math.max(7, teamPlayers.length);
  const rowH = 104;
  const rowGap = 16;
  const listStartY = 420;
  const height = Math.max(
    1350,
    listStartY + rowCount * (rowH + rowGap) + 110
  );

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Deep royal blue background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, "#071433");
  bgGrad.addColorStop(0.5, "#0F2557");
  bgGrad.addColorStop(1, "#16357A");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Golden radial aura at top
  const aura = ctx.createRadialGradient(width / 2, 260, 30, width / 2, 260, 480);
  aura.addColorStop(0, "rgba(212, 155, 53, 0.30)");
  aura.addColorStop(0.6, "rgba(212, 155, 53, 0.08)");
  aura.addColorStop(1, "rgba(212, 155, 53, 0)");
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, width, 640);

  // Outer double gold frame
  ctx.strokeStyle = "#D49B35";
  ctx.lineWidth = 5;
  drawRoundedRect(ctx, 28, 28, width - 56, height - 56, 40);
  ctx.stroke();

  ctx.strokeStyle = "rgba(240, 196, 107, 0.35)";
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, 44, 44, width - 88, height - 88, 30);
  ctx.stroke();

  // Top Header with official logo
  if (logoImg) {
    const logoSize = 96;
    const logoX = 76;
    const logoY = 72;
    ctx.save();
    drawRoundedRect(ctx, logoX, logoY, logoSize, logoSize, 18);
    ctx.clip();
    ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
    ctx.restore();
    ctx.strokeStyle = "#D49B35";
    ctx.lineWidth = 2.5;
    drawRoundedRect(ctx, logoX, logoY, logoSize, logoSize, 18);
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "900 40px system-ui, -apple-system, sans-serif";
    ctx.fillText("COPA HOSTERÍA", logoX + logoSize + 24, 116);

    ctx.fillStyle = "#F0C46B";
    ctx.font = "700 22px system-ui, -apple-system, sans-serif";
    ctx.fillText("4° EDICIÓN  ·  28.11.2026", logoX + logoSize + 24, 152);
  } else {
    ctx.textAlign = "center";
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "900 44px system-ui, -apple-system, sans-serif";
    ctx.fillText("COPA HOSTERÍA · 4° EDICIÓN", width / 2, 128);
  }

  // Top-right badge
  const pillW = 240;
  const pillH = 48;
  const pillX = width - 76 - pillW;
  const pillY = 96;
  ctx.fillStyle = "rgba(212, 155, 53, 0.18)";
  drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 24);
  ctx.fill();
  ctx.strokeStyle = "rgba(240, 196, 107, 0.7)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#F0C46B";
  ctx.font = "800 20px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("PLANTEL OFICIAL", pillX + pillW / 2, pillY + 31);

  // Hero Team Banner
  const bannerX = 76;
  const bannerY = 198;
  const bannerW = width - 152;
  const bannerH = 188;

  ctx.fillStyle = "rgba(7, 20, 51, 0.88)";
  drawRoundedRect(ctx, bannerX, bannerY, bannerW, bannerH, 28);
  ctx.fill();
  ctx.strokeStyle = team.color === "#F8FAFC" ? "#F0C46B" : team.color;
  ctx.lineWidth = 4;
  ctx.stroke();

  // Team color accent circle
  ctx.fillStyle = team.color;
  ctx.beginPath();
  ctx.arc(bannerX + 74, bannerY + 74, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 4;
  ctx.stroke();

  // Team Name
  ctx.textAlign = "left";
  ctx.fillStyle = "#F0C46B";
  ctx.font = "800 18px system-ui, -apple-system, sans-serif";
  ctx.fillText("EQUIPO CONFIRMADO", bannerX + 132, bannerY + 52);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "900 48px system-ui, -apple-system, sans-serif";
  ctx.fillText(team.name.toUpperCase(), bannerX + 132, bannerY + 102);

  // Squad aggregate stats row inside banner
  const totalStars = teamPlayers.reduce((sum, p) => sum + p.stars, 0);

  ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
  drawRoundedRect(ctx, bannerX + 24, bannerY + 126, bannerW - 48, 44, 14);
  ctx.fill();

  ctx.fillStyle = "#E2E8F0";
  ctx.font = "700 20px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(
    `${teamPlayers.length} JUGADORES    ·    ★ ${totalStars} ${totalStars === 1 ? "TÍTULO" : "TÍTULOS"} DE CAMPEÓN EN PLANTEL`,
    width / 2,
    bannerY + 155
  );

  // Players list rows
  teamPlayers.forEach((p, idx) => {
    const photoImg = playerPhotos[idx];
    const isCaptain = team.captainId === p.id;
    const rx = 76;
    const ry = listStartY + idx * (rowH + rowGap);
    const rw = width - 152;

    ctx.fillStyle = isCaptain
      ? "rgba(212, 155, 53, 0.16)"
      : "rgba(10, 27, 66, 0.82)";
    drawRoundedRect(ctx, rx, ry, rw, rowH, 22);
    ctx.fill();

    ctx.strokeStyle = isCaptain
      ? "#F0C46B"
      : "rgba(212, 155, 53, 0.35)";
    ctx.lineWidth = isCaptain ? 3 : 2;
    ctx.stroke();

    // Circular Avatar
    const avR = 36;
    const avCx = rx + 58;
    const avCy = ry + rowH / 2;

    ctx.save();
    ctx.beginPath();
    ctx.arc(avCx, avCy, avR, 0, Math.PI * 2);
    ctx.clip();

    if (photoImg) {
      const scale = Math.max(
        (avR * 2) / photoImg.width,
        (avR * 2) / photoImg.height
      );
      const dw = photoImg.width * scale;
      const dh = photoImg.height * scale;
      ctx.drawImage(photoImg, avCx - dw / 2, avCy - dh / 2, dw, dh);
    } else {
      ctx.fillStyle = "#16357A";
      ctx.fillRect(avCx - avR, avCy - avR, avR * 2, avR * 2);
      ctx.fillStyle = "#F0C46B";
      ctx.font = "800 24px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(getInitials(p.name), avCx, avCy + 2);
      ctx.textBaseline = "alphabetic";
    }
    ctx.restore();

    ctx.beginPath();
    ctx.arc(avCx, avCy, avR + 2, 0, Math.PI * 2);
    ctx.strokeStyle = p.stars > 0 ? "#F0C46B" : "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Player Name & Subtitle
    const textX = rx + 114;
    ctx.textAlign = "left";
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "800 30px system-ui, -apple-system, sans-serif";
    ctx.fillText(p.name, textX, ry + 48);

    const subBits: string[] = [];
    if (isCaptain) subBits.push("© CAPITÁN");
    if (p.position) subBits.push(p.position.toUpperCase());
    if (p.stars > 0) {
      subBits.push(
        p.stars === 1 ? "CAMPEÓN" : `${p.stars}× CAMPEÓN`
      );
    }
    if (subBits.length === 0) subBits.push("CONVOCADO 4° EDICIÓN");

    ctx.fillStyle = isCaptain ? "#F5CE78" : "rgba(219, 234, 254, 0.78)";
    ctx.font = "700 18px system-ui, -apple-system, sans-serif";
    ctx.fillText(subBits.join("  ·  "), textX, ry + 78);

    // Right side stats: Stars only (no goals in team card)
    if (p.stars > 0) {
      ctx.fillStyle = "#F5CE78";
      ctx.font = "900 34px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText("★".repeat(p.stars), rx + rw - 28, ry + 62);
    }
  });

  // Footer
  ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
  ctx.font = "700 20px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(
    "COPA HOSTERÍA  ·  4° EDICIÓN  ·  28.11.2026",
    width / 2,
    height - 56
  );

  // Trigger download
  const slug = team.name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const link = document.createElement("a");
  link.download = `copa-hosteria-equipo-${slug}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function isVeryDarkHex(hex: string): boolean {
  const clean = hex.replace("#", "").trim();
  if (clean.length !== 6) return false;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum < 45;
}

/**
 * Exports the official Copa Hostería Fixture Poster (PNG, 1080px wide)
 * with blue, white & gold styling ready to share on WhatsApp.
 */
export async function downloadFixturePosterPng(
  teams: Team[],
  matches: Match[]
) {
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const logoImg = await loadLogoImage("/logo-copa-hosteria.jpg");

  const groupMatches = [...matches]
    .filter((m) => m.stage !== "playoff")
    .sort((a, b) => a.round - b.round || a.createdAt.localeCompare(b.createdAt));

  const playoffMatches = [...matches]
    .filter((m) => m.stage === "playoff")
    .sort((a, b) => a.round - b.round || a.createdAt.localeCompare(b.createdAt));

  const width = 1080;
  const headerH = 290;
  const sectionHeaderH = 58;
  const rowH = 74;
  const rowGap = 14;
  const sectionGap = 36;
  const footerH = 96;

  const groupBlockH =
    groupMatches.length > 0
      ? sectionHeaderH + groupMatches.length * (rowH + rowGap)
      : 0;
  const playoffBlockH =
    playoffMatches.length > 0
      ? sectionGap + sectionHeaderH + playoffMatches.length * (rowH + rowGap)
      : 0;

  const height = Math.max(
    900,
    headerH + groupBlockH + playoffBlockH + footerH + 36
  );

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Royal Navy background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, "#0F2557");
  bgGrad.addColorStop(0.5, "#0A1B42");
  bgGrad.addColorStop(1, "#06112B");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Subtle top radial gold glow
  const glow = ctx.createRadialGradient(
    width / 2,
    130,
    20,
    width / 2,
    130,
    460
  );
  glow.addColorStop(0, "rgba(212, 155, 53, 0.24)");
  glow.addColorStop(1, "rgba(212, 155, 53, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, 540);

  // Outer double gold frame
  ctx.strokeStyle = "rgba(212, 155, 53, 0.55)";
  ctx.lineWidth = 4;
  drawRoundedRect(ctx, 26, 26, width - 52, height - 52, 30);
  ctx.stroke();

  ctx.strokeStyle = "rgba(245, 206, 120, 0.22)";
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, 38, 38, width - 76, height - 76, 22);
  ctx.stroke();

  // Official Logo Crest
  if (logoImg) {
    const logoSize = 112;
    const lx = (width - logoSize) / 2;
    const ly = 52;
    ctx.save();
    ctx.beginPath();
    ctx.arc(lx + logoSize / 2, ly + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(logoImg, lx, ly, logoSize, logoSize);
    ctx.restore();

    ctx.strokeStyle = "#F5CE78";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(lx + logoSize / 2, ly + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Header Title
  ctx.textAlign = "center";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "900 44px system-ui, -apple-system, sans-serif";
  ctx.fillText("COPA HOSTERÍA · FIXTURE OFICIAL", width / 2, 218);

  ctx.fillStyle = "#F5CE78";
  ctx.font = "800 22px system-ui, -apple-system, sans-serif";
  ctx.fillText("4° EDICIÓN  ·  28.11.2026  ·  FASE DE GRUPOS Y FINALES", width / 2, 254);

  // Gold divider line
  ctx.strokeStyle = "rgba(212, 155, 53, 0.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(80, 276);
  ctx.lineTo(width - 80, 276);
  ctx.stroke();

  const padX = 64;
  const rowW = width - padX * 2;
  let cursorY = headerH + 8;

  const drawTeamLabel = (
    name: string,
    color: string | null,
    x: number,
    y: number,
    align: "right" | "left"
  ) => {
    const text = name.toUpperCase();
    ctx.font = "900 26px system-ui, -apple-system, sans-serif";
    const textW = ctx.measureText(text).width;
    const isDark = color ? isVeryDarkHex(color) : false;

    if (isDark) {
      // Draw crisp black pill with white border so Negro stands out cleanly
      const pillPadX = 14;
      const pillH = 40;
      const pillW = textW + pillPadX * 2;
      const px = align === "right" ? x - pillW : x;
      const py = y - 28;
      ctx.fillStyle = "#111827";
      drawRoundedRect(ctx, px, py, pillW, pillH, 10);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.75)";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.fillText(text, px + pillW / 2, y);
    } else {
      ctx.fillStyle = color ?? "#CBD5E1";
      ctx.textAlign = align;
      ctx.fillText(text, x, y);
    }
  };

  const drawMatchRow = (match: Match, y: number) => {
    const home = teamMap.get(match.homeTeamId);
    const away = teamMap.get(match.awayTeamId);
    const isFinal = match.playoffSlot === "final";
    const isPlayoff = match.stage === "playoff";
    const score = getMatchScore(match);
    const hasScore =
      match.status !== "pendiente" || match.events.length > 0;

    // Row card
    ctx.fillStyle = isFinal
      ? "rgba(212, 155, 53, 0.22)"
      : isPlayoff
        ? "rgba(20, 50, 117, 0.85)"
        : "rgba(15, 37, 87, 0.78)";
    drawRoundedRect(ctx, padX, y, rowW, rowH, 18);
    ctx.fill();

    ctx.strokeStyle = isFinal
      ? "#F5CE78"
      : isPlayoff
        ? "rgba(245, 206, 120, 0.55)"
        : "rgba(212, 155, 53, 0.35)";
    ctx.lineWidth = isFinal ? 3 : 1.75;
    ctx.stroke();

    // Left: Instance badge (F1..F7, SEMI 1, SEMI 2, FINAL)
    const badgeW = 132;
    const badgeH = 44;
    const bx = padX + 16;
    const by = y + (rowH - badgeH) / 2;
    ctx.fillStyle = isFinal ? "#F5CE78" : "#D49B35";
    drawRoundedRect(ctx, bx, by, badgeW, badgeH, 12);
    ctx.fill();

    ctx.fillStyle = "#071433";
    ctx.font = "900 22px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(match.roundLabel.toUpperCase(), bx + badgeW / 2, y + 45);

    // Center: Home V. Away (or Score)
    const centerX = padX + 160 + (rowW - 320) / 2;
    const homeLabel = home?.name ?? match.homePlaceholder ?? "Por definir";
    const awayLabel = away?.name ?? match.awayPlaceholder ?? "Por definir";

    const midText = hasScore ? `${score.home} - ${score.away}` : "V.";
    ctx.fillStyle = "#F5CE78";
    ctx.font = hasScore
      ? "900 26px system-ui, -apple-system, sans-serif"
      : "900 22px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(midText, centerX, y + 46);

    const midOffset = hasScore ? 56 : 30;
    drawTeamLabel(
      homeLabel,
      home?.color ?? null,
      centerX - midOffset,
      y + 46,
      "right"
    );
    drawTeamLabel(
      awayLabel,
      away?.color ?? null,
      centerX + midOffset,
      y + 46,
      "left"
    );

    // Right: Scheduled Time (15.30 HS)
    if (match.scheduledTime) {
      ctx.fillStyle = isFinal ? "#FFFFFF" : "#F5CE78";
      ctx.font = "800 22px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(match.scheduledTime.toUpperCase(), padX + rowW - 22, y + 45);
    }
  };

  // Section 1: Fase de Grupos
  if (groupMatches.length > 0) {
    ctx.textAlign = "left";
    ctx.fillStyle = "#F5CE78";
    ctx.font = "900 22px system-ui, -apple-system, sans-serif";
    ctx.fillText("FASE DE GRUPOS  ·  TABLA ÚNICA (2 PARTIDOS POR EQUIPO)", padX + 8, cursorY + 34);
    cursorY += sectionHeaderH;

    for (const m of groupMatches) {
      drawMatchRow(m, cursorY);
      cursorY += rowH + rowGap;
    }
  }

  // Section 2: Fase Final
  if (playoffMatches.length > 0) {
    cursorY += sectionGap;
    ctx.textAlign = "left";
    ctx.fillStyle = "#F5CE78";
    ctx.font = "900 22px system-ui, -apple-system, sans-serif";
    ctx.fillText("FASE FINAL  ·  SEMIFINALES Y GRAN FINAL", padX + 8, cursorY + 34);
    cursorY += sectionHeaderH;

    for (const m of playoffMatches) {
      drawMatchRow(m, cursorY);
      cursorY += rowH + rowGap;
    }
  }

  // Footer
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
  ctx.font = "700 20px system-ui, -apple-system, sans-serif";
  ctx.fillText(
    "COPA HOSTERÍA  ·  4° EDICIÓN  ·  28.11.2026  ·  copa-hosteria.vercel.app",
    width / 2,
    height - 54
  );

  const link = document.createElement("a");
  link.download = "copa-hosteria-fixture-oficial-2026.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}
