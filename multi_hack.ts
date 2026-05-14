import { GetAllServers, Weight } from './utility/scanner';

const flags_data = [['skip_hack', false]] as [string, ScriptArg][];

export async function main(ns: NS) {
  const port = ns.getPortHandle(ns.pid);
  port.clear();

  const flag = ns.flags(flags_data);
  const skip_hack = flag.skip_hack;

  ns.disableLog('getServerMinSecurityLevel');
  ns.disableLog('getServerSecurityLevel');
  ns.disableLog('getServerMoneyAvailable');
  ns.disableLog('getServerMaxMoney');
  ns.disableLog('getServerMaxRam');
  ns.disableLog('getServerUsedRam');
  ns.disableLog('getServerNumPortsRequired');
  ns.disableLog('getServerRequiredHackingLevel');
  //ns.disableLog("exec");
  ns.disableLog('scan');
  ns.disableLog('scp');

  const log_name = `/logs/multihack.js/${ns.pid}.txt`;
  ns.write(log_name, 'Started hacking', 'w');
  ns.clearLog();
  ns.print(`ERROR: Started hacking`);

  const hackRam = ns.getScriptRam('/scripts/hacking/simple/hack.js');
  const growRam = ns.getScriptRam('/scripts/hacking/simple/grow.js');
  const weakenRam = ns.getScriptRam('/scripts/hacking/simple/weaken.js');

  let running = [] as {
    name: string;
    pid: number;
    threads: number;
    operation: string;
  }[];

  while (true) {
    while (!port.empty()) {
      const data = port.read() as string;
      ns.print(`Port has some data: ${data}`);
      const result = JSON.parse(data);
      const len_before = running.length;
      running = running.filter(
        (r) => r.name != result.target || r.operation != result.operation || r.pid != result.pid,
      );

      const len_after = running.length;

      ns.print(`INFO: operation ended: ${result.name} ${result.operation} ${result.pid} ${result.result}`);
      ns.print(`DEBUG: ${len_before} -> ${len_after}`);
      await ns.sleep(5);
    }

    const all_servers = GetAllServers(ns);

    let openable_ports = 0;
    if (ns.fileExists('BruteSSH.exe', 'home')) {
      ++openable_ports;
    }
    if (ns.fileExists('FTPCrack.exe', 'home')) {
      ++openable_ports;
    }
    if (ns.fileExists('HTTPWorm.exe', 'home')) {
      ++openable_ports;
    }
    if (ns.fileExists('relaySMTP.exe', 'home')) {
      ++openable_ports;
    }
    if (ns.fileExists('SQLInject.exe', 'home')) {
      ++openable_ports;
    }

    for (const server of all_servers) {
      if (!ns.getServer(server).hasAdminRights && openable_ports >= ns.getServerNumPortsRequired(server)) {
        if (ns.fileExists('BruteSSH.exe', 'home')) {
          ns.brutessh(server);
        }
        if (ns.fileExists('FTPCrack.exe', 'home')) {
          ns.ftpcrack(server);
        }
        if (ns.fileExists('HTTPWorm.exe', 'home')) {
          ns.httpworm(server);
        }
        if (ns.fileExists('relaySMTP.exe', 'home')) {
          ns.relaysmtp(server);
        }
        if (ns.fileExists('SQLInject.exe', 'home')) {
          ns.sqlinject(server);
        }
        ns.nuke(server);
        ns.tprint(`Nuked ${server}`);
      }
      if (
        ns.getServer(server).hasAdminRights &&
        !ns.getServer(server).backdoorInstalled &&
        ns.getServerRequiredHackingLevel(server) <= ns.getPlayer().skills.hacking
      ) {
        //can install backdoor
      }
    }

    const servers = all_servers.filter((s) => Weight(ns, s) > 0);
    servers.sort((a, b) => Weight(ns, b) - Weight(ns, a));

    const clouds = ns.cloud.getServerNames();
    const money = ns.getPlayer().money;
    if (clouds.length < ns.cloud.getServerLimit()) {
      for (let memory = 2 ** 20; memory >= 128; memory /= 2)
        if (ns.cloud.getServerCost(memory) < money / 2) {
          ns.cloud.purchaseServer(`cloud${clouds.length + 1}`, memory);
          ns.tprint(`Purchased cloud server with ${memory}GB`);
          break;
        }
    } else {
      /*let cloud = clouds.reduce((a,b) => { return (ns.getServerMaxRam(a) > ns.getServerMaxRam(b)) ? b : a})
      let cur_memory = ns.getServerMaxRam(cloud);
      for (let memory = 2 ** 20; memory > cur_memory; memory /=2)
        if (ns.cloud.getServerUpgradeCost(cloud, memory) < money/2){
          ns.cloud.upgradeServer(cloud, memory);
          ns.tprint(`Upgraded cloud server ${cloud} ${cur_memory}GB -> ${memory}GB`);
          break;
        }*/
    }

    const extra_compute_servers = all_servers.filter(
      (s) => ns.getServer(s).hasAdminRights && ns.getServerMaxRam(s) > 0,
    );
    const compute_servers = [...ns.cloud.getServerNames(), ...extra_compute_servers];
    compute_servers.sort((a, b) => GetFreeRam(ns, b) - GetFreeRam(ns, a));

    for (const cloud_server of compute_servers) {
      if (cloud_server == 'home') continue;
      ns.scp(
        [
          '/scripts/hacking/simple/hack.js',
          '/scripts/hacking/simple/grow.js',
          '/scripts/hacking/simple/weaken.js',
          '/scripts/utility/log.js',
          '/scripts/utility/constants.js',
          '/scripts/utility/network_packets.js',
        ],
        cloud_server,
      );
    }

    ns.write(log_name, `INFO: ${servers.length} servers found: ${servers}`);
    ns.print(`INFO: ${servers.length} servers found`);
    ns.print(`INFO: ${compute_servers.length} compute servers found`);
    let max_security_diff = { value: 0, name: '' };
    let max_grow_need = { value: 1, name: '' };
    let max_hack = { value: 0, name: '' };
    for (const server of servers) {
      const so = ns.getServer(server) as Server;
      if (!so.hasAdminRights) {
        if (ns.fileExists('BruteSSH.exe', 'home')) {
          ns.brutessh(server);
        }
        if (ns.fileExists('FTPCrack.exe', 'home')) {
          ns.ftpcrack(server);
        }
        if (!ns.nuke(server)) continue;

        ns.tprint(`${server} was nuked`);
      }

      const security_diff = ns.getServerSecurityLevel(server) - ns.getServerMinSecurityLevel(server);
      if (
        security_diff >= 0.05 &&
        security_diff > max_security_diff.value &&
        !running.some((r) => r.name == server && r.operation == 'weaken')
      ) {
        max_security_diff = { value: security_diff, name: server };
      }

      const grow_need =
        ns.getServerMaxMoney(server) > 0 ? ns.getServerMaxMoney(server) / ns.getServerMoneyAvailable(server) : 1;
      if (
        grow_need > max_grow_need.value &&
        security_diff < 0.05 &&
        !running.some((r) => r.name == server && r.operation == 'grow')
      ) {
        max_grow_need = { value: grow_need, name: server };
      }

      const hack_per_thread =
        ((ns.hackAnalyze(server) * ns.getServerMaxMoney(server) * ns.hackAnalyzeChance(server)) /
          ns.getHackTime(server)) *
        1000;
      if (
        grow_need == 1 &&
        hack_per_thread > max_hack.value &&
        security_diff < 0.05 &&
        !running.some((r) => r.name == server && r.operation == 'hack')
      ) {
        max_hack = { value: hack_per_thread, name: server };
      }
    }

    const start_task = (script: string, task: string, threadNeeded: number, ram: number, target_name: string) => {
      ns.print(`Start ${task} on ${target_name} on ${threadNeeded} threads`);

      let threads_used = 0;
      for (const cs of compute_servers) {
        const availableThreads = Math.floor(GetFreeRam(ns, cs) / ram);

        const threads = Math.min(threadNeeded, availableThreads);

        if (threads > 0) {
          const pid = ns.exec(
            script,
            cs,
            threads,
            '--target',
            target_name,
            '--run_at',
            performance.now(),
            '--log_file',
            log_name,
            '--port_index',
            ns.pid,
          );
          if (!pid) {
            ns.print(
              `ERROR: could not start the process. RAM: ${GetFreeRam(
                ns,
                cs,
              )} threads: ${availableThreads}/${threadNeeded} (${ram})`,
            );
            return 0;
          }
          const task_obj = {
            name: target_name,
            pid: pid,
            threads: threads,
            operation: task,
            toString() {
              return `${this.name} ${this.pid} (${this.threads}) ${this.operation}`;
            },
          };
          running.push(task_obj);

          threadNeeded -= threads;
          threads_used += threads;
        }
        if (threadNeeded == 0) break;
      }
      return threads_used;
    };

    if (max_security_diff.value > 0) {
      const threadNeeded = Math.ceil(max_security_diff.value / 0.05);
      const thread_used = start_task(
        '/scripts/hacking/simple/weaken.js',
        'weaken',
        threadNeeded,
        weakenRam,
        max_security_diff.name,
      );
      ns.print(
        `INFO: Started weaken on ${max_security_diff.name} on ${thread_used} threads (${
          max_security_diff.value
        }). Should take ${(ns.getWeakenTime(max_security_diff.name) / 1000).toFixed(1)}`,
      );
    } else if (max_grow_need.value > 1) {
      const threadNeeded = Math.ceil(ns.growthAnalyze(max_grow_need.name, max_grow_need.value));
      const thread_used = start_task(
        '/scripts/hacking/simple/grow.js',
        'grow',
        threadNeeded,
        growRam,
        max_grow_need.name,
      );
      ns.print(
        `INFO: Started grow on ${max_grow_need.name} on ${thread_used} threads. Should take ${(
          ns.getGrowTime(max_grow_need.name) / 1000
        ).toFixed(1)}`,
      );
    } else if (max_hack.value > 0 && !skip_hack) {
      let threadNeeded = Math.floor(ns.hackAnalyzeThreads(max_hack.name, ns.getServerMaxMoney(max_hack.name) * 0.1));
      if (threadNeeded == 0) threadNeeded = 1;
      const thread_used = start_task('/scripts/hacking/simple/hack.js', 'hack', threadNeeded, hackRam, max_hack.name);
      ns.print(
        `INFO: Started hack on ${max_hack.name} on ${thread_used} threads. Should take ${(
          ns.getHackTime(max_hack.name) / 1000
        ).toFixed(1)}`,
      );
      ns.print(
        `10%(${ns.getServerMaxMoney(max_hack.name) * 0.1}) out of ${ns.getServerMaxMoney(
          max_hack.name,
        )}: ${ns.hackAnalyzeThreads(max_hack.name, ns.getServerMaxMoney(max_hack.name) * 0.1)}`,
      );
      ns.print(
        `Server has ${ns.getServerMoneyAvailable(max_hack.name)} root:${
          ns.getServer(max_hack.name).hasAdminRights
        } hacking:${ns.getServerRequiredHackingLevel(max_hack.name)}`,
      );
      if (threadNeeded < 0) {
        ns.print(`ERROR: ${threadNeeded} threads`);
        ns.alert('Error');
        ns.exit();
      }
    }

    ns.print(
      `INFO: (${max_security_diff.name}, ${max_security_diff.value}) (${max_grow_need.name}, ${max_grow_need.value}) (${
        max_hack.name
      }, ${max_hack.value.toLocaleString()})`,
    );

    const task_map = new Map<string, Map<string, number>>();
    for (const task of running) {
      if (task_map.get(task.operation) == undefined) task_map.set(task.operation, new Map<string, number>());
      if (task_map.get(task.operation)?.get(task.name) == undefined)
        task_map.get(task.operation)?.set(task.name, task.threads);
      else
        task_map
          .get(task.operation)
          ?.set(task.name, (task_map.get(task.operation)?.get(task.name) ?? 0) + task.threads);
    }

    ns.print(`Tasks: 
      hack:   ${
        task_map.get('hack') == undefined
          ? []
          : Array.from(task_map.get('hack') as Map<string, number>).reduce((s, t) => s + `${t[0]}(${t[1]}) `, '')
      }
      grow:   ${
        task_map.get('grow') == undefined
          ? []
          : Array.from(task_map.get('grow') as Map<string, number>).reduce((s, t) => s + `${t[0]}(${t[1]}) `, '')
      }
      weaken: ${
        task_map.get('weaken') == undefined
          ? []
          : Array.from(task_map.get('weaken') as Map<string, number>).reduce((s, t) => s + `${t[0]}(${t[1]}) `, '')
      }
      `);

    if (
      compute_servers.some((s) => GetFreeRam(ns, s) > weakenRam) &&
      [max_security_diff, max_grow_need, max_hack].some((t) => t.name.length > 0)
    ) {
      const free_ram = compute_servers.reduce((a, b) => a + GetFreeRam(ns, b), 0);
      ns.print(`INFO: still have RAM ${free_ram}GB. ${running.length} operations are running.`);
      await ns.sleep(5);
    } else if (running.length > 0) {
      ns.print(`INFO: waiting for something to finish. ${running.length} operations are running.`);
      await port.nextWrite();
    } else {
      await ns.sleep(5000);
    }
  }
}

function GetFreeRam(ns: NS, server: string) {
  return ns.getServerMaxRam(server) - ns.getServerUsedRam(server) - (server == 'home' ? 256 : 0);
}

export function autocomplete(data: AutocompleteData, args: ScriptArg[]) {
  data.flags(flags_data);
  return ['--tail'];
}
