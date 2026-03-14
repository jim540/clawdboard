import { Link } from "@/i18n/navigation";
import { CopyIconButton } from "@/components/leaderboard/CopyIconButton";

export function StatsCta({
  heading,
  description,
  primaryLabel,
  primaryHref,
  secondaryLabel,
  secondaryHref,
}: {
  heading: string;
  description: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
}) {
  return (
    <section
      className="rounded-lg border border-accent/30 bg-accent/5 p-8 text-center"
      aria-labelledby="cta-heading"
    >
      <h2
        id="cta-heading"
        className="font-display text-lg font-bold text-foreground mb-2"
      >
        {heading}
      </h2>
      <p className="font-mono text-sm text-muted mb-5">{description}</p>

      <div className="flex items-center justify-center gap-2 mb-6">
        <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 font-mono text-sm">
          <span className="text-dim/60 select-none">$</span>
          <code className="text-foreground/80">npx clawdboard auth</code>
          <CopyIconButton text="npx clawdboard auth" />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link
          href={primaryHref}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 font-mono text-sm font-semibold text-background transition-colors hover:bg-accent/90"
        >
          {primaryLabel}
        </Link>
        <Link
          href={secondaryHref}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 font-mono text-sm text-muted transition-colors hover:text-foreground hover:border-foreground/20"
        >
          {secondaryLabel}
        </Link>
      </div>
    </section>
  );
}
