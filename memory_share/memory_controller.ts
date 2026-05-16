import { GetAllServers } from '@/utility/scanner';
import { ScriptNames } from '@/utility/constants';

export async function main(ns: NS) {
  ns.disableLog('scan');
  ns.disableLog('scp');
  ns.disableLog('exec');
  ns.disableLog('getServerMaxRam');

  const script_ram = ns.getScriptRam(ScriptNames.memory_share);
  let total_threads = 0;
  for (const server of GetAllServers(ns)) {
    if (ns.getServerMaxRam(server) >= script_ram && ns.ps(server).length == 0) {
      ns.scp(ScriptNames.memory_share, server);
      const threads = Math.floor(ns.getServerMaxRam(server) / script_ram);
      ns.exec(ScriptNames.memory_share, server, threads);
      total_threads += threads;
    }
  }
  ns.print(`Started memory shared on ${total_threads} threads`);
}
