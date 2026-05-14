import {ScriptNames} from "./utility/constants"
import { ConvertToFlagsData } from "./utility/flags";
import { GetAllServers } from "./utility/scanner";

const flag_struct = {
  limit:Infinity,
  list_all: false,
  skip_stats: false
}
const flags_data = ConvertToFlagsData(flag_struct);

/** @param {NS} ns */
export async function main(ns : NS) {
  let flag = ns.flags(flags_data) as typeof flag_struct;

  let servers = GetAllServers(ns, ns.getHostname(), [], {print_route:flag.list_all});
  if (flag.list_all)
    ns.tprint(servers)
  if (flag.skip_stats)
    return;
  servers = servers.filter(s => Weight(ns, s) > 0)
	servers.sort((a, b) => Weight(ns, b) - Weight(ns, a));
  servers = servers.slice(0, flag.limit);
  ns.clear("map.txt");

  const hackRam = ns.getScriptRam(ScriptNames.hack_script);
  const growRam = ns.getScriptRam(ScriptNames.grow_script);
  const weakenRam = ns.getScriptRam(ScriptNames.weaken_script);

	ns.tprint('Best servers: ');
	for (let server of servers) {
    let so = ns.getServer(server);
    if (!so.hasAdminRights)
    {
      // If we have the BruteSSH.exe program, use it to open the SSH Port
      // on the target server
      if (ns.fileExists("BruteSSH.exe", "home")) {
          ns.brutessh(server);
      }
      if (ns.fileExists("FTPCrack.exe", "home")) {
        ns.ftpcrack(server);
      }
      ns.nuke(server);
      ns.tprint(`${server} was nuked`);
    }
	}
  for (let server of servers) {
    let so = ns.getServer(server) as Server;

    let one_hack = ns.hackAnalyze(server) * ns.getServerMaxMoney(server);

    let formulas_data = "";
    if (ns.fileExists("Formulas.exe"))
    {
      let fso = ns.getServer(server) as Server;
      formulas_data = "Formulas:\n"
      let player = ns.getPlayer();
      fso.hackDifficulty = fso.minDifficulty;

      let steal_percent = ns.formulas.hacking.hackPercent(fso, player);
      let steal_amount = (fso.moneyMax ?? 0) * steal_percent;

      let max_batch = {steal:0, threads:-1};
      let zero_batch = {steal:0, threads:-1};

      formulas_data += `\tHack chance: ${ns.format.percent(ns.formulas.hacking.hackChance(fso, player))}\n`

      function calcHackThreads(hack_threads: number) {
        let total_steal = steal_amount * hack_threads;
        if (total_steal > (fso.moneyMax ?? 0))
          total_steal = fso.moneyMax ?? 0;
        fso.moneyAvailable = (fso.moneyMax ?? 0) - total_steal;
        
        let difficulty_hack_increase = ns.hackAnalyzeSecurity(hack_threads)
        let weaken_hack_threads = Math.ceil(difficulty_hack_increase / ns.formulas.hacking.weakenEffect(1,1))
        let grow_threads = ns.formulas.hacking.growThreads(fso, player, (fso.moneyMax ?? 0));
        
        let difficulty_grow_increase = ns.growthAnalyzeSecurity(grow_threads)
        let weaken_grow_threads = Math.ceil(difficulty_grow_increase / ns.formulas.hacking.weakenEffect(1,1))
        let ram = hack_threads*hackRam + grow_threads*growRam + (weaken_hack_threads + weaken_grow_threads)*weakenRam;

        return {hack_threads, weaken_hack_threads, grow_threads, weaken_grow_threads, ram, total_steal}
      }

      function prod_to_string(threads: any) {
        return `Steal:${ns.format.number(threads.total_steal)}(${ns.format.number(threads.total_steal/(fso.moneyMax ?? 1) *100)}%). Per GB: ${ns.format.number(threads.total_steal/threads.ram)} Per GB per second: ${ns.format.number(threads.total_steal/threads.ram/ns.formulas.hacking.hackTime(fso, player)*1000)}`;
      }
      function to_string(threads: any){
        return `\th:${threads.hack_threads} wh:${threads.weaken_hack_threads} g:${threads.grow_threads} wg:${threads.weaken_grow_threads} => ${ns.format.ram(threads.ram)}\n`
          + `\t\t${prod_to_string(threads)}\n`;
      }
      let rubicon = 1;
      for (let hack_threads = 1; hack_threads <= 10240; hack_threads++)
      {
        let threads = calcHackThreads(hack_threads);
        if (threads.total_steal/threads.ram > max_batch.steal)
        {
          max_batch.steal = threads.total_steal/threads.ram;
          max_batch.threads = hack_threads;
        }

        if (hack_threads == rubicon
          || threads.total_steal == (fso.moneyMax ?? 0))
        {
          //formulas_data += to_string(threads);
          rubicon *= 2;
        }
        if (threads.total_steal == (fso.moneyMax ?? 0))
        {
          zero_batch = {threads: hack_threads, steal: threads.total_steal}
          break;
        }
      }
      let zero_threads = calcHackThreads(zero_batch.threads);
      formulas_data += `\tZero:\n${to_string(zero_threads)}`
      let optiomal_threads = calcHackThreads(max_batch.threads);
      formulas_data += `\tOptimal:\n${to_string(optiomal_threads)}`
      optiomal_threads.total_steal *= ns.formulas.hacking.hackChance(fso, player);
      formulas_data += `\t\t${prod_to_string(optiomal_threads)}\n`
    }

		ns.tprint(
`\n${server}:\n`
    +`\tweight: ${Weight(ns, server).toLocaleString().padEnd(20)}\n`
    +`\tCores/ram: ${so.cpuCores}, ${so.maxRam}GB\n`
    +`\thack time: ${ns.format.time(ns.getHackTime(server))}\n`
    +(ns.getServerSecurityLevel(server) != ns.getServerMinSecurityLevel(server) ? `\tSecurity: ${ns.format.number(ns.getServerSecurityLevel(server))}/${ns.getServerMinSecurityLevel(server)}\n`: '')
    +`\tMoney: ${ns.format.number(ns.getServerMoneyAvailable(server))}/${ns.format.number(ns.getServerMaxMoney(server))}\n`
    +`\tHack: one: ${ns.format.number(one_hack)} (${ns.format.number(ns.hackAnalyze(server) * 100)}%) \$/s: ${ns.format.number(one_hack*1000/ns.getHackTime(server))}\n`
    +/*`Growth: ${ns.getServerGrowth(server)} ${ns.growthAnalyze(server, 1/(1 - ns.hackAnalyze(server)))} (${(1/(1 - ns.hackAnalyze(server))).toFixed(6)}) to max: ${ns.format.number(ns.growthAnalyze(server, ns.getServerMaxMoney(server)/ns.getServerMoneyAvailable(server)))} ${ns.getServerMaxMoney(server)/ns.getServerMoneyAvailable(server)}`
    +`        ${ns.format.time(ns.getGrowTime(server))}`
    +`Weaken: ${((so.hackDifficulty ?? 0) - (so.minDifficulty ?? 0)) / ns.weakenAnalyze(1)}`
    +*/`${formulas_data}`
    );
	}
}

