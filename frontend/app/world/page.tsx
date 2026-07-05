"use client"
import dynamic from "next/dynamic"
import "../world-hud.css"

const World = dynamic(() => import("../../components/game/World"), {
  ssr: false,
  loading: () => (
    <div style={{ width:"100vw", height:"100vh", background:"#06080F", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <span style={{ fontFamily:"JetBrains Mono,monospace", color:"#334155", fontSize:"12px", letterSpacing:"0.2em" }}>
        LOADING ASHENVALE...
      </span>
    </div>
  )
})

export default function WorldPage() {
  return <World />
}
