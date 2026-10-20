// Adapted from Marée by LN (MIT License): see THIRD-PARTY-NOTICES.md.
"use client";

import { ArrowRightIcon, CheckIcon } from "lucide-react";
import Image, { type StaticImageData } from "next/image";
import { type ReactNode, useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface ExplorerStep {
  alt: string;
  image: StaticImageData;
  label: string;
  note: string;
  text: string;
  title: string;
}

interface StepsExplorerProps {
  children: ReactNode;
  footnote: ReactNode;
  listLabel: string;
  steps: ExplorerStep[];
}

function ordinal(index: number) {
  return String(index + 1).padStart(2, "0");
}

export function StepsExplorer({ children, footnote, listLabel, steps }: StepsExplorerProps) {
  const [active, setActive] = useState(0);
  const step = steps[active];

  return (
    <Tabs
      className="grid bg-sage lg:min-h-162 lg:grid-cols-2"
      onValueChange={(value) => setActive(Number(value))}
      value={active}
    >
      <div
        className="reveal reveal-unfold relative min-h-105 overflow-hidden lg:min-h-162"
        data-reveal
      >
        {step && (
          <Image
            alt={step.alt}
            className="object-cover motion-safe:animate-unveil"
            fill
            key={step.title}
            placeholder="blur"
            sizes="100vw"
            src={step.image}
          />
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[30%] bg-linear-to-b from-transparent to-primary/30" />
        <p className="absolute inset-x-7.5 bottom-6 flex justify-between gap-5 text-[0.5625rem] tracking-[0.12em] text-primary-foreground uppercase [text-shadow:0_1px_8px_rgb(0_0_0/0.5)]">
          <span>{step?.note}</span>
          <span>
            {ordinal(active)} / {ordinal(steps.length - 1)}
          </span>
        </p>
      </div>
      <div className="grid gap-10 self-center px-[9%] py-15 lg:px-[12%] lg:py-20">
        <div className="grid justify-items-start gap-5">{children}</div>
        <div className="grid gap-5">
          <TabsList aria-label={listLabel} className="border-b border-primary/25">
            {steps.map((item, index) => (
              <TabsTrigger
                className="group/tab -mb-px flex min-h-11 flex-1 items-center gap-2.5 border-b-2 border-transparent py-4 pr-4 text-[0.9375rem] opacity-45 transition-[opacity,border-color] duration-250 hover:opacity-80 data-active:border-foreground data-active:opacity-100 md:text-[1.0625rem]"
                key={item.title}
                value={index}
              >
                <small className="mt-0.5 self-start text-[0.5625rem]">{ordinal(index)}</small>
                {item.label}
                {index < steps.length - 1 ? (
                  <ArrowRightIcon
                    aria-hidden="true"
                    className="ml-auto hidden size-4 stroke-[1.25] transition-transform duration-350 group-hover/tab:translate-x-1 sm:block motion-reduce:transition-none"
                  />
                ) : (
                  <CheckIcon
                    aria-hidden="true"
                    className="ml-auto hidden size-4 stroke-[1.25] transition-transform duration-500 group-hover/tab:rotate-12 sm:block motion-reduce:transition-none"
                  />
                )}
              </TabsTrigger>
            ))}
          </TabsList>
          {steps.map((item, index) => (
            <TabsContent
              className="grid min-h-36 content-start gap-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2.5 motion-safe:duration-500"
              key={item.title}
              value={index}
            >
              <h3 className="text-[1.4375rem] leading-tight tracking-[-0.035em]">{item.title}</h3>
              <p className="max-w-sm text-[0.8125rem] leading-[1.9]">{item.text}</p>
            </TabsContent>
          ))}
        </div>
        {footnote}
      </div>
    </Tabs>
  );
}
