"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { NpcId } from "@/lib/types";

interface Props {
  selectedNpc: NpcId;
  loadingNpcs: Record<NpcId, boolean>;
  onNpcSelect: (id: NpcId) => void;
}

interface Point2D {
  x: number;
  y: number;
}

const GRID_SIZE = 10;
const TILE_WIDTH = 48;
const TILE_HEIGHT = 24;

// Obstacles map: true = solid/collidable
const OBSTACLES: Record<string, boolean> = {
  "2,2": true, // Silas standing tile
  "2,1": true, // Silas anvil decoration
  "2,7": true, // Elara standing tile
  "1,7": true, // Elara bookshelf decoration
  "7,4": true, // Kael standing tile
  "7,5": true, // Kael barricade decoration
};

const NPC_COORDS: Record<NpcId, Point2D> = {
  silas: { x: 2, y: 2 },
  elara: { x: 2, y: 7 },
  kael: { x: 7, y: 4 },
};

const NPC_COLORS: Record<NpcId, string> = {
  silas: "#EF4444", // Red/Forge
  elara: "#A78BFA", // Purple/Arcane
  kael: "#3B82F6", // Blue/Steel
};

export function WorldCanvas({ selectedNpc, loadingNpcs, onNpcSelect }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playerPos, setPlayerPos] = useState<Point2D>({ x: 5, y: 5 });
  const [targetPos, setTargetPos] = useState<Point2D | null>(null);
  const [dimensions, setDimensions] = useState({ width: 400, height: 280 });
  const playerRef = useRef(playerPos);

  // Sync player position ref
  useEffect(() => {
    playerRef.current = playerPos;
  }, [playerPos]);

  // Handle resizing
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const e = entries[0];
      if (e) {
        setDimensions({
          width: e.contentRect.width || 400,
          height: e.contentRect.height || 280,
        });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Proximity check helper
  const checkProximity = useCallback((pos: Point2D) => {
    let closestNpc: NpcId | null = null;
    let minDistance = 999;

    (Object.keys(NPC_COORDS) as NpcId[]).forEach((id) => {
      const npc = NPC_COORDS[id];
      const dx = Math.abs(pos.x - npc.x);
      const dy = Math.abs(pos.y - npc.y);
      // Chebyshev distance (proximity is adjacent or diagonal 1 tile away)
      const dist = Math.max(dx, dy);

      if (dist === 1 && dist < minDistance) {
        minDistance = dist;
        closestNpc = id;
      }
    });

    if (closestNpc && closestNpc !== selectedNpc) {
      onNpcSelect(closestNpc);
    }
  }, [selectedNpc, onNpcSelect]);

  // Handle keyboard movement
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      // Skip movement if typing in an input
      if (activeElement && (activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA")) {
        return;
      }

      let dx = 0;
      let dy = 0;

      switch (e.key.toLowerCase()) {
        case "w":
        case "arrowup":
          dy = -1; // Move North-West in isometric
          break;
        case "s":
        case "arrowdown":
          dy = 1; // Move South-East in isometric
          break;
        case "a":
        case "arrowleft":
          dx = -1; // Move South-West in isometric
          break;
        case "d":
        case "arrowright":
          dx = 1; // Move North-East in isometric
          break;
        default:
          return; // Skip other keys
      }

      e.preventDefault();
      setTargetPos(null); // Cancel click-to-move

      const nextX = Math.max(0, Math.min(GRID_SIZE - 1, playerRef.current.x + dx));
      const nextY = Math.max(0, Math.min(GRID_SIZE - 1, playerRef.current.y + dy));
      const key = `${nextX},${nextY}`;

      if (!OBSTACLES[key]) {
        const nextPos = { x: nextX, y: nextY };
        setPlayerPos(nextPos);
        checkProximity(nextPos);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [checkProximity]);

  // Click-to-move interpolation
  useEffect(() => {
    if (!targetPos) return;

    const interval = setInterval(() => {
      const current = playerRef.current;
      if (current.x === targetPos.x && current.y === targetPos.y) {
        setTargetPos(null);
        return;
      }

      // Compute step towards target
      let nextX = current.x;
      let nextY = current.y;

      if (current.x < targetPos.x) nextX++;
      else if (current.x > targetPos.x) nextX--;

      if (current.y < targetPos.y) nextY++;
      else if (current.y > targetPos.y) nextY--;

      const key = `${nextX},${nextY}`;
      if (!OBSTACLES[key]) {
        const nextPos = { x: nextX, y: nextY };
        setPlayerPos(nextPos);
        checkProximity(nextPos);
      } else {
        // Path blocked, cancel movement
        setTargetPos(null);
      }
    }, 200);

    return () => clearInterval(interval);
  }, [targetPos, checkProximity]);

  // Canvas drawing loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;

    const render = () => {
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      // Iso Projection Offset (Center grid on screen)
      const isoCenterX = dimensions.width / 2;
      const isoCenterY = dimensions.height / 4 + 20;

      const toIso = (x: number, y: number) => {
        return {
          x: (x - y) * (TILE_WIDTH / 2) + isoCenterX,
          y: (x + y) * (TILE_HEIGHT / 2) + isoCenterY,
        };
      };

      // 1. Draw Grid Tiles
      for (let x = 0; x < GRID_SIZE; x++) {
        for (let y = 0; y < GRID_SIZE; y++) {
          const iso = toIso(x, y);
          const isObstacle = OBSTACLES[`${x},${y}`];
          const isNpcTile = (x === 2 && y === 2) || (x === 2 && y === 7) || (x === 7 && y === 4);

          // Draw Tile Diamond
          ctx.beginPath();
          ctx.moveTo(iso.x, iso.y);
          ctx.lineTo(iso.x + TILE_WIDTH / 2, iso.y + TILE_HEIGHT / 2);
          ctx.lineTo(iso.x, iso.y + TILE_HEIGHT);
          ctx.lineTo(iso.x - TILE_WIDTH / 2, iso.y + TILE_HEIGHT / 2);
          ctx.closePath();

          // Floor coloring
          if (isNpcTile) {
            ctx.fillStyle = "#0F172A"; // Dark surface
          } else if (isObstacle) {
            ctx.fillStyle = "#1E293B"; // Dark slate wall
          } else {
            // Checkboard cobblestone layout
            ctx.fillStyle = (x + y) % 2 === 0 ? "#0C0F1A" : "#121729";
          }

          ctx.fill();

          // Draw Tile Border
          ctx.strokeStyle = "rgba(124, 58, 237, 0.08)"; // Purple grid outline
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // 2. Draw NPC Active Proximity Rings / Runic Overlays
      (Object.keys(NPC_COORDS) as NpcId[]).forEach((id) => {
        const npc = NPC_COORDS[id];
        const color = NPC_COLORS[id];
        const isSelected = selectedNpc === id;
        const isLoading = loadingNpcs[id];

        const iso = toIso(npc.x, npc.y);

        ctx.save();
        ctx.beginPath();
        ctx.ellipse(
          iso.x,
          iso.y + TILE_HEIGHT / 2,
          TILE_WIDTH / 1.5,
          TILE_HEIGHT / 1.5,
          0,
          0,
          2 * Math.PI
        );

        if (isSelected) {
          ctx.strokeStyle = color;
          ctx.lineWidth = isLoading ? 2 : 1.5;
          ctx.setLineDash(isLoading ? [4, 4] : []);
          ctx.shadowColor = color;
          ctx.shadowBlur = 10;
        } else {
          ctx.strokeStyle = "rgba(100, 116, 139, 0.3)";
          ctx.lineWidth = 1;
        }
        ctx.stroke();
        ctx.restore();
      });

      // 3. Draw Silas Decoration (Anvil)
      const anvilIso = toIso(2, 1);
      ctx.fillStyle = "#475569";
      ctx.fillRect(anvilIso.x - 6, anvilIso.y + 4, 12, 8);
      ctx.strokeStyle = "#94A3B8";
      ctx.strokeRect(anvilIso.x - 6, anvilIso.y + 4, 12, 8);

      // 4. Draw Elara Decoration (Bookshelf)
      const bookIso = toIso(1, 7);
      ctx.fillStyle = "#78350F";
      ctx.fillRect(bookIso.x - 8, bookIso.y, 16, 12);
      ctx.fillStyle = "#A78BFA";
      ctx.fillRect(bookIso.x - 4, bookIso.y + 3, 3, 6);
      ctx.fillStyle = "#3B82F6";
      ctx.fillRect(bookIso.x + 1, bookIso.y + 2, 3, 7);

      // 5. Draw NPC Billboards (Silas, Elara, Kael)
      (Object.keys(NPC_COORDS) as NpcId[]).forEach((id) => {
        const npc = NPC_COORDS[id];
        const color = NPC_COLORS[id];
        const isSelected = selectedNpc === id;
        const isLoading = loadingNpcs[id];
        const iso = toIso(npc.x, npc.y);

        ctx.save();
        // Pulsing scale for active loading status
        const pulse = isLoading ? 1 + Math.sin(Date.now() / 150) * 0.08 : 1;

        // Draw avatar bobbing
        const bob = Math.sin(Date.now() / 200 + (id === "silas" ? 0 : id === "elara" ? 2 : 4)) * 3;

        const charX = iso.x;
        const charY = iso.y + TILE_HEIGHT / 2 - 20 + bob;

        // Draw character body billboard
        ctx.beginPath();
        ctx.arc(charX, charY, 8 * pulse, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();

        // Draw head/crown details
        ctx.beginPath();
        ctx.arc(charX, charY - 10, 4 * pulse, 0, 2 * Math.PI);
        ctx.fillStyle = "#E2E8F0";
        ctx.fill();

        // Draw label banner above NPC
        ctx.font = "bold 9px Courier New";
        ctx.fillStyle = isSelected ? color : "#94A3B8";
        ctx.textAlign = "center";
        ctx.fillText(id.toUpperCase(), charX, charY - 18);

        ctx.restore();
      });

      // 6. Draw Player Character Avatar
      const playerIso = toIso(playerRef.current.x, playerRef.current.y);
      const playerBob = Math.sin(Date.now() / 150) * 2;
      const pX = playerIso.x;
      const pY = playerIso.y + TILE_HEIGHT / 2 - 16 + playerBob;

      ctx.save();
      // Draw golden robed player character
      ctx.beginPath();
      ctx.arc(pX, pY, 7, 0, 2 * Math.PI);
      ctx.fillStyle = "#F59E0B"; // Player gold color
      ctx.shadowColor = "#F59E0B";
      ctx.shadowBlur = 8;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(pX, pY - 8, 3.5, 0, 2 * Math.PI);
      ctx.fillStyle = "#FFFFFF";
      ctx.fill();

      // Label
      ctx.font = "8px Courier New";
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.fillText("YOU", pX, pY - 14);
      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animId);
  }, [dimensions, selectedNpc, loadingNpcs]);

  // Click-to-move handler
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const isoCenterX = dimensions.width / 2;
    const isoCenterY = dimensions.height / 4 + 20;

    // Inverse matrix translation
    const dx = clickX - isoCenterX;
    const dy = clickY - isoCenterY - TILE_HEIGHT / 2;
    const x = Math.round((dx / (TILE_WIDTH / 2) + dy / (TILE_HEIGHT / 2)) / 2);
    const y = Math.round((dy / (TILE_HEIGHT / 2) - dx / (TILE_WIDTH / 2)) / 2);

    if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
      const key = `${x},${y}`;
      if (!OBSTACLES[key]) {
        setTargetPos({ x, y });
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden bg-[#06080F] border border-border/80 rounded-xl"
    >
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        onClick={handleCanvasClick}
        className="block cursor-pointer"
      />
      {/* Keyboard guide overlay */}
      <div className="absolute bottom-2 left-2 z-10 px-2 py-1 bg-void/80 border border-border/40 rounded text-[9px] font-mono text-muted uppercase tracking-wider">
        🎮 Move: WASD / Click ground
      </div>
      {/* Proximity prompt */}
      <div className="absolute top-2 left-2 z-10 px-2 py-1 bg-purple-dim/10 border border-purple/30 rounded text-[9px] font-mono text-purple-glow uppercase tracking-wider">
        ✨ Walk next to NPCs to interact
      </div>
    </div>
  );
}
