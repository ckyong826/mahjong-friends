export interface SocketTicket {
  playerId:string;
  expiresAt:number;
}
export type TicketStore=Record<string,SocketTicket>;

/** Reconnect tickets must not survive expiry; keys are hashes, not plaintext secrets. */
export function pruneTickets(tickets:TicketStore,now:number):TicketStore {
  return Object.fromEntries(Object.entries(tickets).filter(([,value])=>value.expiresAt>now));
}

/** Return a player once, always deleting the key from the resulting state.
 * Caller must persist the returned store BEFORE accepting the socket.
 */
export function consumeTicket(tickets:TicketStore,digest:string,now:number):
  {playerId:string;remaining:TicketStore}|null {
  const remaining=pruneTickets(tickets,now);
  const ticket=remaining[digest];
  if(!ticket)return null;
  delete remaining[digest];
  return {playerId:ticket.playerId,remaining};
}
