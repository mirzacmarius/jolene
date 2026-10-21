"use client";

import { type Household, summarize } from "@/lib/guest-list";
import { useI18n } from "@/locales/client";

/** The replies counted: who's coming, who isn't, who hasn't said, and menus. */
export function ReplySummary({
  households,
}: {
  households: readonly Household[];
}) {
  const t = useI18n();
  const counts = summarize(households);
  const stats = [
    { label: t("invite.families"), value: counts.families },
    { label: t("invite.invited"), value: counts.invited },
    {
      label: t("invite.coming"),
      value: counts.coming,
      detail:
        counts.children > 0
          ? `${t("invite.adults", { count: counts.adults })} · ${t("invite.children", { count: counts.children })}`
          : null,
      strong: true,
    },
    { label: t("invite.notComingCount"), value: counts.notComing },
    { label: t("invite.waitingCount"), value: counts.waiting },
  ];
  return (
    <section aria-label={t("invite.summary")} className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={
              stat.strong
                ? "rounded-2xl bg-primary p-4 text-primary-foreground"
                : "rounded-2xl bg-secondary/70 p-4"
            }
          >
            <dt className="text-[13px] opacity-80">{stat.label}</dt>
            <dd className="mt-1 font-display text-4xl leading-none tabular-nums">
              {stat.value}
            </dd>
            {stat.detail ? (
              <dd className="mt-2 text-xs opacity-80">{stat.detail}</dd>
            ) : null}
          </div>
        ))}
      </dl>
      {counts.meals.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            {t("invite.mealsCount")}:
          </span>{" "}
          {counts.meals.map(([meal, count]) => `${meal} ${count}`).join(" · ")}
        </p>
      ) : null}
    </section>
  );
}
