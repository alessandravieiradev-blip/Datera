import { RunRecord } from "../shared/api";
import { readJson, writeJson } from "./storage";

const FILE = "historico.json";
const MAX_RECORDS = 100;

export function readHistory(): RunRecord[] {
    const saved = readJson<unknown>(FILE, []);
    return Array.isArray(saved) ? (saved as RunRecord[]) : [];
}

export function addToHistory(record: RunRecord): void {
    const stored: RunRecord = record.report
        ? { ...record, report: { ...record.report, preview: [] } }
        : record;
    writeJson(FILE, [stored, ...readHistory()].slice(0, MAX_RECORDS));
}
