import { ApplicationError } from "../../errors/application-error.js";

import type {
  Security,
  SecurityDetails,
  SecurityFilters,
  SecurityRepository,
} from "./security.types.js";

export class SecurityService {
  public constructor(private readonly securityRepository: SecurityRepository) {}

  public listSecurities(filters: SecurityFilters): Promise<Security[]> {
    return this.securityRepository.findAll(filters);
  }

  public async getSecurity(securityId: string): Promise<SecurityDetails> {
    const security = await this.securityRepository.findById(securityId);

    if (!security) {
      throw new SecurityNotFoundError();
    }

    return security;
  }

  public async assertSecurityTradable(securityId: string): Promise<Security> {
    const security = await this.getSecurity(securityId);

    if (security.tradingStatus !== "TRADABLE") {
      throw new SecurityNotTradableError();
    }

    return security;
  }
}

export class InvalidSecurityFilterError extends ApplicationError {
  public constructor(message = "Bộ lọc chứng khoán không hợp lệ.") {
    super(400, "INVALID_SECURITY_FILTER", message);
  }
}

export class SecurityNotFoundError extends ApplicationError {
  public constructor() {
    super(404, "SECURITY_NOT_FOUND", "Không tìm thấy chứng khoán.");
  }
}

export class SecurityNotTradableError extends ApplicationError {
  public constructor() {
    super(
      409,
      "SECURITY_NOT_TRADABLE",
      "Chứng khoán không ở trạng thái được phép giao dịch.",
    );
  }
}
