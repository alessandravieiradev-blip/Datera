import { EtlConfig } from "../config";
import { FillEmptyFilter } from "../filters/fillEmpty";
import { CombineFilter } from "../filters/combine";
import { RowValidator } from "../filters/validate";
import { buildModeStep, Mode } from "./modes";
import { Step } from "./types";

export function buildSteps(config: EtlConfig, mode: Mode): Step[] {
    const steps: Step[] = [];

    if (config.fillEmpty) {
        const filter = new FillEmptyFilter(config.fillEmpty);
        steps.push({
            name: "fillEmpty",
            run: (rows) => ({ rows: filter.apply(rows) }),
        });
    }

    if (config.combineColumns) {
        const filter = new CombineFilter(config.combineColumns);
        steps.push({
            name: "combineColumns",
            run: (rows) => ({ rows: filter.apply(rows) }),
        });
    }

    if (config.validation) {
        const validator = new RowValidator(
            config.validation.rules,
            config.validation.reasonColumn,
        );
        steps.push({
            name: "validation",
            run: (rows) => {
                const { valid, pending } = validator.split(rows);
                return { rows: valid, pending };
            },
        });
    }

    steps.push(buildModeStep(mode, config));
    return steps;
}
