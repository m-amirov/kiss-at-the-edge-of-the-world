/** Ephemeral in-session dialogue history; snapshots are never persisted by rollback. */
export function createDialogueHistory() {
  const snapshots=[];
  return {
    record(state){snapshots.push(structuredClone(state));},
    rollback(){return snapshots.length?snapshots.pop():null;},
    canRollback(){return snapshots.length>0;},
    clear(){snapshots.length=0;}
  };
}
