import type { Metadata } from "next";
import { Header } from "@/components/Header";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Astral Beach Sports — Reserve sua quadra",
  description: "Reserve quadras de esportes de areia conversando com o assistente.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={cn("h-full antialiased", "font-sans", geist.variable)}>
      <body className="flex h-full min-h-screen flex-col bg-background text-foreground">
        <Header />
        <main className="flex min-h-0 flex-1 flex-col">{children}</main>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
