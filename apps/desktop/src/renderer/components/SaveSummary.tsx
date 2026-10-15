import { useState } from "react";
import { TemplateResult } from "../../shared/api";

interface SaveSummaryProps {
    recordId: string;
}

export function SaveSummary({ recordId }: SaveSummaryProps) {
    const [saving, setSaving] = useState(false);
    const [result, setResult] = useState<TemplateResult | null>(null);

    async function save(): Promise<void> {
        setSaving(true);
        setResult(null);
        try {
            setResult(await window.datera.saveSummary(recordId));
        } catch {
            setResult({
                ok: false,
                error: "Não consegui salvar o resumo. Tente de novo.",
            });
        } finally {
            setSaving(false);
        }
    }

    return (
        <div>
            <button
                type="button"
                className="button secondary"
                disabled={saving}
                onClick={() => void save()}
            >
                {saving ? "Salvando resumo…" : "Salvar resumo"}
            </button>
            {result && (
                <p className="small" role={result.ok ? "status" : "alert"}>
                    {result.ok ? "Resumo salvo." : result.error}
                </p>
            )}
        </div>
    );
}
