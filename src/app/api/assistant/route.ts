import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export async function POST(req: Request) {
  try {
    const { message } = await req.json();
    if (!message || typeof message !== "string") {
      return NextResponse.json({
        reply: "Olá! Sou o assistente oficial da Viegas Barber. Como te posso ajudar hoje?",
      });
    }

    const norm = normalize(message);
    const settings = await getSettings();

    if (
      (norm.includes("onde") && (norm.includes("marcar") || norm.includes("agendar") || norm.includes("marca") || norm.includes("marcaçao") || norm.includes("marcacao"))) ||
      (norm.includes("como") && (norm.includes("marcar") || norm.includes("agendar") || norm.includes("marca"))) ||
      (norm.includes("fazer") && (norm.includes("marc") || norm.includes("agendar")))
    ) {
      return NextResponse.json({
        reply: `📅 **Como fazer a tua marcação:**\n\n1. Clica em **"Marcar Agora"** no topo do site ou na página inicial.\n2. Escolhe o serviço que desejas.\n3. Seleciona a data e a hora disponíveis.\n4. Confirma os teus dados e a marcação fica reservada.\n\nSe ainda não tens conta, também podes entrar em **"Entrar / Criar Conta"** antes de confirmares.\n\n👉 O processo é simples e feito diretamente com o Diogo Viegas.`,
      });
    }

    // 1. AVALIAÇÕES / FEEDBACK / ESTRELAS (Pergunta específica do utilizador)
    if (
      norm.includes("avali") ||
      norm.includes("feedback") ||
      norm.includes("estrela") ||
      norm.includes("comentar") ||
      norm.includes("opiniao") ||
      norm.includes("nota")
    ) {
      return NextResponse.json({
        reply: `🕵️ **Feedback privado do teu corte:**\n\nCerca de 24 horas depois de o serviço ser concluído, receberás uma notificação. Em **"As Minhas Marcações"**, podes dizer se o tamanho no topo ficou ideal e se a linha da barba ficou como gostas. Só o Diogo vê estas notas, para se lembrar das tuas preferências no próximo corte.`,
      });
    }

    // 2. FIDELIZAÇÃO / PONTOS / RECOMPENSAS
    if (
      norm.includes("fideliz") ||
      norm.includes("ponto") ||
      norm.includes("recompensa") ||
      norm.includes("premio") ||
      norm.includes("clube") ||
      norm.includes("cartao de membro") ||
      norm.includes("desconto")
    ) {
      const rewards = await prisma.reward.findMany({
        where: { isActive: true },
        orderBy: { pointsCost: "asc" },
      });
      const rewardsList = rewards
        .map((r) => `• **${r.title}** (${r.pointsCost} pts) - ${r.description}`)
        .join("\n");

      return NextResponse.json({
        reply: `🎁 **Clube Viegas Barber:**\n\n• Bronze: entrada no clube;\n• Prata: 5 visitas;\n• Ouro: 12 visitas e lavagem premium grátis;\n• VIP: 25 visitas e prioridade nas vagas Flash.\n\nGanhas 15 pontos por serviço concluído e 20 pontos ao enviares o feedback privado. **Recompensas disponíveis:**\n${rewardsList || "• Descontos em produtos e cortes gratuitos"}\n\nConsulta o teu nível em **"Fidelização"** ou pede o plano mensal de 2 cortes + 2 barbas por 40€, com pagamento presencial em numerário.`,
      });
    }

    // 3. HISTÓRICO VISUAL / "OS MEUS CORTES" / REPETIR CORTE
    if (
      norm.includes("meus corte") ||
      norm.includes("historico") ||
      norm.includes("repetir") ||
      norm.includes("guardar foto") ||
      norm.includes("corte anterior") ||
      norm.includes("foto do corte")
    ) {
      return NextResponse.json({
        reply: `📸 **Os Meus Cortes (Histórico Visual):**\n\nPodes guardar registos fotográficos dos teus melhores cortes na página **"Os Meus Cortes"**.\n\nCada entrada guarda a data, estilo, fotografia e notas técnicas do Diogo. Quando quiseres repetir exatamente o mesmo corte, basta clicares em **"Quero novamente este corte"** para iniciar uma nova marcação com essa referência associada!`,
      });
    }


    // 5. EQUIPA / DIOGO VIEGAS / SANDRO MIGUEL
    if (norm.includes("sandro") || norm.includes("sandro miguel") || norm.includes("miguel")) {
      return NextResponse.json({
        reply: `💈 **Sandro Miguel** (@sandro_miguel22_):\n\nO Sandro é barbeiro oficial na equipa da **Viegas Barber**!\n• **Especialidades**: Degradês milimétricos (fades), corte à tesoura, barba/barboterapia e styling moderno.\n• **Instagram**: @sandro_miguel22_\n• **Contacto**: 934 172 912\n• **Horário & Preços**: Idênticos aos da barbearia.\n\n👉 Podes agendar diretamente com o Sandro escolhendo o seu perfil no Passo 2 do agendamento!`,
      });
    }

    if (
      norm.includes("diogo") ||
      norm.includes("viegas") ||
      norm.includes("dono") ||
      norm.includes("fundador")
    ) {
      return NextResponse.json({
        reply: `💈 **Diogo Viegas — Master Barber & Fundador:**\n\nO Diogo é o fundador da Viegas Barber.\n• **Especialidades:** Degradês milimétricos (Skin/Taper/Low Fade), barboterapia tradicional com toalha quente e cortes clássicos à tesoura.\n• **Instagram**: @v_barber8\n• **WhatsApp**: ${settings.phone}\n\n👉 Podes agendar diretamente com o Diogo no Passo 2 da marcação!`,
      });
    }

    if (
      norm.includes("barbeiro") ||
      norm.includes("barbeiros") ||
      norm.includes("equipa") ||
      norm.includes("staff") ||
      norm.includes("quem e") ||
      norm.includes("quem sao")
    ) {
      return NextResponse.json({
        reply: `💈 **A Equipa da Viegas Barber:**\n\nA barbearia conta com dois profissionais dedicados:\n\n• **Diogo Viegas** (@v_barber8) — Fundador, mestre em fades milimétricos, tesoura e barboterapia.\n• **Sandro Miguel** (@sandro_miguel22_) — Barbeiro oficial, especialista em degradês, barba e styling.\n\nAmbos partilham a mesma tabela de preços e dedicação total ao cliente!`,
      });
    }

    // 6. PREÇOS, SERVIÇOS & DURAÇÃO
    if (
      norm.includes("preco") ||
      norm.includes("custa") ||
      norm.includes("valor") ||
      norm.includes("servico") ||
      norm.includes("tabela") ||
      norm.includes("quanto e") ||
      norm.includes("duracao") ||
      norm.includes("tempo")
    ) {
      const services = await prisma.service.findMany({
        where: { isActive: true },
        orderBy: { price: "asc" },
      });

      const list = services
        .map((s) => `• **${s.name}**: ${s.price.toFixed(2)}€ (~${s.duration} min)\n  _${s.description || ""}_`)
        .join("\n\n");

      return NextResponse.json({
        reply: `✂️ **Tabela de Serviços & Preços Oficiais:**\n\n${list}\n\nTodos os serviços incluem produtos de finalização premium. Podes agendar diretamente clicando em **"Marcar Agora"**!`,
      });
    }

    // 7. DISPONIBILIDADE, VAGAS & MARCAR
    if (
      norm.includes("vaga") ||
      norm.includes("disponiv") ||
      norm.includes("amanha") ||
      norm.includes("hoje") ||
      norm.includes("marcar") ||
      norm.includes("agendar") ||
      norm.includes("sexta") ||
      norm.includes("sabado") ||
      norm.includes("segunda") ||
      norm.includes("proximo horario")
    ) {
      // Data alvo para verificação em tempo real
      const targetDate = new Date();
      if (norm.includes("amanha")) {
        targetDate.setDate(targetDate.getDate() + 1);
      }
      targetDate.setHours(0, 0, 0, 0);

      const appointments = await prisma.appointment.findMany({
        where: { date: targetDate, status: "SCHEDULED" },
      });

      const bookedTimes = appointments.map((a) => a.startTime);
      const standardSlots = ["09:20", "10:00", "11:20", "14:20", "15:40", "17:00", "18:00"];
      const freeSlots = standardSlots.filter((t) => !bookedTimes.includes(t));

      const dayLabel = norm.includes("amanha")
        ? "amanhã"
        : `dia ${targetDate.toLocaleDateString("pt-PT")}`;

      if (freeSlots.length > 0) {
        return NextResponse.json({
          reply: `📅 **Disponibilidade em Tempo Real:**\n\nPara ${dayLabel}, temos horários livres confirmados pelo sistema, por exemplo às **${freeSlots.slice(0, 4).join(", ")}**.\n\nO processo de marcação é super rápido (Serviço → Dia → Hora) e não precisas de esperar por confirmação manual. Clica em **"Marcar Agora"** para garantir a tua vaga!`,
        });
      } else {
        return NextResponse.json({
          reply: `Para ${dayLabel} a agenda encontra-se bastante preenchida. Recomendamos abrir a página **"Marcar Agora"** para consultar outros dias ou usar a **Lista de Espera** para seres avisado se alguém cancelar!`,
        });
      }
    }

    // 8. CANCELAMENTOS & LISTA DE ESPERA
    if (
      norm.includes("cancel") ||
      norm.includes("desmarcar") ||
      norm.includes("lista de espera") ||
      norm.includes("vaga livre") ||
      norm.includes("avisar")
    ) {
      return NextResponse.json({
        reply: `⚡ **Lista de Espera Flash:**\n\nSe o dia estiver cheio, entra na lista de espera ao marcar. Quando alguém cancelar, a vaga é oferecida a um cliente de cada vez. Recebes uma notificação dentro do site e tens **10 minutos** para aceitar; se o tempo terminar, a oferta passa à próxima pessoa. Os membros VIP têm prioridade.`,
      });
    }

    // 9. ANTECEDÊNCIA MÍNIMA (Problema das marcações de madrugada)
    if (
      norm.includes("antecedencia") ||
      norm.includes("madrugada") ||
      norm.includes("mesmo dia") ||
      norm.includes("em cima da hora")
    ) {
      return NextResponse.json({
        reply: `⏰ **Regra de Antecedência Mínima:**\n\nPara garantir que o Diogo se prepara com rigor e evitar marcações de madrugada sem pré-aviso para a mesma manhã, o sistema exige uma antecedência configurada (atualmente **${settings.minAdvanceHours} horas**).\n\nAssim, as tuas marcações têm sempre a garantia de que o barbeiro estará pronto e pontual à tua espera na barbearia!`,
      });
    }

    // 10. HORÁRIO DE FUNCIONAMENTO
    if (
      norm.includes("hora") ||
      norm.includes("horario") ||
      norm.includes("fecha") ||
      norm.includes("abre") ||
      norm.includes("aberto") ||
      norm.includes("almoco")
    ) {
      return NextResponse.json({
        reply: `🕒 **Horário de Funcionamento:**\n\n• **Segunda a Sábado:** das **${settings.openTime}** às **${settings.closeTime}**;\n• **Pausa para Almoço:** das **${settings.lunchStart}** às **${settings.lunchEnd}**;\n• **Domingo:** Encerrado para descanso semanal.\n\n*Nota:* As marcações respeitam os intervalos e a duração de cada corte para que nunca haja atrasos!`,
      });
    }

    // 11. LOCALIZAÇÃO, MORADA & CONTACTOS
    if (
      norm.includes("onde") ||
      norm.includes("morada") ||
      norm.includes("localizacao") ||
      norm.includes("contacto") ||
      norm.includes("telefone") ||
      norm.includes("mapa") ||
      norm.includes("instagram") ||
      norm.includes("fica")
    ) {
      return NextResponse.json({
        reply: `📍 **Localização & Contactos:**\n\n• **Morada:** ${settings.address}\n• **Telefone / WhatsApp:** ${settings.phone}\n• **Instagram Oficial:** @v_barber8\n\nEstamos situados no Centro comercial São Julião em Setúbal.`,
      });
    }

    // 12. FORMAS DE PAGAMENTO
    if (
      norm.includes("pagamento") ||
      norm.includes("pagar") ||
      norm.includes("mbway") ||
      norm.includes("multibanco") ||
      norm.includes("dinheiro") ||
      norm.includes("cartao")
    ) {
      return NextResponse.json({
        reply: `💳 **Formas de Pagamento Aceites:**\n\nO pagamento é efetuado presencialmente ao Diogo após a conclusão do serviço:\n\n• **MBWay**\n• **Numerário (Dinheiro)**\n• **Multibanco / Cartão**\n\nNão cobramos nada antecipadamente no site, o pagamento é feito diretamente no balcão!`,
      });
    }

    // 13. LOJA, PRODUTOS, CERAS & POMADAS
    if (
      norm.includes("loja") ||
      norm.includes("produto") ||
      norm.includes("cera") ||
      norm.includes("pomada") ||
      norm.includes("shampoo") ||
      norm.includes("oleo") ||
      norm.includes("barba")
    ) {
      const products = await prisma.product.findMany({
        take: 4,
        orderBy: { createdAt: "desc" },
      });
      const prodList = products
        .map((p) => `• **${p.name}** (${p.price.toFixed(2)}€) - Stock: ${p.stock}`)
        .join("\n");

      return NextResponse.json({
        reply: `🛍️ **Produtos Disponíveis na Loja:**\n\n${prodList}\n\nPodes reservar os teus produtos no menu **"Loja"** e levantar/pagar diretamente com o Diogo no teu próximo corte!`,
      });
    }

    // 14. GALERIA & ESTILOS DE CORTE (Fades, Tapers, etc.)
    if (
      norm.includes("galeria") ||
      norm.includes("corte") ||
      norm.includes("fade") ||
      norm.includes("taper") ||
      norm.includes("crop") ||
      norm.includes("mullet") ||
      norm.includes("slick back") ||
      norm.includes("estilo")
    ) {
      return NextResponse.json({
        reply: `✂️ **Estilos Populares na Viegas Barber:**\n\n• **Low Fade / Mid Fade:** Transição suave e elegante nas têmporas;\n• **High Skin Fade:** Degradê a zero alto e nítido;\n• **French Crop:** Franja texturizada contemporânea;\n• **Taper Fade:** Mantém densidade no topo com patilhas limpas;\n• **Slick Back:** Penteado executivo para trás com brilho clássico.\n\nPodes ver fotos reais de todos estes cortes na página **"Galeria"**!`,
      });
    }

    // 15. RESPOSTA INTELIGENTE PADRÃO (Nunca falha e dá caminhos claros)
    return NextResponse.json({
      reply: `Olá! Sou o assistente da Viegas Barber. Como posso ajudar-te? Posso esclarecer dúvidas sobre:\n\n• **Onde avaliar o teu corte** (em "As Minhas Marcações");\n• **Preços e serviços** do Diogo Viegas;\n• **Vagas livres** e como funciona a lista de espera;\n• **Horário e localização** da barbearia;\n• **Pontos de fidelização** e recompensas;\n• **Produtos da nossa loja**.\n\nPergunta-me o que desejares!`,
    });
  } catch (error) {
    console.error("[POST /api/assistant]", error);
    return NextResponse.json({
      reply: "Desculpa, tive uma pequena falha de ligação. Por favor tenta de novo ou contacta o Diogo diretamente através do telefone!",
    });
  }
}
