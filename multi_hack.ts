import { GetAllServers } from "./utility/scanner";

const flags_data = [["skip_hack", false]] as [string, any][];

export async function main(ns: NS) {
  let port = ns.getPortHandle(ns.pid);
  port.clear();

  let flag = ns.flags(flags_data);
  let skip_hack = flag.skip_hack;

  ns.disableLog("getServerMinSecurityLevel");
  ns.disableLog("getServerSecurityLevel");
  ns.disableLog("getServerMoneyAvailable");
  ns.disableLog("getServerMaxMoney");
  ns.disableLog("getServerMaxRam");
  ns.disableLog("getServerUsedRam");
  ns.disableLog("getServerNumPortsRequired");
  ns.disableLog("getServerRequiredHackingLevel");
  //ns.disableLog("exec");
  ns.disableLog("scan");
  ns.disableLog("scp");

  let log_name = `/logs/multihack.js/${ns.pid}.txt`;
  ns.write(log_name, "Started hacking", "w");
  ns.clearLog();
  ns.print(`ERROR: Started hacking`);

  const hackRam = ns.getScriptRam("/scripts/hacking/simple/hack.js");
  const growRam = ns.getScriptRam("/scripts/hacking/simple/grow.js");
  const weakenRam = ns.getScriptRam("/scripts/hacking/simple/weaken.js");

  let running = [] as {
    name:string,
    pid:number,
    threads:number,
    operation:string,
  }[]

  while (true) {
    while (!port.empty())
    {
      let data = port.read() as string;
      ns.print(`Port has some data: ${data}`);
      let result = JSON.parse(data);
      let len_before = running.length;
      running = running.filter(r => 
        r.name != result.target ||
        r.operation != result.operation ||
        r.pid != result.pid);
      
      let len_after = running.length;
      
      ns.print(`INFO: operation ended: ${result.name} ${result.operation} ${result.pid} ${result.result}`)
      ns.print(`DEBUG: ${len_before} -> ${len_after}`)
      await ns.sleep(5);
    }

    let all_servers = GetAllServers(ns);

    let openable_ports = 0;
    if (ns.fileExists("BruteSSH.exe", "home")) {
      ++openable_ports;
    }
    if (ns.fileExists("FTPCrack.exe", "home")) {
      ++openable_ports;
    }
    if (ns.fileExists("HTTPWorm.exe", "home")) {
      ++openable_ports;
    }
    if (ns.fileExists("relaySMTP.exe", "home")) {
      ++openable_ports;
    }
    if (ns.fileExists("SQLInject.exe", "home")) {
      ++openable_ports;
    }

    for (let server of all_servers)
    {
      if (!ns.getServer(server).hasAdminRights && openable_ports >= ns.getServerNumPortsRequired(server))
      {
        if (ns.fileExists("BruteSSH.exe", "home")) {
          ns.brutessh(server);
        }
        if (ns.fileExists("FTPCrack.exe", "home")) {
          ns.ftpcrack(server);
        }
        if (ns.fileExists("HTTPWorm.exe", "home")) {
          ns.httpworm(server);
        }
        if (ns.fileExists("relaySMTP.exe", "home")) {
          ns.relaysmtp(server);
        }
        if (ns.fileExists("SQLInject.exe", "home")) {
          ns.sqlinject(server);
        }
        ns.nuke(server);
        ns.tprint(`Nuked ${server}`);
      }
      if (ns.getServer(server).hasAdminRights 
        && !ns.getServer(server).backdoorInstalled 
        && ns.getServerRequiredHackingLevel(server) <= ns.getPlayer().skills.hacking)
        {
          //can install backdoor
        }
    }


    let servers = all_servers.filter(s => Weight(ns, s) > 0);
	  servers.sort((a, b) => Weight(ns, b) - Weight(ns, a));

    let clouds = ns.cloud.getServerNames();
    let money = ns.getPlayer().money;
    if (clouds.length < ns.cloud.getServerLimit())
    {
      for (let memory = 2 ** 20; memory >= 128; memory /=2)
        if (ns.cloud.getServerCost(memory) < money/2){
          ns.cloud.purchaseServer(`cloud${clouds.length + 1}`, memory);
          ns.tprint(`Purchased cloud server with ${memory}GB`);
          break;
        }
    }
    else {
      /*let cloud = clouds.reduce((a,b) => { return (ns.getServerMaxRam(a) > ns.getServerMaxRam(b)) ? b : a})
      let cur_memory = ns.getServerMaxRam(cloud);
      for (let memory = 2 ** 20; memory > cur_memory; memory /=2)
        if (ns.cloud.getServerUpgradeCost(cloud, memory) < money/2){
          ns.cloud.upgradeServer(cloud, memory);
          ns.tprint(`Upgraded cloud server ${cloud} ${cur_memory}GB -> ${memory}GB`);
          break;
        }*/
    }

    let extra_compute_servers = all_servers.filter(s => ns.getServer(s).hasAdminRights && ns.getServerMaxRam(s) >  0);
    let compute_servers = [...ns.cloud.getServerNames(), ...extra_compute_servers];
    compute_servers.sort((a,b) => GetFreeRam(ns, b) - GetFreeRam(ns, a));

    for (let cloud_server of compute_servers)
    {
      if (cloud_server == "home")
        continue;
      ns.scp(
        ["/scripts/hacking/simple/hack.js", 
        "/scripts/hacking/simple/grow.js", 
        "/scripts/hacking/simple/weaken.js", 
        "/scripts/utility/log.js",
        "/scripts/utility/constants.js",
        "/scripts/utility/network_packets.js"], cloud_server);
    }

    ns.write(log_name, `INFO: ${servers.length} servers found: ${servers}`);
    ns.print(`INFO: ${servers.length} servers found`);
    ns.print(`INFO: ${compute_servers.length} compute servers found`);
    let max_security_diff = {value: 0, name:""};
    let max_grow_need = {value: 1, name:""};
    let max_hack = {value: 0, name:""};
    for (let server of servers)
    {
      let so = ns.getServer(server) as Server;
      if (!so.hasAdminRights)
      {
        if (ns.fileExists("BruteSSH.exe", "home")) {
          ns.brutessh(server);
        }
        if (ns.fileExists("FTPCrack.exe", "home")) {
          ns.ftpcrack(server);
        }
        if (!ns.nuke(server))
          continue;
        
        ns.tprint(`${server} was nuked`);
      }

      let security_diff = ns.getServerSecurityLevel(server) - ns.getServerMinSecurityLevel(server);
      if (security_diff >= 0.05 
      && security_diff > max_security_diff.value 
      && !running.some(r => r.name == server && r.operation == "weaken"))
      {
        max_security_diff = {value: security_diff, name:server}
      }

      let grow_need = (ns.getServerMaxMoney(server) > 0) ? (ns.getServerMaxMoney(server)/ns.getServerMoneyAvailable(server)) : 1;
      if (grow_need > max_grow_need.value 
      && security_diff < 0.05
      && !running.some(r => r.name == server && r.operation == "grow"))
      {
        max_grow_need = {value: grow_need, name:server}
      }

      let hack_per_thread = ns.hackAnalyze(server)*ns.getServerMaxMoney(server)*ns.hackAnalyzeChance(server)/ns.getHackTime(server)*1000;
      if (grow_need == 1
        && hack_per_thread > max_hack.value 
        && security_diff < 0.05
        && !running.some(r => r.name == server && r.operation == "hack"))
      {
        max_hack = {value: hack_per_thread, name: server};
      }
    }

    let start_task = (script:string, task:string, threadNeeded:number, ram:number, target_name:string) => {
      ns.print(`Start ${task} on ${target_name} on ${threadNeeded} threads`);
            
      let threads_used = 0;
      for (let cs of compute_servers)
      {
        let availableThreads = Math.floor(GetFreeRam(ns, cs)/ram);

        let threads = Math.min(threadNeeded, availableThreads);

        if (threads > 0)
        {
          let pid = ns.exec(script, cs, threads, "--target", target_name, "--run_at", performance.now(), "--log_file", log_name, "--port_index", ns.pid);
          if (!pid)
          {
            ns.print(`ERROR: could not start the process. RAM: ${GetFreeRam(ns, cs)} threads: ${availableThreads}/${threadNeeded} (${ram})`);
            return 0;
          }
          const task_obj = {name:target_name, pid:pid, threads:threads, operation:task,toString() {
            return `${this.name} ${this.pid} (${this.threads}) ${this.operation}`;
          }};
          running.push(task_obj);

          threadNeeded -= threads;
          threads_used += threads;
        }
        if (threadNeeded == 0)
          break;
      }
      return threads_used;
    }

    if (max_security_diff.value > 0)
    {
      let threadNeeded = Math.ceil(max_security_diff.value / 0.05);
      let thread_used = start_task("/scripts/hacking/simple/weaken.js", "weaken", threadNeeded, weakenRam, max_security_diff.name);
      ns.print(`INFO: Started weaken on ${max_security_diff.name} on ${thread_used} threads (${max_security_diff.value}). Should take ${(ns.getWeakenTime(max_security_diff.name)/1000).toFixed(1)}`);
    }
    else if (max_grow_need.value > 1)
    {
      let threadNeeded = Math.ceil(ns.growthAnalyze(max_grow_need.name, max_grow_need.value));
      let thread_used = start_task("/scripts/hacking/simple/grow.js", "grow", threadNeeded, growRam, max_grow_need.name);
      ns.print(`INFO: Started grow on ${max_grow_need.name} on ${thread_used} threads. Should take ${(ns.getGrowTime(max_grow_need.name)/1000).toFixed(1)}`);
    } else if (max_hack.value > 0 && !skip_hack)
    {
      let threadNeeded = Math.floor(ns.hackAnalyzeThreads(max_hack.name, ns.getServerMaxMoney(max_hack.name)*0.1));
      if (threadNeeded == 0)
        threadNeeded = 1;
      let thread_used = start_task("/scripts/hacking/simple/hack.js", "hack", threadNeeded, hackRam, max_hack.name);
      ns.print(`INFO: Started hack on ${max_hack.name} on ${thread_used} threads. Should take ${(ns.getHackTime(max_hack.name)/1000).toFixed(1)}`);
      ns.print(`10%(${ns.getServerMaxMoney(max_hack.name)*0.1}) out of ${ns.getServerMaxMoney(max_hack.name)}: ${ns.hackAnalyzeThreads(max_hack.name, ns.getServerMaxMoney(max_hack.name)*0.1)}`)
      ns.print(`Server has ${ns.getServerMoneyAvailable(max_hack.name)} root:${ns.getServer(max_hack.name).hasAdminRights} hacking:${ns.getServerRequiredHackingLevel(max_hack.name)}`);
      if (threadNeeded < 0)
      {
        ns.print(`ERROR: ${threadNeeded} threads`);
        ns.alert("Error");
        ns.exit();
      }
    }

    ns.print(`INFO: (${max_security_diff.name}, ${max_security_diff.value}) (${max_grow_need.name}, ${max_grow_need.value}) (${max_hack.name}, ${max_hack.value.toLocaleString()})`)

    let task_map = new Map<string, Map<string, number>>;
    for (let task of running)
    {
      if (task_map.get(task.operation) == undefined)
        task_map.set(task.operation, new Map<string, number>);
      if (task_map.get(task.operation)?.get(task.name) == undefined)
        task_map.get(task.operation)?.set(task.name, task.threads);
      else
        task_map.get(task.operation)?.set(task.name, (task_map.get(task.operation)?.get(task.name) ?? 0) + task.threads);
    }
    
    ns.print(`Tasks: 
      hack:   ${task_map.get("hack") == undefined ? new Array() : Array.from(task_map.get("hack") as Map<string, number>).reduce((s, t) => s + `${t[0]}(${t[1]}) `, "")}
      grow:   ${task_map.get("grow") == undefined ? new Array() : Array.from(task_map.get("grow") as Map<string, number>).reduce((s, t) => s + `${t[0]}(${t[1]}) `, "")}
      weaken: ${task_map.get("weaken") == undefined ? new Array() : Array.from(task_map.get("weaken") as Map<string, number>).reduce((s, t) => s + `${t[0]}(${t[1]}) `, "")}
      `)

    if (compute_servers.some(s => GetFreeRam(ns, s) > weakenRam)
      && [max_security_diff, max_grow_need, max_hack].some(t => t.name.length > 0))
    {
      let free_ram = compute_servers.reduce((a,b) => a + GetFreeRam(ns, b), 0);
      ns.print(`INFO: still have RAM ${free_ram}GB. ${running.length} operations are running.`)
      await ns.sleep(5);
    }
    else if (running.length > 0) {
      ns.print(`INFO: waiting for something to finish. ${running.length} operations are running.`);
      await port.nextWrite();
    }
    else {
      await ns.sleep(5000);
    }
  }
}

function GetFreeRam(ns:NS, server: string)
{
  return ns.getServerMaxRam(server) - ns.getServerUsedRam(server) - (server == "home" ? 256 : 0);
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
			return 0;

	return weight;
}

export function autocomplete(data:AutocompleteData, args:ScriptArg[]) {
  data.flags(flags_data);
  return ["--tail"];
}