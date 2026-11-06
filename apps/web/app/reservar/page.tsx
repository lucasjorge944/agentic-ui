"use client";

import { CopilotKit, CopilotChat, useConfigureSuggestions } from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";
import { catalog } from "@/lib/a2ui/catalog";


function Suggestions() {
  useConfigureSuggestions({
    suggestions: [
      { title: "Alugar uma quadra", message: "Quero alugar uma quadra" },
      { title: "Ver disponibilidade", message: "Quais horários estão disponíveis hoje?" },
      { title: "Minha reserva", message: "Quero consultar minha reserva" },
    ],
    available: "always",
  });
  return null;
}

export default function ReservarPage() {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit" a2ui={{ catalog }}>
      <Suggestions />
      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-2 py-4 sm:px-4">
        <CopilotChat
          agentId="default"
          className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
          labels={{
            modalHeaderTitle: "Assistente de reservas",
            welcomeMessageText:
              "Olá! Sou o assistente do Astral Beach Sports. Posso reservar uma quadra para você — é só dizer o que precisa.",
            chatInputPlaceholder: "Digite sua mensagem…",
          }}
        />
      </div>
    </CopilotKit>
  );
}
