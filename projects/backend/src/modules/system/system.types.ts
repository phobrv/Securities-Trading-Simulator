export type SystemOverview = {
  name: "Securities Trading Simulator";
  mode: "SIMULATION";
  conventions: {
    currency: "VND";
    priceUnit: "VND_PER_SHARE";
    timestampFormat: "ISO_8601";
    displayTimeZone: "Asia/Ho_Chi_Minh";
  };
  modules: Array<{
    name: "System" | "SecurityMaster" | "MarketData" | "OMS";
    status: "IMPLEMENTED" | "PLANNED";
  }>;
};
