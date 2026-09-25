export type ActionId =
    | "ir-inicio"
    | "ir-exportar"
    | "ir-regras"
    | "ir-historico"
    | "ir-configuracoes"
    | "ir-atalhos"
    | "ver-previa"
    | "exportar"
    | "atualizar"
    | "adicionar-regra"
    | "salvar-regras"
    | "desfazer-regras"
    | "trocar-config"
    | "nova-config"
    | "abrir-pasta"
    | "alternar-tema"
    | "ajuda";

export type ActionGroup =
    "Navegação" | "Dados" | "Regras" | "Configuração" | "Geral";

export interface ActionInfo {
    id: ActionId;
    label: string;
    description: string;
    group: ActionGroup;
    combo: string;
}

export const ACTIONS: ActionInfo[] = [
    {
        id: "ir-inicio",
        label: "Ir para Início",
        description: "Abre o painel com os números.",
        group: "Navegação",
        combo: "Ctrl+1",
    },
    {
        id: "ir-exportar",
        label: "Ir para Exportar",
        description: "Abre a tela de prévia e exportação.",
        group: "Navegação",
        combo: "Ctrl+2",
    },
    {
        id: "ir-regras",
        label: "Ir para Regras",
        description: "Abre as regras de tratamento.",
        group: "Navegação",
        combo: "Ctrl+3",
    },
    {
        id: "ir-historico",
        label: "Ir para Histórico",
        description: "Mostra todas as execuções.",
        group: "Navegação",
        combo: "Ctrl+4",
    },
    {
        id: "ir-configuracoes",
        label: "Ir para Configurações",
        description: "Abre arquivo e aparência.",
        group: "Navegação",
        combo: "Ctrl+5",
    },
    {
        id: "ir-atalhos",
        label: "Ir para Atalhos",
        description: "Abre esta lista de atalhos.",
        group: "Navegação",
        combo: "Ctrl+6",
    },
    {
        id: "ver-previa",
        label: "Ver prévia",
        description: "Executa tudo sem gravar nada.",
        group: "Dados",
        combo: "Ctrl+P",
    },
    {
        id: "exportar",
        label: "Exportar agora",
        description: "Abre a confirmação para gravar o resultado.",
        group: "Dados",
        combo: "Ctrl+E",
    },
    {
        id: "atualizar",
        label: "Atualizar informações",
        description: "Lê de novo a configuração e o histórico.",
        group: "Dados",
        combo: "F5",
    },
    {
        id: "adicionar-regra",
        label: "Adicionar regra",
        description: "Cria uma regra nova na tela de Regras.",
        group: "Regras",
        combo: "Ctrl+N",
    },
    {
        id: "salvar-regras",
        label: "Salvar regras",
        description: "Grava as regras na configuração.",
        group: "Regras",
        combo: "Ctrl+S",
    },
    {
        id: "desfazer-regras",
        label: "Desfazer alterações nas regras",
        description: "Volta para as regras que estão salvas.",
        group: "Regras",
        combo: "Ctrl+Shift+Z",
    },
    {
        id: "trocar-config",
        label: "Trocar arquivo de configuração",
        description: "Escolhe outro arquivo de configuração.",
        group: "Configuração",
        combo: "Ctrl+O",
    },
    {
        id: "nova-config",
        label: "Criar nova configuração",
        description: "Abre o passo a passo inicial.",
        group: "Configuração",
        combo: "Ctrl+Shift+N",
    },
    {
        id: "abrir-pasta",
        label: "Abrir pasta da configuração",
        description: "Mostra o arquivo no Explorador de Arquivos.",
        group: "Configuração",
        combo: "Ctrl+Shift+O",
    },
    {
        id: "alternar-tema",
        label: "Alternar tema claro e escuro",
        description: "Troca a aparência do aplicativo.",
        group: "Geral",
        combo: "Ctrl+Shift+L",
    },
    {
        id: "ajuda",
        label: "Abrir ajuda",
        description: "Abre o guia do Datera no navegador.",
        group: "Geral",
        combo: "F1",
    },
];

