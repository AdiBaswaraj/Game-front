export default function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-white/5">
      <div className="absolute inset-0 arcade-grid-bg animate-grid-pan opacity-60" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-arcadia-bg/30 via-transparent to-arcadia-bg" />
      <div className="pointer-events-none absolute -top-32 left-1/2 h-72 w-[60rem] -translate-x-1/2 rounded-full bg-neon-green/10 blur-3xl" />

      <div className="relative mx-auto flex max-w-5xl flex-col items-center px-6 py-20 text-center md:py-28">
        <p className="hero-welcome font-arcade text-[10px] text-neon-cyan/80 md:text-xs">
          ★ WELCOME TO ARCADIA ★
        </p>
        <h1 className="hero-tagline crt-flicker mt-6 font-arcade text-2xl leading-snug text-neon-green drop-shadow-[0_0_14px_rgba(0,255,136,0.55)] sm:text-3xl md:text-5xl">
          INSERT COIN TO PLAY
          <span className="ml-2 inline-block w-3 -translate-y-1 animate-blink bg-neon-green align-middle md:w-4">
            &nbsp;
          </span>
        </h1>
        <p className="hero-subline mt-6 max-w-xl text-sm text-white/60 md:text-base">
          Six arcade classics. Solo runs and head-to-head matches.
          Pick a cabinet and drop in.
        </p>
      </div>
    </section>
  )
}
