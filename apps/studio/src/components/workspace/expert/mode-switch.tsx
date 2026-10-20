"use client";

import { SegmentedControl } from "@jolene/ui/segmented-control";
import { useI18n } from "@/locales/client";
import type { DesignMode } from "./use-mode";

/**
 * Simple or expert mode, in the editor's header. Expert mode needs a large
 * screen, so the switch only shows on one.
 */
export function ModeSwitch({
  mode,
  onChange,
}: {
  mode: DesignMode;
  onChange: (mode: DesignMode) => void;
}) {
  const t = useI18n();
  return (
    <SegmentedControl
      label={t("expert.mode.label")}
      value={mode}
      onValueChange={onChange}
      options={[
        { value: "simple", label: t("expert.mode.simple") },
        { value: "expert", label: t("expert.mode.expert") },
      ]}
      className="hidden lg:inline-flex"
    />
  );
}
