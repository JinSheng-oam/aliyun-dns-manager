const HIGH_RISK_ACTIONS = new Set([
    'Delete AccessKey',
    'Delete DNS Record',
    'Set DNS Status',
    'Batch Delete DNS',
    'Batch Set Status',
    'Restore Data Backup',
    'Restore DNS Snapshot',
]);

export function isHighRiskLog(log: { action: string }): boolean {
    return HIGH_RISK_ACTIONS.has(log.action);
}
