export function summarizeWelcomeOffer(issuer: string, estimatedValue: number | undefined, minSpend: number | undefined): string {
  const valueText = estimatedValue === undefined ? '以官方公开页面为准' : `估算价值约 US$${estimatedValue.toLocaleString('en-US')}`;
  const spendText = minSpend === undefined ? '' : `，需满足约 US$${minSpend.toLocaleString('en-US')} 消费门槛`;
  return `${issuer} 公开开卡奖励：${valueText}${spendText}`;
}
