export function StatsFaq({
  heading,
  description,
  faqs,
}: {
  heading: string;
  description: string;
  faqs: { q: string; a: string }[];
}) {
  return (
    <section className="mb-12" aria-labelledby="faq-heading">
      <div className="border-t border-border pt-10 mb-6">
        <h2
          id="faq-heading"
          className="text-lg font-semibold text-foreground mb-1"
        >
          {heading}
        </h2>
        <p className="font-mono text-xs text-muted">{description}</p>
      </div>

      <div className="space-y-2">
        {faqs.map((faq, i) => (
          <details
            key={i}
            className="group rounded-lg border border-border bg-surface overflow-hidden"
          >
            <summary className="flex cursor-pointer items-center gap-2 px-5 py-4 font-display text-sm font-semibold text-foreground select-none hover:bg-surface-hover transition-colors [&::-webkit-details-marker]:hidden list-none">
              <span className="text-accent font-mono text-xs shrink-0">
                [{String(i + 1).padStart(2, "0")}]
              </span>
              <span className="flex-1">{faq.q}</span>
              <svg
                className="h-4 w-4 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </summary>
            <div className="border-t border-border px-5 py-4">
              <p className="font-mono text-xs leading-relaxed text-muted pl-8">
                {faq.a}
              </p>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