function Weight(ns : NS, server : string):number {
	if (!server) return 0;

	// Don't ask, endgame stuff
	if (server.startsWith('hacknet-node')) return 0;

	// Get the player information
	let player = ns.getPlayer();

	// Get the server information
	let so = ns.getServer(server) as Server;
  if (!so)
    return 0;

	// Set security to minimum on the server object (for Formula.exe functions)
	so.hackDifficulty = so.minDifficulty;

	// We cannot hack a server that has more than our hacking skill so these have no value
	if ((so.requiredHackingSkill ?? 0) > player.skills.hacking) return 0;

	// Default pre-Formulas.exe weight. minDifficulty directly affects times, so it substitutes for min security times
	let weight = (so.moneyMax ?? 0) / (so.minDifficulty ?? 1);

	// If we have formulas, we can refine the weight calculation
	if (ns.fileExists('Formulas.exe')) {
		// We use weakenTime instead of minDifficulty since we got access to it, 
		// and we add hackChance to the mix (pre-formulas.exe hack chance formula is based on current security, which is useless)
		weight = (so.moneyMax ?? 0) / ns.formulas.hacking.weakenTime(so, player) * ns.formulas.hacking.hackChance(so, player);
	}
	else
		// If we do not have formulas, we can't properly factor in hackchance, so we lower the hacking level tolerance by half
		if ((so.requiredHackingSkill ?? 0) > player.skills.hacking / 2)
			weight = 0;

  if (weight == 0 && !so.hasAdminRights)
    weight = 1;

	return weight;
}

export function autocomplete(data:AutocompleteData, args:ScriptArg[]) {
  data.flags(flags_data);
  return ["--tail"];
}