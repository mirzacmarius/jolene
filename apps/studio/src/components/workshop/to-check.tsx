import { CircleAlert } from "lucide-react";

/**
 * What the workshop should look into before making an order, if anything.
 * The same words twice, as for two places alike, are shown once.
 */
export function ToCheck({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-4 rounded-2xl bg-gold/10 p-4 text-sm">
      <p className="flex items-center gap-2 font-medium">
        <CircleAlert className="size-4 text-gold" aria-hidden />
        {title}
      </p>
      <ul className="mt-2 flex list-disc flex-col gap-1 pl-6">
        {[...new Set(items)].map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
