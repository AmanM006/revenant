"use client"
import { Canvas } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import { Player } from "./Player"
import { NPCCharacter } from "./NPCCharacter"
import { WorldTiles } from "./WorldTiles"
import { HUD } from "./HUD"
import { useGameStore } from "./store"
import * as THREE from "three"

export default function World() {
  const { playerPos } = useGameStore()

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#7ab547" }}>
      <Canvas
        orthographic
        camera={{ zoom: 55, position: [14, 14, 14], near: -200, far: 500 }}
        gl={{ antialias: false }}
        dpr={1}
        style={{ imageRendering: "pixelated" }}
      >
        {/* Sunny medieval day — warm bright light */}
        <ambientLight intensity={1.1} color="#fff8e7" />
        <directionalLight
          position={[20, 30, 15]}
          intensity={1.6}
          color="#ffffff"
          castShadow
        />
        {/* Fill light from opposite */}
        <directionalLight position={[-10, 10, -10]} intensity={0.4} color="#c7d2fe" />

        {/* NPC area highlights */}
        <pointLight position={[-5, 3, -5]} intensity={2} color="#f97316" distance={8} />  {/* Silas forge */}
        <pointLight position={[5, 4, 5]} intensity={3} color="#a78bfa" distance={10} />   {/* Elara tower */}
        <pointLight position={[-5, 2.5, 5]} intensity={2} color="#fbbf24" distance={6} /> {/* Kael torches */}

        {/* Horizon sky fog — matches sky blue */}
        <fog attach="fog" args={["#7ab547", 40, 90]} />

        {/* World tiles + buildings */}
        <WorldTiles />

        {/* Player */}
        <Player />

        {/* NPCs — positioned near their buildings */}
        <NPCCharacter
          id="silas"
          name="Silas the Blacksmith"
          position={[-5, 0, -2.2]}   // In front of Silas Forge door
          color="#f97316"
          glowColor="#7c2d12"
        />
        <NPCCharacter
          id="elara"
          name="Elara the Mage"
          position={[5, 0, 2.8]}     // In front of Elara Tower door
          color="#a78bfa"
          glowColor="#4c1d95"
        />
        <NPCCharacter
          id="kael"
          name="Kael the Captain"
          position={[-5, 0, 2.8]}    // In front of Kael Guard Post gate
          color="#60a5fa"
          glowColor="#1e3a5f"
        />

        {/* Camera follows player, right-click rotates */}
        <OrbitControls
          target={[playerPos.x, 0.8, playerPos.z]}
          enableDamping
          dampingFactor={0.12}
          mouseButtons={{
            LEFT: null as unknown as THREE.MOUSE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.ROTATE,
          }}
          minZoom={30}   // max zoom OUT — stops white from showing
          maxZoom={120}  // max zoom IN
          minPolarAngle={Math.PI / 6}   // can't go below horizon
          maxPolarAngle={Math.PI / 2.5} // can't go overhead
        />
      </Canvas>

      <HUD />
    </div>
  )
}
