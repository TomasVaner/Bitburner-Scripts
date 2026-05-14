export async function main(ns: NS) {
  for (let cache of ns.ls(ns.getHostname(), ".cache"))
  {
    let result = await ns.dnet.openCache(cache);
    ns.print(`Cache opened: ${result.message}`);
  }
}