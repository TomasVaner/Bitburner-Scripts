import { GetAllServers, GetFreeRam } from '@/utility/scanner';
import { ScriptNames } from '@/utility/constants';

export async function main(ns: NS) {
  ns.disableLog('scan');
  ns.disableLog('scp');
  ns.disableLog('exec');
  ns.disableLog('getServerMaxRam');
  ns.disableLog('getServerUsedRam');

  const script_ram = ns.getScriptRam(ScriptNames.memory_share);
  while (true) {
    let total_threads = 0;
    for (const server of GetAllServers(ns).filter((s) => ns.getServer(s).hasAdminRights)) {
      if (ns.ps(server).length > 0) continue;
      let freeRam = GetFreeRam(ns, server);
      if (server == 'home') freeRam -= 128;
      if (freeRam >= script_ram) {
        ns.scp(ScriptNames.memory_share, server);
        const threads = Math.floor(freeRam / script_ram);
        ns.exec(ScriptNames.memory_share, server, { threads, temporary: true });
        total_threads += threads;
      }
    }
    ns.print(`Started memory shared on ${total_threads} threads`);
    await ns.sleep(10005);
  }
}
