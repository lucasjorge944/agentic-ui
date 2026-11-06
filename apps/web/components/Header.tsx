"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/reservar", label: "Nova reserva" },
  { href: "/reservas", label: "Minhas reservas" },
];

export function Header() {
  const pathname = usePathname();
  return (
    <header className="border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-5xl items-center justify-between gap-2 px-4">
        <Link href="/reservar" className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-full bg-accent text-lg">
            🏐
          </span>
          <span className="hidden text-lg font-bold tracking-tight sm:inline">
            Astral Beach Sports
          </span>
        </Link>
        <nav className="flex gap-1" aria-label="Principal">
          {links.map((l) => {
            const active = pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  buttonVariants({ variant: active ? "default" : "ghost", size: "lg" }),
                  "rounded-full px-4",
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
