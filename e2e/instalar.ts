import { Cenario, criarDatera } from "./mock";
import type { Theme } from "../apps/desktop/src/shared/api";

const parametros = new URLSearchParams(location.search);
const cenario = (parametros.get("cenario") ?? "cheio") as Cenario;
const tema = (parametros.get("tema") ?? "light") as Theme;

Object.defineProperty(window, "datera", {
    value: criarDatera(cenario, tema),
});
