export async function main(ns: NS) {
  for (const cache of ns.ls(ns.getHostname(), '.cache')) {
    const result = ns.dnet.openCache(cache);
    ns.print(`Cache opened: ${result.message}`);
  }
}
