import { create } from "zustand"

interface GameStore {
  playerPos: { x: number; z: number }
  activeNpc: string | null
  worldId: string
  setPlayerPos: (pos: { x: number; z: number }) => void
  setActiveNpc: (npc: string | null) => void
}

// Generate session world_id (same as chat UI)
const worldId = typeof window !== "undefined"
  ? sessionStorage.getItem("revenant_world_id") || "ashenvale_default"
  : "ashenvale_default"

export const useGameStore = create<GameStore>((set) => ({
  playerPos: { x: 0, z: 0 },
  activeNpc: null,
  worldId,
  setPlayerPos: (playerPos) => set({ playerPos }),
  setActiveNpc: (activeNpc) => set({ activeNpc }),
}))
