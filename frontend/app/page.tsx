"use client";
// app/page.tsx — Hero landing page for Revenant

import Link from "next/link";
import { useEffect } from "react";
import Lenis from "@studio-freight/lenis";
import { Silas } from "@/components/portraits/Silas";
import { Elara } from "@/components/portraits/Elara";
import { Kael } from "@/components/portraits/Kael";

// CSS-only floating background particles
function ParticleField() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {Array.from({ length: 30 }).map((_, i) => {
        const size = Math.random() * 5 + 3;
        const color = Math.random() > 0.5 ? "bg-purple" : "bg-amber";
        const delay = Math.random() * 8;
        const left = Math.random() * 100;
        const top = Math.random() * 100;
        return (
          <div
            key={i}
            className={`absolute rounded-full opacity-25 float-particle ${color}`}
            style={{
              width: size,
              height: size,
              left: `${left}%`,
              top: `${top}%`,
              animationDelay: `${delay}s`,
              animationDuration: `${Math.random() * 6 + 7}s`,
            }}
          />
        );
      })}
    </div>
  );
}

export default function LandingPage() {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    return () => lenis.destroy();
  }, []);

  return (
    <div className="min-h-screen bg-void text-primary selection:bg-purple/30 font-body scroll-smooth">
      {/* Sticky Floating Navbar */}
      <header className="sticky top-0 left-0 right-0 z-50 bg-[#06080F]/85 backdrop-blur-md border-b border-border/40 px-6 py-4 flex items-center justify-between">
        <div className="max-w-6xl mx-auto w-full flex items-center justify-between">
          <Link href="/" className="font-decorative text-sm text-purple-glow tracking-[0.2em] header-glow uppercase">
            REVENANT
          </Link>
          
          <nav className="hidden md:flex items-center gap-8 font-display text-[10px] uppercase tracking-[0.25em] text-secondary">
            <a href="#hero" className="hover:text-purple-glow transition-colors">Hero</a>
            <a href="#problem" className="hover:text-purple-glow transition-colors">Problem</a>
            <a href="#solution" className="hover:text-purple-glow transition-colors">Solution</a>
            <a href="#api" className="hover:text-purple-glow transition-colors">API Surface</a>
            <a href="#npcs" className="hover:text-purple-glow transition-colors">NPCs</a>
          </nav>

          <Link
            href="/play"
            className="hover:text-purple-glow transition-colors cursor-pointer uppercase font-semibold font-display text-[11px] tracking-[0.15em]"
            style={{
              fontFamily: "Cinzel",
              color: "var(--text-secondary)",
            }}
          >
            Enter World
          </Link>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 1: HERO HEADER & ABOVE FOLD                                 */}
      {/* ------------------------------------------------------------------ */}
      <section id="hero" className="min-h-screen flex flex-col relative justify-between px-6 py-6 border-b border-border">
        <ParticleField />
        
        {/* Top spacer for vertical alignment */}
        <div className="h-8 z-10" />

        {/* Hero Title */}
        <div className="text-center max-w-3xl mx-auto z-10 my-auto flex flex-col gap-6">
          {/* Geometric Sword SVG */}
          <div className="mb-4">
            <svg
              width="120"
              height="120"
              viewBox="0 0 120 120"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="mx-auto filter drop-shadow-[0_0_15px_rgba(124,58,237,0.5)] text-purple-glow"
            >
              {/* Blade */}
              <path d="M60 15 L64 35 L64 85 L60 90 L56 85 L56 35 Z" fill="#94A3B8" stroke="#E2E8F0" strokeWidth="1" />
              <path d="M60 15 L60 90" stroke="#F8FAFC" strokeWidth="1" />
              {/* Crossguard */}
              <path d="M45 88 L75 88" stroke="#E2E8F0" strokeWidth="3" strokeLinecap="round" />
              <circle cx="45" cy="88" r="2" fill="#FCD34D" />
              <circle cx="75" cy="88" r="2" fill="#FCD34D" />
              {/* Hilt */}
              <rect x="58" y="90" width="4" height="18" rx="1" fill="#78350F" stroke="#E2E8F0" strokeWidth="0.75" />
              {/* Pommel */}
              <circle cx="60" cy="110" r="3.5" fill="#94A3B8" stroke="#E2E8F0" strokeWidth="1" />
            </svg>
          </div>

          <h2 className="font-decorative text-3xl sm:text-5xl text-primary leading-tight tracking-wide header-glow">
            The first NPC engine where <br className="hidden sm:inline" />
            rumors are graph edges.
          </h2>

          <p className="font-display text-sm sm:text-base text-secondary tracking-widest max-w-xl mx-auto leading-relaxed">
            Trust is bi-temporal. <br />
            Forgetting costs 50 gold.
          </p>

          <div className="flex justify-center gap-4 mt-4">
            <Link
              href="/play"
              className="px-6 py-3 bg-purple hover:bg-purple-glow text-white text-xs font-display tracking-widest uppercase rounded-lg shadow-lg shadow-purple/20 transition-all duration-200"
            >
              Enter Ashenvale →
            </Link>
            <a
              href="https://github.com/AmanM006/revenant"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 border border-border hover:border-bright bg-raised text-primary text-xs font-display tracking-widest uppercase rounded-lg transition-all duration-200"
            >
              View on GitHub
            </a>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="text-center font-mono text-[10px] text-muted tracking-widest uppercase z-10 flex flex-col items-center gap-1.5 animate-pulse">
          <span>scroll to explore</span>
          <span>▼</span>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 2: THE PROBLEM                                             */}
      {/* ------------------------------------------------------------------ */}
      <section id="problem" className="min-h-screen flex flex-col justify-center items-center px-6 py-12 border-b border-border bg-raised/20 relative">
        <div className="max-w-4xl mx-auto w-full text-center flex flex-col gap-10">
          <h2 className="font-display text-2xl sm:text-3xl text-primary uppercase tracking-widest">
            Every NPC in every game <br />
            has the same affliction.
          </h2>

          {/* Cards comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left max-w-2xl mx-auto w-full">
            <div className="session-card">
              <div className="session-label">SESSION 1</div>
              <div className="session-line">
                <span className="speaker">You</span>
                <span className="line">&quot;I helped defend the village.&quot;</span>
              </div>
              <div className="session-line">
                <span className="speaker">Guard</span>
                <span className="line">&quot;You are a true hero.&quot;</span>
              </div>
            </div>

            <div className="session-card session-card--dead">
              <div className="session-label">SESSION 2</div>
              <div className="session-line">
                <span className="speaker">You</span>
                <span className="line">&quot;I need entry to the keep.&quot;</span>
              </div>
              <div className="session-line">
                <span className="speaker">Guard</span>
                <span className="line">&quot;Halt, stranger. State your business.&quot;</span>
              </div>
              <div className="session-dead-badge">NO MEMORY. ETERNAL RESET.</div>
            </div>
          </div>

          <div className="flex flex-col gap-2 max-w-md mx-auto">
            <p className="font-display text-base text-purple-glow tracking-widest uppercase">
              Stateless. Scripted. Amnesiac.
            </p>
            <p className="font-body text-xs text-secondary leading-relaxed">
              In modern gaming, character memory resets completely each turn. Every session begins at zero.
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 3: THE SOLUTION                                            */}
      {/* ------------------------------------------------------------------ */}
      <section id="solution" className="min-h-screen flex flex-col justify-center px-6 py-16 border-b border-border relative">
        <div className="max-w-6xl mx-auto w-full flex flex-col gap-12">
          <div className="text-center flex flex-col gap-3">
            <h2 className="font-display text-2xl sm:text-3xl text-primary uppercase tracking-widest">
              Cognee gives NPCs a memory.
            </h2>
            <p className="font-body text-xs text-secondary max-w-md mx-auto leading-relaxed">
              Revenant connects NPC minds to a hybrid graph-vector database. Decisions propagate; actions register permanently.
            </p>
          </div>

          {/* Solution features grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto w-full">
            {/* Card 1 */}
            <div className="border border-border bg-raised hover:border-purple/60 hover:shadow-[0_0_20px_rgba(124,58,237,0.15)] rounded-xl p-6 transition-all duration-300 flex flex-col gap-3.5 group">
              <span className="text-3xl group-hover:scale-110 transition-transform duration-200 self-start">🌐</span>
              <h3 className="font-display text-sm uppercase tracking-wider text-primary">Rumor Mill</h3>
              <p className="font-body text-xs text-secondary leading-relaxed">
                Async <code className="text-purple-glow font-mono text-[10px]">improve()</code> graph pipeline propagates seeds across graph edges. If you steal from Silas, Kael learns of it through propagation.
              </p>
            </div>
            {/* Card 2 */}
            <div className="border border-border bg-raised hover:border-purple/60 hover:shadow-[0_0_20px_rgba(124,58,237,0.15)] rounded-xl p-6 transition-all duration-300 flex flex-col gap-3.5 group">
              <span className="text-3xl group-hover:scale-110 transition-transform duration-200 self-start">🧠</span>
              <h3 className="font-display text-sm uppercase tracking-wider text-primary">Amnesia Spell</h3>
              <p className="font-body text-xs text-secondary leading-relaxed">
                Surgically sever knowledge using <code className="text-purple-glow font-mono text-[10px]">forget()</code> at document-level granularity. Erasing costs 50 gold and creates a permanent forgetting trace.
              </p>
            </div>
            {/* Card 3 */}
            <div className="border border-border bg-raised hover:border-purple/60 hover:shadow-[0_0_20px_rgba(124,58,237,0.15)] rounded-xl p-6 transition-all duration-300 flex flex-col gap-3.5 group">
              <span className="text-3xl group-hover:scale-110 transition-transform duration-200 self-start">⛓</span>
              <h3 className="font-display text-sm uppercase tracking-wider text-primary">Provenance Chain</h3>
              <p className="font-body text-xs text-secondary leading-relaxed">
                Traverse links using multi-hop <code className="text-purple-glow font-mono text-[10px]">GRAPH_COMPLETION</code> to find exactly who told who. Trace rumor histories in dialog dialogue naturally.
              </p>
            </div>
            {/* Card 4 */}
            <div className="border border-border bg-raised hover:border-purple/60 hover:shadow-[0_0_20px_rgba(124,58,237,0.15)] rounded-xl p-6 transition-all duration-300 flex flex-col gap-3.5 group">
              <span className="text-3xl group-hover:scale-110 transition-transform duration-200 self-start">📊</span>
              <h3 className="font-display text-sm uppercase tracking-wider text-primary">Bi-temporal Trust</h3>
              <p className="font-body text-xs text-secondary leading-relaxed">
                COGXFact elements with valid-from and valid-until ranges capture trust score histories. Watch NPC opinions fluctuate over the course of game days.
              </p>
            </div>
            {/* Card 5 */}
            <div className="border border-border bg-raised hover:border-purple/60 hover:shadow-[0_0_20px_rgba(124,58,237,0.15)] rounded-xl p-6 transition-all duration-300 flex flex-col gap-3.5 group">
              <span className="text-3xl group-hover:scale-110 transition-transform duration-200 self-start">🏛</span>
              <h3 className="font-display text-sm uppercase tracking-wider text-primary">OWL Ontology</h3>
              <p className="font-body text-xs text-secondary leading-relaxed">
                Ground NPC entities, trust edges, rumors, and interactions inside a structured semantic schema. Memory is entity-grounded, not just vector noise.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 4: COGNEE API SURFACE                                       */}
      {/* ------------------------------------------------------------------ */}
      <section id="api" className="py-16 border-b border-border bg-raised/10 px-6">
        <div className="max-w-5xl mx-auto w-full flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <h2 className="font-display text-xl text-primary uppercase tracking-widest">
              Cognee API Surface
            </h2>
            <p className="font-body text-xs text-secondary">
              Revenant leverages Cognee Cloud to implement graph-grounded cognitive state mechanics.
            </p>
          </div>

          {/* API Surface Table */}
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full border-collapse text-left text-xs font-mono">
              <thead>
                <tr className="bg-surface border-b border-border font-display uppercase tracking-widest text-[10px] text-secondary">
                  <th className="px-5 py-3.5">Mechanic</th>
                  <th className="px-5 py-3.5">Endpoint</th>
                  <th className="px-5 py-3.5 text-secondary/75">Game Implementation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                <tr className="hover:bg-white/5 transition-colors">
                  <td className="px-5 py-3 font-display font-semibold text-primary">Rumor Mill</td>
                  <td className="px-5 py-3 text-orange font-medium">POST /api/v1/cognify</td>
                  <td className="px-5 py-3 text-secondary font-body">improve() creates cross-NPC graph edges from rumor seeds</td>
                </tr>
                <tr className="bg-surface/30 hover:bg-white/5 transition-colors">
                  <td className="px-5 py-3 font-display font-semibold text-primary">Amnesia Spell</td>
                  <td className="px-5 py-3 text-purple-glow font-medium">POST /api/v1/forget</td>
                  <td className="px-5 py-3 text-secondary font-body">Surgical deletion at document_id granularity (costs 50g)</td>
                </tr>
                <tr className="hover:bg-white/5 transition-colors">
                  <td className="px-5 py-3 font-display font-semibold text-primary">Dialogue Recall</td>
                  <td className="px-5 py-3 text-blue font-medium">POST /api/v1/recall</td>
                  <td className="px-5 py-3 text-secondary font-body">Retrieves contextual knowledge graph facts for LLM prompts</td>
                </tr>
                <tr className="bg-surface/30 hover:bg-white/5 transition-colors">
                  <td className="px-5 py-3 font-display font-semibold text-primary">Provenance Trace</td>
                  <td className="px-5 py-3 text-blue font-medium">POST /api/v1/recall</td>
                  <td className="px-5 py-3 text-secondary font-body">Uses GRAPH_COMPLETION to resolve multi-hop links to the rumor source</td>
                </tr>
                <tr className="hover:bg-white/5 transition-colors">
                  <td className="px-5 py-3 font-display font-semibold text-primary">OWL Ontology</td>
                  <td className="px-5 py-3 text-amber font-medium">POST /api/v1/ontology/apply</td>
                  <td className="px-5 py-3 text-secondary font-body">Applies strict RDF schema to ground NPCs, trust, and events</td>
                </tr>
                <tr className="bg-surface/30 hover:bg-white/5 transition-colors">
                  <td className="px-5 py-3 font-display font-semibold text-primary">Vector/Graph Load</td>
                  <td className="px-5 py-3 text-amber font-medium">POST /api/v1/remember/entry</td>
                  <td className="px-5 py-3 text-secondary font-body">Writes typed entries (qa, trace, feedback, skill_run) on each turn</td>
                </tr>
                <tr className="hover:bg-white/5 transition-colors">
                  <td className="px-5 py-3 font-display font-semibold text-primary">Live Visualizer</td>
                  <td className="px-5 py-3 text-blue font-medium">GET /api/v1/datasets/&#123;id&#125;/graph</td>
                  <td className="px-5 py-3 text-secondary font-body">Fetches updated graph node topology to render live forces layout</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 5: MEET THE NPCS                                           */}
      {/* ------------------------------------------------------------------ */}
      <section id="npcs" className="min-h-screen flex flex-col justify-center px-6 py-16 border-b border-border relative">
        <div className="max-w-5xl mx-auto w-full flex flex-col gap-10">
          <div className="text-center">
            <h2 className="font-display text-2xl text-primary uppercase tracking-widest">
              Meet the NPCs
            </h2>
            <p className="font-body text-xs text-secondary mt-1">
              Select one and test their memory. They learn from each other.
            </p>
          </div>

          {/* Three NPC showcase cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl mx-auto">
            {/* Silas Card */}
            <div className="border border-border bg-surface rounded-xl p-5 shadow-lg flex flex-col gap-3 text-center items-center group">
              <div className="w-40 h-40 rounded-lg overflow-hidden border border-border bg-void mb-2 group-hover:border-purple/40 transition-colors">
                <Silas size={160} />
              </div>
              <h3 className="font-display font-bold text-base text-primary uppercase tracking-wider">
                ⚔ Silas
              </h3>
              <span className="text-[11px] font-mono text-muted uppercase tracking-widest">Blacksmith</span>
              <p className="font-body text-xs text-secondary max-w-xs leading-relaxed min-h-[48px]">
                &quot;Proud craftsman. Holds grudges forever.&quot;
              </p>
              <div className="w-full mt-3 flex flex-col gap-1.5 text-left border-t border-border/40 pt-3">
                <div className="flex justify-between text-[10px] font-mono text-secondary">
                  <span>Trust Bar</span>
                  <span>50 / 100</span>
                </div>
                <div className="h-1.5 bg-void rounded-full overflow-hidden border border-border/40">
                  <div className="h-full bg-amber rounded-full" style={{ width: "50%" }} />
                </div>
              </div>
            </div>

            {/* Elara Card */}
            <div className="border border-border bg-surface rounded-xl p-5 shadow-lg flex flex-col gap-3 text-center items-center group">
              <div className="w-40 h-40 rounded-lg overflow-hidden border border-border bg-void mb-2 group-hover:border-purple/40 transition-colors">
                <Elara size={160} />
              </div>
              <h3 className="font-display font-bold text-base text-primary uppercase tracking-wider">
                ✦ Elara
              </h3>
              <span className="text-[11px] font-mono text-muted uppercase tracking-widest">Mage</span>
              <p className="font-body text-xs text-secondary max-w-xs leading-relaxed min-h-[48px]">
                &quot;Forgives once. Remembers always.&quot;
              </p>
              <div className="w-full mt-3 flex flex-col gap-1.5 text-left border-t border-border/40 pt-3">
                <div className="flex justify-between text-[10px] font-mono text-secondary">
                  <span>Trust Bar</span>
                  <span>65 / 100</span>
                </div>
                <div className="h-1.5 bg-void rounded-full overflow-hidden border border-border/40">
                  <div className="h-full bg-amber rounded-full" style={{ width: "65%" }} />
                </div>
              </div>
            </div>

            {/* Kael Card */}
            <div className="border border-border bg-surface rounded-xl p-5 shadow-lg flex flex-col gap-3 text-center items-center group">
              <div className="w-40 h-40 rounded-lg overflow-hidden border border-border bg-void mb-2 group-hover:border-purple/40 transition-colors">
                <Kael size={160} />
              </div>
              <h3 className="font-display font-bold text-base text-primary uppercase tracking-wider">
                ⚔ Kael
              </h3>
              <span className="text-[11px] font-mono text-muted uppercase tracking-widest">Guard Captain</span>
              <p className="font-body text-xs text-secondary max-w-xs leading-relaxed min-h-[48px]">
                &quot;Never forgets a crime. Has a price.&quot;
              </p>
              <div className="w-full mt-3 flex flex-col gap-1.5 text-left border-t border-border/40 pt-3">
                <div className="flex justify-between text-[10px] font-mono text-secondary">
                  <span>Trust Bar</span>
                  <span>40 / 100</span>
                </div>
                <div className="h-1.5 bg-void rounded-full overflow-hidden border border-border/40">
                  <div className="h-full bg-amber rounded-full" style={{ width: "40%" }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 6: CTA                                                     */}
      {/* ------------------------------------------------------------------ */}
      <section id="cta" className="h-[50vh] flex flex-col justify-center items-center px-6 relative text-center">
        <ParticleField />
        <div className="max-w-2xl mx-auto w-full z-10 flex flex-col gap-5 items-center">
          <h2 className="font-decorative text-2xl sm:text-3xl text-purple-glow tracking-wider uppercase leading-tight header-glow">
            Ready to give your NPCs a memory?
          </h2>

          <Link
            href="/play"
            className="px-8 py-3.5 bg-purple hover:bg-purple-glow text-white text-xs font-display tracking-widest uppercase rounded-lg shadow-lg shadow-purple/20 transition-all duration-200"
          >
            Enter Ashenvale →
          </Link>

          <p className="text-[9px] font-mono text-muted uppercase tracking-widest mt-4">
            Built for WeMakeDevs × Cognee Hackathon 2026
          </p>
        </div>
      </section>
    </div>
  );
}
