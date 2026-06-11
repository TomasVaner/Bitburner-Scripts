import { ScriptNames } from './utility/constants';
import { ConvertToFlagsData } from './utility/flags';
import { GetAllServers, Weight } from './utility/scanner';

const flag_struct = {
  limit: Infinity,
  list_all: false,
  skip_stats: false,
  target: '',
};
const flags_data = ConvertToFlagsData(flag_struct);

/** @param {NS} ns */
export async function main(ns: NS) {
  const flag = ns.flags(flags_data) as typeof flag_struct;

  let servers = GetAllServers(ns, ns.getHostname(), [], { print_route: flag.list_all });
  if (flag.list_all) ns.tprint(servers);
  if (flag.skip_stats) return;
  servers = servers.filter((s) => Weight(ns, s) > 0);
  servers.sort((a, b) => Weight(ns, b) - Weight(ns, a));
  servers = servers.slice(0, flag.limit);
  ns.clear('map.txt');

  const hackRam = ns.getScriptRam(ScriptNames.hwg_script) + ns.getFunctionRamCost('hack');
  const growRam = ns.getScriptRam(ScriptNames.hwg_script) + ns.getFunctionRamCost('grow');
  const weakenRam = ns.getScriptRam(ScriptNames.hwg_script) + ns.getFunctionRamCost('weaken');

  ns.tprint('Best servers: ');
  if (flag.target) servers = servers.filter((s) => s === flag.target);
  for (const server of servers) {
    const so = ns.getServer(server);
    if (!so.hasAdminRights) {
      // If we have the BruteSSH.exe program, use it to open the SSH Port
      // on the target server
      if (ns.fileExists('BruteSSH.exe', 'home')) {
        ns.brutessh(server);
      }
      if (ns.fileExists('FTPCrack.exe', 'home')) {
        ns.ftpcrack(server);
      }
      ns.nuke(server);
      ns.tprint(`${server} was nuked`);
    }
  }
  for (const server of servers) {
    const so = ns.getServer(server) as Server;

    const one_hack = ns.hackAnalyze(server) * ns.getServerMaxMoney(server);

    let formulas_data = '';
    if (ns.fileExists('Formulas.exe')) {
      const fso = ns.getServer(server) as Server;
      formulas_data = 'Formulas:\n';
      const player = ns.getPlayer();
      fso.hackDifficulty = fso.minDifficulty;

      const steal_percent = ns.formulas.hacking.hackPercent(fso, player);
      const steal_amount = (fso.moneyMax ?? 0) * steal_percent;

      const max_batch = { steal: 0, threads: -1 };
      let zero_batch = { steal: 0, threads: -1 };

      formulas_data += `\tHack chance: ${ns.format.percent(ns.formulas.hacking.hackChance(fso, player))}\n`;

      const calcHackThreads = (hack_threads: number) => {
        let total_steal = steal_amount * hack_threads;
        if (total_steal > (fso.moneyMax ?? 0)) total_steal = fso.moneyMax ?? 0;
        fso.moneyAvailable = (fso.moneyMax ?? 0) - total_steal;

        const difficulty_hack_increase = ns.hackAnalyzeSecurity(hack_threads);
        const weaken_hack_threads = Math.ceil(difficulty_hack_increase / ns.formulas.hacking.weakenEffect(1, 1));
        const grow_threads = ns.formulas.hacking.growThreads(fso, player, fso.moneyMax ?? 0);

        const difficulty_grow_increase = ns.growthAnalyzeSecurity(grow_threads);
        const weaken_grow_threads = Math.ceil(difficulty_grow_increase / ns.formulas.hacking.weakenEffect(1, 1));
        const ram =
          hack_threads * hackRam + grow_threads * growRam + (weaken_hack_threads + weaken_grow_threads) * weakenRam;

        return { hack_threads, weaken_hack_threads, grow_threads, weaken_grow_threads, ram, total_steal };
      };

      const prod_to_string = (threads: ReturnType<typeof calcHackThreads>) => {
        return `Steal:${ns.format.number(threads.total_steal)}(${ns.format.number(
          (threads.total_steal / (fso.moneyMax ?? 1)) * 100,
        )}%). Per GB: ${ns.format.number(threads.total_steal / threads.ram)} Per GB per second: ${ns.format.number(
          (threads.total_steal / threads.ram / ns.formulas.hacking.hackTime(fso, player)) * 1000,
        )}`;
      };
      const to_string = (threads: ReturnType<typeof calcHackThreads>) => {
        return (
          `\th:${threads.hack_threads} wh:${threads.weaken_hack_threads} g:${threads.grow_threads} wg:${
            threads.weaken_grow_threads
          } => ${ns.format.ram(threads.ram)}\n` + `\t\t${prod_to_string(threads)}\n`
        );
      };
      let rubicon = 1;
      for (let hack_threads = 1; hack_threads <= 10240; hack_threads++) {
        const threads = calcHackThreads(hack_threads);
        if (threads.total_steal / threads.ram > max_batch.steal) {
          max_batch.steal = threads.total_steal / threads.ram;
          max_batch.threads = hack_threads;
        }

        if (flag.target) {
          formulas_data += `\t${hack_threads}: ${to_string(threads)}\n`;
        }
        if (hack_threads == rubicon || threads.total_steal == (fso.moneyMax ?? 0)) {
          //formulas_data += to_string(threads);
          rubicon *= 2;
        }
        if (threads.total_steal == (fso.moneyMax ?? 0)) {
          zero_batch = { threads: hack_threads, steal: threads.total_steal };
          break;
        }
      }
      const zero_threads = calcHackThreads(zero_batch.threads);
      formulas_data += `\tZero:\n${to_string(zero_threads)}`;
      const optiomal_threads = calcHackThreads(max_batch.threads);
      formulas_data += `\tOptimal:\n${to_string(optiomal_threads)}`;
      optiomal_threads.total_steal *= ns.formulas.hacking.hackChance(fso, player);
      formulas_data += `\t\t${prod_to_string(optiomal_threads)}\n`;
    }

    ns.tprint(
      `\n${server}:\n` +
        `\tweight: ${Weight(ns, server).toLocaleString().padEnd(20)}\n` +
        `\tCores/ram: ${so.cpuCores}, ${so.maxRam}GB\n` +
        `\thack time: ${ns.format.time(ns.getHackTime(server))}\n` +
        (ns.getServerSecurityLevel(server) != ns.getServerMinSecurityLevel(server)
          ? `\tSecurity: ${ns.format.number(ns.getServerSecurityLevel(server))}/${ns.getServerMinSecurityLevel(
              server,
            )}\n`
          : '') +
        `\tMoney: ${ns.format.number(ns.getServerMoneyAvailable(server))}/${ns.format.number(
          ns.getServerMaxMoney(server),
        )}\n` +
        `\tHack: one: ${ns.format.number(one_hack)} (${ns.format.number(
          ns.hackAnalyze(server) * 100,
        )}%) $/s: ${ns.format.number((one_hack * 1000) / ns.getHackTime(server))}\n` +
        /*`Growth: ${ns.getServerGrowth(server)} ${ns.growthAnalyze(server, 1/(1 - ns.hackAnalyze(server)))} (${(1/(1 - ns.hackAnalyze(server))).toFixed(6)}) to max: ${ns.format.number(ns.growthAnalyze(server, ns.getServerMaxMoney(server)/ns.getServerMoneyAvailable(server)))} ${ns.getServerMaxMoney(server)/ns.getServerMoneyAvailable(server)}`
    +`        ${ns.format.time(ns.getGrowTime(server))}`
    +`Weaken: ${((so.hackDifficulty ?? 0) - (so.minDifficulty ?? 0)) / ns.weakenAnalyze(1)}`
    +*/ `${formulas_data}`,
    );
  }
}

export function autocomplete(data: AutocompleteData, args: ScriptArg[]) {
  if (GetLastArgument(data, args) == '--target') return data.servers;
  data.flags(flags_data);
  return ['--tail'];
}