export const GROUPS: ActionGroup[] = [
    "Navegação",
    "Dados",
    "Regras",
    "Configuração",
    "Geral",
];

export type Shortcuts = Record<ActionId, string>;

const RESERVED = [
    "Ctrl+C",
    "Ctrl+V",
    "Ctrl+X",
    "Ctrl+A",
    "Ctrl+Z",
    "Ctrl+Y",
    "Alt+F4",
    "Ctrl+Shift+I",
];

const MODIFIER_KEYS = new Set([
    "Control",
    "Shift",
    "Alt",
    "Meta",
    "AltGraph",
    "CapsLock",
]);

const KEY_NAMES: Record<string, string> = {
    " ": "Espaço",
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
    Escape: "Esc",
    Delete: "Delete",
    Backspace: "Backspace",
    Enter: "Enter",
    Tab: "Tab",
    Home: "Home",
    End: "End",
    PageUp: "PageUp",
    PageDown: "PageDown",
    Insert: "Insert",
};

export function defaultShortcuts(): Shortcuts {
    const result = {} as Shortcuts;
    for (const action of ACTIONS) result[action.id] = action.combo;
    return result;
}

export function resolveShortcuts(
    saved: Record<string, string> | undefined,
): Shortcuts {
    const result = defaultShortcuts();
    for (const action of ACTIONS) {
        const custom = saved?.[action.id];
        if (typeof custom === "string") result[action.id] = custom;
    }
    return result;
}

function keyOf(event: KeyboardEvent): string | null {
    if (MODIFIER_KEYS.has(event.key)) return null;
    if (event.code.startsWith("Key")) return event.code.slice(3);
    if (event.code.startsWith("Digit")) return event.code.slice(5);
    if (event.code.startsWith("Numpad") && /^\d$/.test(event.key))
        return event.key;
    if (/^F\d{1,2}$/.test(event.key)) return event.key;
    const named = KEY_NAMES[event.key];
    if (named) return named;
    return event.key.length === 1 ? event.key.toUpperCase() : null;
}

export function comboFromEvent(event: KeyboardEvent): string | null {
    const key = keyOf(event);
    if (key === null) return null;
    const parts: string[] = [];
    if (event.ctrlKey) parts.push("Ctrl");
    if (event.altKey) parts.push("Alt");
    if (event.shiftKey) parts.push("Shift");
    parts.push(key);
    return parts.join("+");
}

export function isFunctionKey(combo: string): boolean {
    return /^F\d{1,2}$/.test(combo);
}

export function comboProblem(combo: string): string | null {
    if (RESERVED.includes(combo)) {
        return `${combo} já é usado pelo Windows ou para copiar e colar. Escolha outra combinação.`;
    }
    const hasModifier = combo.includes("Ctrl+") || combo.includes("Alt+");
    if (!hasModifier && !isFunctionKey(combo)) {
        return "Use Ctrl ou Alt junto com uma tecla (ou uma tecla de F1 a F12), para não atrapalhar quando você estiver digitando.";
    }
    return null;
}

export function conflictOf(
    shortcuts: Shortcuts,
    combo: string,
    except: ActionId,
): ActionInfo | undefined {
    return ACTIONS.find(
        (action) => action.id !== except && shortcuts[action.id] === combo,
    );
}

export function keysOf(combo: string): string[] {
    return combo === "" ? [] : combo.split("+");
}

export function actionFor(
    shortcuts: Shortcuts,
    combo: string,
): ActionId | undefined {
    return ACTIONS.find((action) => shortcuts[action.id] === combo)?.id;
}

export function hint(shortcuts: Shortcuts, id: ActionId): string {
    const combo = shortcuts[id];
    return combo ? ` (${combo})` : "";
}
