export function createMockPaymentGateway() {
  return {
    async charge({ decline = false } = {}) {
      return decline
        ? { success: false, code: "PAYMENT_DECLINED" }
        : { success: true };
    },
  };
}
