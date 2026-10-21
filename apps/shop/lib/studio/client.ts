"use client";

import { useEffect, useState } from "react";

const answers = new Map<string, Promise<unknown>>();

// /studio is the studio, another app on this domain, which answers 404 for what it doesn't keep.
function fetchStudio<T>(path: string): Promise<T | null> {
  const known = answers.get(path);
  if (known) return known as Promise<T | null>;
  const answer = fetch(`/studio${path}`).then(async (response) => {
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`The studio answered ${response.status} for ${path}`);
    return (await response.json()) as T;
  });
  answers.set(path, answer);
  answer.catch(() => answers.delete(path));
  return answer;
}

// Undefined while the studio is asked; null when it has nothing, or for no path.
export function useStudioAnswer<T>(path: string | undefined): T | null | undefined {
  const [answer, setAnswer] = useState<{ path: string; value: T | null }>();
  useEffect(() => {
    if (!path) return;
    let isCurrent = true;
    fetchStudio<T>(path)
      .catch(() => null)
      .then((value) => {
        if (isCurrent) setAnswer({ path, value });
      });
    return () => {
      isCurrent = false;
    };
  }, [path]);
  if (!path) return null;
  return answer?.path === path ? answer.value : undefined;
}
