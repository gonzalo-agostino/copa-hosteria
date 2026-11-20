import { Player, Team } from "@/types/tournament";

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
        const stars = p.stars > 0 ? ` ${"★".repeat(p.stars)}` : "";
        lines.push(`   • ${p.name}${stars}`);
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

      // Player name
      ctx.fillStyle = "#F8FAFC";
      ctx.font = "600 21px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(p.name, x + 54, py);

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
