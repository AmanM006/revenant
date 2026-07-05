import { useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { useGameStore } from "./store"
import * as THREE from "three"

interface NPCProps {
  id: string
  name?: string
  position: [number, number, number]
  color: string
  glowColor: string
}


export function NPCCharacter({ id, name, position, color, glowColor }: NPCProps) {
  const mesh = useRef<THREE.Group>(null)
  const { activeNpc } = useGameStore()
  const isNear = activeNpc === id

  useFrame((state) => {
    if (!mesh.current) return
    // Idle bounce
    mesh.current.position.y = Math.sin(state.clock.elapsedTime * 1.5 + position[0]) * 0.05
    // Face player direction (simple rotation)
    mesh.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.2
  })

  return (
    <group ref={mesh} position={position}>
      {/* Ground indicator ring when near */}
      {isNear && (
        <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.2, 1.4, 16]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1} transparent opacity={0.7} />
        </mesh>
      )}

      {/* Body */}
      <mesh position={[0, 0.6, 0]}>
        <boxGeometry args={[0.7, 0.9, 0.5]} />
        <meshStandardMaterial color={glowColor} emissive={isNear ? glowColor : "#000"} emissiveIntensity={isNear ? 0.3 : 0} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.25, 0]}>
        <boxGeometry args={[0.55, 0.55, 0.55]} />
        <meshStandardMaterial color="#fde68a" />
      </mesh>
      {/* Eyes */}
      <mesh position={[-0.15, 1.28, 0.28]}>
        <boxGeometry args={[0.1, 0.1, 0.05]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>
      <mesh position={[0.15, 1.28, 0.28]}>
        <boxGeometry args={[0.1, 0.1, 0.05]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>
      {/* NPC-specific hat/accessory */}
      {id === "silas" && (
        <mesh position={[0, 1.65, 0]}>
          <boxGeometry args={[0.6, 0.2, 0.6]} />
          <meshStandardMaterial color="#44403c" />
        </mesh>
      )}
      {id === "elara" && (
        <mesh position={[0, 1.7, 0]}>
          <coneGeometry args={[0.3, 0.6, 4]} />
          <meshStandardMaterial color="#4c1d95" />
        </mesh>
      )}
      {id === "kael" && (
        <mesh position={[0, 1.6, 0]}>
          <boxGeometry args={[0.65, 0.25, 0.65]} />
          <meshStandardMaterial color="#1e3a5f" />
        </mesh>
      )}
      {/* Legs */}
      <mesh position={[-0.18, 0.1, 0]}>
        <boxGeometry args={[0.28, 0.35, 0.28]} />
        <meshStandardMaterial color={glowColor} />
      </mesh>
      <mesh position={[0.18, 0.1, 0]}>
        <boxGeometry args={[0.28, 0.35, 0.28]} />
        <meshStandardMaterial color={glowColor} />
      </mesh>

    </group>
  )
}
