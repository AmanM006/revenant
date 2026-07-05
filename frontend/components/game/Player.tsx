import { useRef, useEffect } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { useGameStore } from "./store"
import * as THREE from "three"

const SPEED = 0.12
const BOUNDS = 9

export function Player() {
  const mesh = useRef<THREE.Group>(null)
  const keys = useRef<Set<string>>(new Set())
  const pos = useRef({ x: 0, z: 0 })
  const { setPlayerPos, activeNpc, setActiveNpc } = useGameStore()
  const { camera } = useThree()
  const walkTime = useRef(0)

  const NPC_POSITIONS = {
    silas: { x: -5, z: -2.2 },
    elara: { x: 5, z: 2.8 },
    kael:  { x: -5, z: 2.8 },
  }

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const el = document.activeElement
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return
      keys.current.add(e.key.toLowerCase())
    }
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase())
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
    }
  }, [])

  useFrame(() => {
    if (!mesh.current) return

    // --- Camera-relative movement ---
    // Get camera forward direction projected onto XZ plane
    const camDir = new THREE.Vector3()
    camera.getWorldDirection(camDir)
    camDir.y = 0
    camDir.normalize()

    // Camera right = cross(camDir, up)
    const camRight = new THREE.Vector3()
    camRight.crossVectors(camDir, new THREE.Vector3(0, 1, 0)).normalize()

    const moveDir = new THREE.Vector3(0, 0, 0)
    let moved = false

    if (keys.current.has("w") || keys.current.has("arrowup")) {
      moveDir.add(camDir)
      moved = true
    }
    if (keys.current.has("s") || keys.current.has("arrowdown")) {
      moveDir.sub(camDir)
      moved = true
    }
    if (keys.current.has("a") || keys.current.has("arrowleft")) {
      moveDir.sub(camRight)
      moved = true
    }
    if (keys.current.has("d") || keys.current.has("arrowright")) {
      moveDir.add(camRight)
      moved = true
    }

    if (moved && moveDir.lengthSq() > 0) {
      moveDir.normalize()
      pos.current.x = Math.max(-BOUNDS, Math.min(BOUNDS, pos.current.x + moveDir.x * SPEED))
      pos.current.z = Math.max(-BOUNDS, Math.min(BOUNDS, pos.current.z + moveDir.z * SPEED))

      // Rotate character to face movement direction
      mesh.current.rotation.y = Math.atan2(moveDir.x, moveDir.z)
    }

    mesh.current.position.x = pos.current.x
    mesh.current.position.z = pos.current.z

    // Walk bob
    if (moved) {
      walkTime.current += 0.3
      mesh.current.position.y = Math.abs(Math.sin(walkTime.current)) * 0.06
    } else {
      walkTime.current = 0
      mesh.current.position.y = 0
    }

    setPlayerPos({ x: pos.current.x, z: pos.current.z })

    // NPC proximity check
    let nearNpc: string | null = null
    for (const [id, npcPos] of Object.entries(NPC_POSITIONS)) {
      const dist = Math.sqrt(
        (pos.current.x - npcPos.x) ** 2 +
        (pos.current.z - npcPos.z) ** 2
      )
      if (dist < 2.5) { nearNpc = id; break }
    }
    if (nearNpc !== activeNpc) setActiveNpc(nearNpc)
  })

  return (
    <group ref={mesh} position={[0, 0, 0]}>
      {/* Shadow */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.45, 8]} />
        <meshStandardMaterial color="#000000" transparent opacity={0.18} />
      </mesh>

      {/* Boots */}
      <mesh position={[-0.15, 0.08, 0]}>
        <boxGeometry args={[0.22, 0.18, 0.28]} />
        <meshStandardMaterial color="#92400e" />
      </mesh>
      <mesh position={[0.15, 0.08, 0]}>
        <boxGeometry args={[0.22, 0.18, 0.28]} />
        <meshStandardMaterial color="#92400e" />
      </mesh>

      {/* Legs */}
      <mesh position={[-0.14, 0.32, 0]}>
        <boxGeometry args={[0.24, 0.3, 0.26]} />
        <meshStandardMaterial color="#1e40af" />
      </mesh>
      <mesh position={[0.14, 0.32, 0]}>
        <boxGeometry args={[0.24, 0.3, 0.26]} />
        <meshStandardMaterial color="#1e40af" />
      </mesh>

      {/* Torso — gold armour */}
      <mesh position={[0, 0.65, 0]}>
        <boxGeometry args={[0.6, 0.44, 0.5]} />
        <meshStandardMaterial color="#b45309" />
      </mesh>
      {/* Chest plate */}
      <mesh position={[0, 0.67, 0.26]}>
        <boxGeometry args={[0.44, 0.36, 0.08]} />
        <meshStandardMaterial color="#d97706" />
      </mesh>

      {/* Arms */}
      <mesh position={[-0.38, 0.62, 0]}>
        <boxGeometry args={[0.16, 0.38, 0.18]} />
        <meshStandardMaterial color="#b45309" />
      </mesh>
      <mesh position={[0.38, 0.62, 0]}>
        <boxGeometry args={[0.16, 0.38, 0.18]} />
        <meshStandardMaterial color="#b45309" />
      </mesh>

      {/* Shield (left) */}
      <mesh position={[-0.52, 0.6, 0.1]} rotation={[0, 0.3, 0]}>
        <boxGeometry args={[0.06, 0.45, 0.35]} />
        <meshStandardMaterial color="#1e3a5f" />
      </mesh>
      <mesh position={[-0.56, 0.6, 0.1]} rotation={[0, 0.3, 0]}>
        <boxGeometry args={[0.02, 0.22, 0.18]} />
        <meshStandardMaterial color="#d97706" />
      </mesh>

      {/* Sword (right) */}
      <mesh position={[0.52, 0.9, 0]} rotation={[0, 0, -0.3]}>
        <boxGeometry args={[0.04, 0.55, 0.04]} />
        <meshStandardMaterial color="#cbd5e1" />
      </mesh>
      <mesh position={[0.52, 0.62, 0]}>
        <boxGeometry args={[0.18, 0.04, 0.04]} />
        <meshStandardMaterial color="#b45309" />
      </mesh>

      {/* Neck */}
      <mesh position={[0, 0.92, 0]}>
        <boxGeometry args={[0.22, 0.12, 0.22]} />
        <meshStandardMaterial color="#fde68a" />
      </mesh>

      {/* Head */}
      <mesh position={[0, 1.12, 0]}>
        <boxGeometry args={[0.48, 0.44, 0.44]} />
        <meshStandardMaterial color="#fde68a" />
      </mesh>

      {/* Helmet */}
      <mesh position={[0, 1.28, 0]}>
        <boxGeometry args={[0.52, 0.22, 0.5]} />
        <meshStandardMaterial color="#64748b" />
      </mesh>
      {/* Visor */}
      <mesh position={[0, 1.14, 0.24]}>
        <boxGeometry args={[0.34, 0.12, 0.06]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
    </group>
  )
}
