import { ApplicationError } from "../../errors/application-error.js";
import { calculateMargin } from "./margin.calculator.js";
import type { MarginOrder, MarginRepository } from "./margin.types.js";

export class RiskCheckService {
  public constructor(
    private readonly repository: MarginRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async simulate(scenarioId: string, order: MarginOrder) {
    const scenario = await this.repository.findScenario(scenarioId);
    if (!scenario)
      throw new ApplicationError(
        404,
        "SCENARIO_NOT_FOUND",
        "Không tìm thấy scenario mô phỏng.",
      );
    return calculateMargin(scenario, order, this.now().toISOString());
  }
}
