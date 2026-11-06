// Acuerdo de delegados para Fulbito, Inter Microredes 2026.
// No modifica sanciones históricas ni estados o importes de pago.
const CLEAN_KNOCKOUT_SCOPES = new Set([
  '90e9c234-f9a3-4689-82d9-1aff3779cbfb:65063c89-76bd-49ec-b29a-b2b14717e1c3'
]);

export function groupSuspensionDoesNotCarry(sanction, events, matches) {
  const event = events.find((item) => item.id === sanction.eventId);
  const source = event && matches.find((item) => item.id === event.matchId);
  if (!source || (source.phase && source.phase !== 'GROUP')) return false;
  const championshipId = source.championshipId || sanction.championshipId;
  if (!CLEAN_KNOCKOUT_SCOPES.has(`${championshipId}:${source.disciplineId}`)) return false;
  const groups = matches.filter((m) => (!m.phase || m.phase === 'GROUP') && m.disciplineId === source.disciplineId && (m.championshipId || championshipId) === championshipId && m.status !== 'INACTIVE');
  return groups.length > 0 && groups.every((m) => m.roundLocked);
}

export function resetSuspensionLabel(sanction) {
  const original = Number(sanction.suspensionMatches || 0);
  return `Sin suspensión en eliminatorias<small>${original ? `Historial de grupos: ${original} fecha${original === 1 ? '' : 's'}. ` : ''}Las multas se mantienen.</small>`;
}
