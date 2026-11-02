export function TeamsHero({ managedArtwork }: { readonly managedArtwork?: { readonly src:string; readonly alt:string; readonly width:number; readonly height:number } }) {
  return (
    <section className="teams-hero-pro">
      {managedArtwork ? <img className="teams-hero-pro__managed-artwork" src={managedArtwork.src} alt={managedArtwork.alt} width={managedArtwork.width} height={managedArtwork.height} /> : <>
        <div>
          <span className="eyebrow">TEAMS</span>
          <h1>Discover teams. Find opponents.</h1>
          <p>Build your squad, publish your identity, send challenges and manage matchday from the Coach Control Room.</p>
        </div>
        <div className="teams-hero-pro-art" aria-hidden="true"><span className="teams-shield">H</span><i className="teams-ball">⚽</i></div>
      </>}
    </section>
  );
}
