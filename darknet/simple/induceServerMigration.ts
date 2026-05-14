export async function main(ns: NS) {
  let [hostname] = ns.args as [string];
  await ns.dnet.induceServerMigration(hostname);
}