export async function main(ns: NS) {
  const [hostname] = ns.args as [string];
  await ns.dnet.induceServerMigration(hostname);
}
