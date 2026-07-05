// Ground tiles — checkered green grass like RuneScape
const GRASS_LIGHT = "#5a9e3a"
const GRASS_DARK = "#4a8a2e"
const STONE_COLOR = "#9e9e8a"
const STONE_DARK = "#7a7a68"

export function WorldTiles() {
  return (
    <group>
      {/* Ground plane — tiled grass */}
      {Array.from({ length: 24 }, (_, x) =>
        Array.from({ length: 24 }, (_, z) => {
          const worldX = x * 2 - 23
          const worldZ = z * 2 - 23
          return (
            <mesh
              key={`${x}-${z}`}
              position={[worldX, -0.1, worldZ]}
              receiveShadow
            >
              <boxGeometry args={[2, 0.2, 2]} />
              <meshStandardMaterial
                color={(x + z) % 2 === 0 ? GRASS_LIGHT : GRASS_DARK}
                roughness={1}
              />
            </mesh>
          )
        })
      )}

      {/* Cobblestone town square paths */}
      {Array.from({ length: 7 }, (_, i) =>
        Array.from({ length: 7 }, (_, j) => {
          const px = (i - 3) * 2
          const pz = (j - 3) * 2
          return (
            <mesh key={`path-${i}-${j}`} position={[px, 0.01, pz]}>
              <boxGeometry args={[2, 0.1, 2]} />
              <meshStandardMaterial color={(i + j) % 2 === 0 ? STONE_COLOR : STONE_DARK} roughness={1} />
            </mesh>
          )
        })
      )}

      {/* ── SILAS FORGE (NW corner at -5, 0, -5) ── */}
      <group position={[-5, 0, -5]}>
        {/* Stone foundation/floor */}
        <mesh position={[0, 0.05, 0]}>
          <boxGeometry args={[4.2, 0.1, 4.2]} />
          <meshStandardMaterial color="#6b7280" roughness={1} />
        </mesh>
        {/* Stone walls */}
        <mesh position={[0, 1.2, 0]}>
          <boxGeometry args={[4, 2.4, 4]} />
          <meshStandardMaterial color="#78716c" roughness={1} />
        </mesh>
        {/* Stone bricks pattern front */}
        {[-1.2, 0, 1.2].map((bx, bi) => (
          <mesh key={bi} position={[bx, 1.2, 2.05]}>
            <boxGeometry args={[0.9, 0.35, 0.06]} />
            <meshStandardMaterial color="#57534e" />
          </mesh>
        ))}
        {/* Thatched roof — wide overhanging */}
        <mesh position={[0, 2.65, 0]}>
          <boxGeometry args={[4.8, 0.22, 4.8]} />
          <meshStandardMaterial color="#a16207" roughness={1} />
        </mesh>
        <mesh position={[0, 2.9, 0]}>
          <boxGeometry args={[4.0, 0.22, 4.0]} />
          <meshStandardMaterial color="#ca8a04" roughness={1} />
        </mesh>
        <mesh position={[0, 3.12, 0]}>
          <boxGeometry args={[3.2, 0.22, 3.2]} />
          <meshStandardMaterial color="#eab308" roughness={1} />
        </mesh>
        {/* Chimney */}
        <mesh position={[1.1, 3.6, 1.1]}>
          <boxGeometry args={[0.7, 1.5, 0.7]} />
          <meshStandardMaterial color="#44403c" />
        </mesh>
        <mesh position={[1.1, 4.4, 1.1]}>
          <boxGeometry args={[0.9, 0.2, 0.9]} />
          <meshStandardMaterial color="#292524" />
        </mesh>
        {/* Wooden door */}
        <mesh position={[0, 0.9, 2.03]}>
          <boxGeometry args={[0.8, 1.8, 0.08]} />
          <meshStandardMaterial color="#92400e" />
        </mesh>
        {/* Door knob */}
        <mesh position={[0.3, 0.9, 2.09]}>
          <boxGeometry args={[0.1, 0.1, 0.06]} />
          <meshStandardMaterial color="#d97706" />
        </mesh>
        {/* Window */}
        <mesh position={[-1.3, 1.4, 2.03]}>
          <boxGeometry args={[0.7, 0.6, 0.08]} />
          <meshStandardMaterial color="#7dd3fc" emissive="#0ea5e9" emissiveIntensity={0.1} />
        </mesh>
        {/* Anvil in front */}
        <mesh position={[0, 0.28, 2.8]}>
          <boxGeometry args={[0.7, 0.45, 0.5]} />
          <meshStandardMaterial color="#374151" />
        </mesh>
        <mesh position={[0, 0.55, 2.8]}>
          <boxGeometry args={[0.5, 0.2, 0.35]} />
          <meshStandardMaterial color="#4b5563" />
        </mesh>
        {/* Barrel */}
        <mesh position={[1.3, 0.35, 2.7]}>
          <cylinderGeometry args={[0.3, 0.3, 0.7, 8]} />
          <meshStandardMaterial color="#92400e" />
        </mesh>
        {/* Sign post */}
        <mesh position={[2.3, 1.0, 2.3]}>
          <boxGeometry args={[0.12, 1.8, 0.12]} />
          <meshStandardMaterial color="#78350f" />
        </mesh>
        <mesh position={[2.3, 1.8, 2.3]}>
          <boxGeometry args={[1.1, 0.55, 0.12]} />
          <meshStandardMaterial color="#b45309" />
        </mesh>
      </group>

      {/* ── ELARA TOWER (SE corner at 5, 0, 5) ── */}
      <group position={[5, 0, 5]}>
        {/* Stone base floor */}
        <mesh position={[0, 0.05, 0]}>
          <boxGeometry args={[3.8, 0.1, 3.8]} />
          <meshStandardMaterial color="#4b5563" roughness={1} />
        </mesh>
        {/* Tower body (dark stone) */}
        <mesh position={[0, 2.5, 0]}>
          <boxGeometry args={[3.2, 5, 3.2]} />
          <meshStandardMaterial color="#374151" roughness={1} />
        </mesh>
        {/* Stone brick details */}
        {[-0.8, 0.8].map((bx, bi) =>
          [1, 2.5, 4].map((by, bj) => (
            <mesh key={`et-${bi}-${bj}`} position={[bx, by, 1.62]}>
              <boxGeometry args={[0.8, 0.3, 0.06]} />
              <meshStandardMaterial color="#1f2937" />
            </mesh>
          ))
        )}
        {/* Battlements top */}
        {[-0.9, -0.3, 0.3, 0.9].map((bx, bi) =>
          [-0.9, 0.9].map((bz, bj) => (
            <mesh key={`bt-${bi}-${bj}`} position={[bx, 5.25, bz]}>
              <boxGeometry args={[0.35, 0.6, 0.35]} />
              <meshStandardMaterial color="#374151" />
            </mesh>
          ))
        )}
        {/* Magical roof glow */}
        <mesh position={[0, 5.1, 0]}>
          <boxGeometry args={[3.3, 0.25, 3.3]} />
          <meshStandardMaterial color="#4c1d95" />
        </mesh>
        {/* Glowing windows */}
        <mesh position={[0, 2.8, 1.65]}>
          <boxGeometry args={[0.7, 1.0, 0.1]} />
          <meshStandardMaterial color="#c4b5fd" emissive="#7c3aed" emissiveIntensity={1.2} />
        </mesh>
        <mesh position={[0, 4.0, 1.65]}>
          <boxGeometry args={[0.5, 0.7, 0.1]} />
          <meshStandardMaterial color="#c4b5fd" emissive="#7c3aed" emissiveIntensity={1.5} />
        </mesh>
        {/* Door */}
        <mesh position={[0, 1.1, 1.65]}>
          <boxGeometry args={[0.8, 2.1, 0.1]} />
          <meshStandardMaterial color="#6d28d9" />
        </mesh>
        {/* Magic orb on staff */}
        <mesh position={[-2, 1.8, 1.8]}>
          <boxGeometry args={[0.1, 2.0, 0.1]} />
          <meshStandardMaterial color="#78350f" />
        </mesh>
        <mesh position={[-2, 2.9, 1.8]}>
          <sphereGeometry args={[0.25, 8, 8]} />
          <meshStandardMaterial color="#a78bfa" emissive="#7c3aed" emissiveIntensity={1.5} />
        </mesh>
      </group>

      {/* ── KAEL GUARD POST (SW corner at -5, 0, 5) ── */}
      <group position={[-5, 0, 5]}>
        {/* Stone foundation */}
        <mesh position={[0, 0.05, 0]}>
          <boxGeometry args={[4.0, 0.1, 4.0]} />
          <meshStandardMaterial color="#374151" roughness={1} />
        </mesh>
        {/* Main stone block */}
        <mesh position={[0, 1.1, 0]}>
          <boxGeometry args={[3.8, 2.2, 3.8]} />
          <meshStandardMaterial color="#4b5563" roughness={1} />
        </mesh>
        {/* Battlements */}
        {[-1.2, -0.4, 0.4, 1.2].map((bx, bi) => (
          <mesh key={`kbt-${bi}`} position={[bx, 2.35, 0]}>
            <boxGeometry args={[0.45, 0.55, 3.9]} />
            <meshStandardMaterial color="#374151" />
          </mesh>
        ))}
        {[-1.2, -0.4, 0.4, 1.2].map((bz, bi) => (
          <mesh key={`kbt2-${bi}`} position={[0, 2.35, bz]}>
            <boxGeometry args={[3.9, 0.55, 0.45]} />
            <meshStandardMaterial color="#374151" />
          </mesh>
        ))}
        {/* Gate/Door */}
        <mesh position={[0, 1.1, 1.95]}>
          <boxGeometry args={[1.2, 2.1, 0.1]} />
          <meshStandardMaterial color="#7c2d12" />
        </mesh>
        {/* Portcullis bars */}
        {[-0.35, 0, 0.35].map((bx, bi) => (
          <mesh key={`pc-${bi}`} position={[bx, 1.1, 2.0]}>
            <boxGeometry args={[0.07, 2.0, 0.07]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
        ))}
        {/* Torches on walls */}
        <mesh position={[1.3, 1.7, 2.0]}>
          <boxGeometry args={[0.1, 0.5, 0.1]} />
          <meshStandardMaterial color="#92400e" />
        </mesh>
        <mesh position={[1.3, 1.98, 2.0]}>
          <boxGeometry args={[0.18, 0.18, 0.18]} />
          <meshStandardMaterial color="#fbbf24" emissive="#f97316" emissiveIntensity={2} />
        </mesh>
        <mesh position={[-1.3, 1.7, 2.0]}>
          <boxGeometry args={[0.1, 0.5, 0.1]} />
          <meshStandardMaterial color="#92400e" />
        </mesh>
        <mesh position={[-1.3, 1.98, 2.0]}>
          <boxGeometry args={[0.18, 0.18, 0.18]} />
          <meshStandardMaterial color="#fbbf24" emissive="#f97316" emissiveIntensity={2} />
        </mesh>
        {/* Weapon rack */}
        <mesh position={[0, 0.6, -2.2]}>
          <boxGeometry args={[2.0, 0.1, 0.3]} />
          <meshStandardMaterial color="#78350f" />
        </mesh>
        {[-0.6, 0, 0.6].map((bx, bi) => (
          <mesh key={`wr-${bi}`} position={[bx, 1.3, -2.2]}>
            <boxGeometry args={[0.08, 1.4, 0.08]} />
            <meshStandardMaterial color="#94a3b8" />
          </mesh>
        ))}
      </group>

      {/* Town square fountain */}
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[1.2, 1.5, 0.45, 12]} />
        <meshStandardMaterial color="#64748b" roughness={1} />
      </mesh>
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[1.05, 1.05, 0.2, 12]} />
        <meshStandardMaterial color="#0ea5e9" transparent opacity={0.75} />
      </mesh>
      {/* Centre spire */}
      <mesh position={[0, 0.7, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.8, 6]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>

      {/* Large trees around the border */}
      {[
        [-9,-9],[-9,0],[-9,9],[0,-9],[0,9],[9,-9],[9,0],[9,9],
        [-6,-9],[6,-9],[-9,-6],[-9,6],[9,-6],[9,6],[-6,9],[6,9]
      ].map(([x,z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.6, 0]}>
            <boxGeometry args={[0.5, 1.2, 0.5]} />
            <meshStandardMaterial color="#78350f" />
          </mesh>
          <mesh position={[0, 1.8, 0]}>
            <boxGeometry args={[1.8, 1.8, 1.8]} />
            <meshStandardMaterial color="#166534" />
          </mesh>
          <mesh position={[0, 2.9, 0]}>
            <boxGeometry args={[1.2, 1.2, 1.2]} />
            <meshStandardMaterial color="#15803d" />
          </mesh>
          <mesh position={[0, 3.7, 0]}>
            <boxGeometry args={[0.7, 0.7, 0.7]} />
            <meshStandardMaterial color="#14532d" />
          </mesh>
        </group>
      ))}

      {/* Bush clusters around buildings */}
      {[
        [-3,-5],[-7,-3],[-3,-7],[-7,-5],
        [3,7],[7,3],[3,9],[7,5],
        [-3,7],[-7,3],[-3,9],[-7,5],
      ].map(([x,z], i) => (
        <mesh key={`bush-${i}`} position={[x, 0.35, z]}>
          <boxGeometry args={[0.8, 0.7, 0.8]} />
          <meshStandardMaterial color="#4d7c0f" />
        </mesh>
      ))}
    </group>
  )
}
