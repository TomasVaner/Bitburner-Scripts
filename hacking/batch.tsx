import { ScriptNames, HackScripts, Strings } from '@/utility/constants';
import { NSLogger } from '@/utility/log';
import { GetAllServers, GetFreeRam, GetRoute, Weight } from '@/utility/scanner';
import { ConvertArgsToFlags, ConvertToArgs, ConvertToFlagsData, Hacking } from '@/utility/flags';
import { ProgressBar } from '@/ui/progress_bar';
import { main as hwg_main, flags_struct as hacking_flags_struct } from '@/hacking/simple/hwg_uni';
import '@/utility/extensions/array';

const flag_struct = {
  buy_clouds: false,
  cloud_starting_memory: 64,
  limit_batches_per_server: Infinity,
  delay: 0,
  limit_servers: Infinity,
  single_batch: false,
  debug: false,
  hgw: false,
  sync_interval: 200,
};
const flags_data = ConvertToFlagsData(flag_struct);

export async function main(ns: NS) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const pre_load_scripts = [hwg_main];
  const flag = ns.flags(flags_data) as typeof flag_struct;
  ns.clearPort(ns.pid);
  {
    ns.disableLog('getServerMinSecurityLevel');
    ns.disableLog('getServerSecurityLevel');
    ns.disableLog('getServerMoneyAvailable');
    ns.disableLog('getServerMaxMoney');
    ns.disableLog('getServerMaxRam');
    ns.disableLog('getServerUsedRam');
    ns.disableLog('getServerNumPortsRequired');
    ns.disableLog('getServerRequiredHackingLevel');
    ns.disableLog('exec');
    ns.disableLog('scan');
    ns.disableLog('scp');
    ns.disableLog('sleep');
    ns.disableLog('asleep');
  } // ignore logs
  const logger = new NSLogger(ns);
  logger.Log('Started hacking');
  ns.clearLog();

  const hackRam = ns.getScriptRam(ScriptNames.hwg_script) + ns.getFunctionRamCost('hack');
  const growRam = ns.getScriptRam(ScriptNames.hwg_script) + ns.getFunctionRamCost('grow');
  const weakenRam = ns.getScriptRam(ScriptNames.hwg_script) + ns.getFunctionRamCost('weaken');

  const port_hacks = {
    'BruteSSH.exe': ns.brutessh,
    'FTPCrack.exe': ns.ftpcrack,
    'HTTPWorm.exe': ns.httpworm,
    'relaySMTP.exe': ns.relaysmtp,
    'SQLInject.exe': ns.sqlinject,
  } as { [k: string]: typeof ns.brutessh };

  /*let running: Record<string, {
		processes: { pid: number, end_time: number, type: string }[],
	}> = {}*/

  let spent_on_cloud = 0;

  let money_made_reported = 0;
  let extra_time = 0;
  // hack cycle
  while (true) {
    //while (ns.readPort(ns.pid) != Strings.null_port_data) {
    while (ns.peek(ns.pid) != Strings.null_port_data) {
      const s = ns.readPort(ns.pid);
      logger.Log(`Packet came: ${s}`);
      /*let packet = JSON.parse(s) as NetworkPacket;
			if (packet.type == PacketType.hack_operation_result) {
				let hack_result = packet as HackOperationResultPacket;
				//logger.Log(`PID ${hack_result.pid} finished`);
				let processes = running[hack_result.target]?.processes;
				if (processes === undefined)
				{
					logger.Log(`Could not find batches for ${hack_result.target}`);
					continue;
				}
				let process_info = processes.find(p => p.pid == hack_result.pid);
				logger.Log(`${process_info?.pid} ended. type:${process_info?.type}, time_diff: ${performance.now() - process_info?.end_time} from ${process_info?.end_time}. Return: ${hack_result.result}`)
				running[hack_result.target].processes = processes.filter(p => p.pid != hack_result.pid);
				if (running[hack_result.target].processes !== undefined && running[hack_result.target].processes.length == 0) {
					delete running[hack_result.target];
					logger.Log(`Finished batches on ${hack_result.target}`);
				}
			}*/
    }
    const all_servers = GetAllServers(ns);
    const extra_compute_servers = all_servers.filter(
      (s) => ns.getServer(s).hasAdminRights && ns.getServerMaxRam(s) > 0,
    );

    //running = {};

    const openable_ports = Object.keys(port_hacks).filter((exe) => ns.fileExists(exe, 'home')).length;

    const clouds = ns.cloud.getServerNames();
    for (const server of all_servers) {
      const so = ns.getServer(server) as Server;
      if (!ns.getServer(server).hasAdminRights && openable_ports >= (so.numOpenPortsRequired ?? 0)) {
        for (const hack_exe in port_hacks) {
          if (ns.fileExists(hack_exe, 'home')) port_hacks[hack_exe](server);
        }
        ns.nuke(server);
        logger.Log(`Nuked ${server}`);
      }
      if (
        so.hasAdminRights &&
        !so.backdoorInstalled &&
        !so.purchasedByPlayer &&
        ns.getServerRequiredHackingLevel(server) <= ns.getPlayer().skills.hacking
      ) {
        logger.Log(`Can install backdoor on ${server}: ${GetRoute(ns, server).slice(0, -1)}`);
        //can install backdoor
      }
    }

    const script = ns.getRunningScript();
    const money_made = script?.onlineMoneyMade ?? 0;
    const money_per_s = money_made / (script?.onlineRunningTime ?? 1);
    const money = money_made / 2 - spent_on_cloud;
    logger.Log(
      `$${ns.format.number(money_made - money_made_reported)} were made in the last batch. $${ns.format.number(
        money_made,
      )} made in total (${ns.format.number(money_per_s)})`,
    );
    money_made_reported = money_made;

    if (clouds.length < ns.cloud.getServerLimit()) {
      if (flag.buy_clouds) {
        for (let memory = 2 ** 20; memory >= flag.cloud_starting_memory; memory /= 2)
          if (ns.cloud.getServerCost(memory) < money) {
            spent_on_cloud += ns.cloud.getServerCost(memory);
            ns.cloud.purchaseServer(`cloud-${clouds.length + 1}`, memory);
            logger.Log(`Purchased cloud server with ${memory}GB. Spent on clouds: ${spent_on_cloud}`, {
              global_log: true,
            });
            break;
          }
      }
    } else {
      const cloud = clouds.reduce((a, b) => {
        return ns.getServerMaxRam(a) > ns.getServerMaxRam(b) ? b : a;
      });
      const cur_memory = ns.getServerMaxRam(cloud);
      for (let memory = 2 ** 20; memory > cur_memory; memory /= 2)
        if (ns.cloud.getServerUpgradeCost(cloud, memory) < money / 2) {
          spent_on_cloud += ns.cloud.getServerUpgradeCost(cloud, memory);
          ns.cloud.upgradeServer(cloud, memory);
          logger.Log(
            `Upgraded cloud server ${cloud} ${ns.format.ram(cur_memory)} -> ${ns.format.ram(
              memory,
            )}. Spent on clouds: ${ns.format.number(spent_on_cloud)}`,
            { global_log: true },
          );
          break;
        }
    }

    let compute_servers = [...extra_compute_servers].map((c) => {
      return { hostname: c, freeRam: c == 'home' ? GetFreeRam(ns, c) - 128 : GetFreeRam(ns, c) };
    });
    compute_servers.sort((a, b) => b.freeRam - a.freeRam);

    const max_batch_ram = compute_servers[0].freeRam;
    let hackable_servers = all_servers
      .filter((s) => Weight(ns, s) > 0)
      .map((s) =>
        OptimalBatch(s, { max_batch_ram, min_batch_ram: max_batch_ram / flag.limit_batches_per_server, hgw: flag.hgw }),
      );
    /*hackable_servers = hackable_servers
			.filter(s => !(s.hostname in running));*/

    const running_scipts = [] as {
      process: Unpacked<ReturnType<typeof ns.ps>>;
      parsed_args: Partial<Hacking.HackDelayArgs>;
    }[];
    for (const cs of compute_servers) {
      const processes = ns.ps(cs.hostname);
      for (const p of processes) {
        if (HackScripts.some((s) => s.endsWith(p.filename))) {
          const p_args = ConvertArgsToFlags(p.args, hacking_flags_struct);
          running_scipts.push({
            process: p,
            parsed_args: p_args,
          });
        }
      }
    }

    if (hackable_servers.some((s) => s.cleanup)) {
      const hackable_servers_cleanup = hackable_servers
        .filter((s) => s.cleanup)
        .filter((s) => !running_scipts.some((p) => p.parsed_args.target == s.hostname));
      if (hackable_servers_cleanup.length > 0) hackable_servers = hackable_servers_cleanup;
      else hackable_servers = hackable_servers.filter((s) => !s.cleanup);
    }

    hackable_servers.sort((s1, s2) => {
      return s2.steal.per_gb_per_s * s2.hack_chance - s1.steal.per_gb_per_s * s1.hack_chance;
    });

    compute_servers = compute_servers.filter(
      (cs) => cs.freeRam > hackable_servers[0].ram && !ns.scriptRunning(ScriptNames.hwg_script, cs.hostname),
    );

    if (compute_servers.length == 0) {
      await ns.asleep(1000);
      continue;
    }

    const total_free_ram = compute_servers.reduce((r, s) => r + s.freeRam, 0);

    for (const cloud_server of compute_servers) {
      if (cloud_server.hostname == ns.getHostname()) continue;
      ns.scp(HackScripts, cloud_server.hostname);
    }

    logger.Log(
      `INFO: ${hackable_servers.length} servers found: ` +
        (flag.debug
          ? `${JSON.stringify(hackable_servers[0])}`
          : `${hackable_servers[0].hostname} ${JSON.stringify(hackable_servers[0].threads)}`),
    );
    logger.Log(`INFO: ${compute_servers.length} compute servers found`);

    let started_batches = 0;

    const target_servers = hackable_servers[0]?.cleanup ? [...hackable_servers] : [hackable_servers[0]];

    let sleep = Infinity;
    let lastSync = performance.now();
    for (const target_server of target_servers) {
      sleep = Math.min(target_server.time.weaken, sleep);
      ns.print(`Start batch on ${target_server.hostname} time to finish = ${sleep}`);

      const compute_used = [] as { hostname: string; free_ram: number; ram: number }[];
      compute_servers = compute_servers.filter((cs) => cs.freeRam > target_server.ram);

      for (let cs_ind = 0; cs_ind < compute_servers.length && cs_ind < flag.limit_servers; ++cs_ind) {
        const cs = compute_servers[cs_ind];
        const availableBatches =
          target_server.cleanup || flag.single_batch ? 1 : Math.floor(cs.freeRam / target_server.ram);
        if (availableBatches == 0) break;

        for (let b_ind = 0; b_ind < availableBatches; ++b_ind) {
          const last_batch =
            b_ind == availableBatches - 1 && (cs_ind == flag.limit_servers - 1 || cs_ind == compute_servers.length - 1);

          const common_args = {
            compute_server: cs.hostname,
            target: target_server.hostname,
            port_index: -1,
            log_file: flag.debug ? logger.log_file : '',
            log_prefix: `batch:${started_batches}`,
            finish_at: performance.now() + target_server.time.weaken + started_batches * flag.delay,
          };

          if (target_server.threads.hack > 0) {
            const p_args: Hacking.HackDelayArgs & Hacking.HackFinishAtArgs = {
              ...common_args,
              operation: 'hack',
              process_time: target_server.time.hack,
              delay: target_server.time.weaken - target_server.time.hack + started_batches * flag.delay,
              log_prefix: `  hack batch:${started_batches}`,
            };
            const pid = ns.exec(
              ScriptNames.hwg_script,
              cs.hostname,
              { threads: target_server.threads.hack, temporary: true },
              ...ConvertToArgs(p_args),
            );
            if (pid == 0) throw `Could not start hack`;
          }
          if (target_server.threads.weaken_hack > 0) {
            const last_process = last_batch && target_server.cleanup && target_server.threads.grow === 0;
            if (last_process) {
              common_args.port_index = ns.pid;
            }
            const p_args: Hacking.HackDelayArgs & Hacking.HackFinishAtArgs = {
              ...common_args,
              operation: 'weaken',
              process_time: target_server.time.weaken,
              delay: started_batches * flag.delay,
              log_prefix: ` hweak batch:${started_batches}`,
            };
            const pid = ns.exec(
              ScriptNames.hwg_script,
              cs.hostname,
              { threads: target_server.threads.weaken_hack, temporary: true },
              ...ConvertToArgs(p_args),
            );
            if (pid == 0) throw `Could not start weaken after hack`;
            if (last_process) logger.Log(`Waiting for ${pid} as the end of the batch`);
          }

          if (target_server.threads.grow > 0) {
            const p_args: Hacking.HackDelayArgs & Hacking.HackFinishAtArgs = {
              ...common_args,
              operation: 'grow',
              process_time: target_server.time.grow,
              delay: target_server.time.weaken - target_server.time.grow + started_batches * flag.delay,
              log_prefix: `  grow batch:${started_batches}`,
            };
            const pid = ns.exec(
              ScriptNames.hwg_script,
              cs.hostname,
              { threads: target_server.threads.grow, temporary: true },
              ...ConvertToArgs(p_args),
            );
            if (pid == 0) throw `Could not start grow`;
          }
          if (target_server.threads.weaken_grow > 0) {
            if (last_batch) {
              common_args.port_index = ns.pid;
            }
            const p_args: Hacking.HackDelayArgs & Hacking.HackFinishAtArgs = {
              ...common_args,
              operation: 'weaken',
              process_time: target_server.time.weaken,
              delay: started_batches * flag.delay,
              log_prefix: ` gweak batch:${started_batches}`,
            };
            const pid = ns.exec(
              ScriptNames.hwg_script,
              cs.hostname,
              { threads: target_server.threads.weaken_grow, temporary: true },
              ...ConvertToArgs(p_args),
            );
            if (pid == 0) throw `Could not start weaken after grow`;
            if (last_batch) logger.Log(`Waiting for ${pid} as the end of the batch`);
          }
          ++started_batches;
          if (performance.now() - lastSync > flag.sync_interval) {
            if (flag.debug) logger.Log(`Waiting for processing. ${started_batches} batches already started`);
            const t = performance.now();
            await ns.asleep(0);
            await ns.asleep(0);
            if (flag.debug) logger.Log(`Continuing after ${(performance.now() - t).toFixed(1)}ms`);
            lastSync = performance.now();
          }
        }
        compute_servers[cs_ind].freeRam -= cs.freeRam - target_server.ram * availableBatches;

        compute_used.push({
          hostname: cs.hostname,
          ram: target_server.ram * availableBatches,
          free_ram: cs.freeRam - target_server.ram * availableBatches,
        });

        if (target_server.cleanup) break;
      }

      sleep += flag.delay * started_batches;
      if (flag.debug) logger.Log(`Compute servers used: ${JSON.stringify(compute_used)}`);
      if (!target_server.cleanup) {
        logger.Log(
          `Started ${started_batches} batches on ${target_server.hostname} (${ns.format.ram(
            target_server.ram * started_batches,
          )}/${ns.format.ram(total_free_ram)}). ` +
            `Expected steal ${ns.format.number(
              target_server.steal.total * started_batches * target_server.hack_chance,
            )} in ${ns.format.time(target_server.time.batch + 5)} (${ns.format.number(
              ((target_server.steal.total * started_batches * target_server.hack_chance) /
                (target_server.time.batch + 5)) *
                1000,
            )}, ${ns.format.number(target_server.steal.per_s * started_batches * target_server.hack_chance)}))`,
        );
      } else {
        let diff_diff = (target_server.so.hackDifficulty ?? 0) - (target_server.so.minDifficulty ?? 0);
        let money_diff = (target_server.so.moneyMax ?? 0) - (target_server.so.moneyAvailable ?? 0);
        const cleanup_str = target_servers
          .map((s) => {
            diff_diff = (target_server.so.hackDifficulty ?? 0) - (target_server.so.minDifficulty ?? 0);
            money_diff = (target_server.so.moneyMax ?? 0) - (target_server.so.moneyAvailable ?? 0);
            return {
              hostname: s.hostname,
              diff_diff,
              money_diff,
              money_percent: money_diff / (s.so.moneyMax ?? 1),
            };
          })
          .reduce((str, s) => {
            if (str) str += `, `;
            str += `${s.hostname}: d:${s.diff_diff}, m:${ns.format.number(s.money_diff)}(${s.money_percent})`;
            return str;
          }, '');

        logger.Log(
          `Started ${started_batches} CLEANUP batches; on ${target_server.hostname} (${ns.format.ram(
            target_server.ram * started_batches,
          )}/${ns.format.ram(total_free_ram)}). ` + ` [${cleanup_str}]`,
        );
      }
    }
    //let closest_finish = { hostname: "", end_time: Infinity };

    /*for (let s in running) {
			if (closest_finish.end_time > running[s].processes[0].end_time) {
				closest_finish = {
					hostname: s,
					end_time: running[s].processes[0].end_time
				};
			}
		}*/
    if (started_batches > 0) {
      if (sleep < Infinity)
        ns.printRaw(
          <ProgressBar startTime={performance.now()} endTime={performance.now() + sleep} ns={ns}></ProgressBar>,
        );
      //await ns.nextPortWrite(ns.pid);
      if (target_servers[0].cleanup) {
        logger.Log(`Going to the next iteration while cleanup going on (${target_servers.map((s) => s.hostname)})`);
        await ns.sleep(0);
        await ns.sleep(5);
      } else {
        extra_time = flag.delay * started_batches;
        ns.print(
          `INFO: waiting for something to finish.` +
            ` Next will finish in ${ns.format.time(sleep)} (${target_servers.map((s) => s.hostname)})`,
        );
        await ns.nextPortWrite(ns.pid);
        await ns.sleep(0);
      }
    } else {
      await ns.sleep(5000);
    }
  }

  function OptimalBatch(server: string, { max_batch_ram = Infinity, min_batch_ram = 0, cleanup = true, hgw = false }) {
    const so = ns.getServer(server) as Server;

    let max_batch = {
      threads: {
        hack: 0,
        weaken_hack: 0,
        grow: 0,
        weaken_grow: 0,
      },
      ram: 0,
      steal: {
        total: 0,
        per_gb: 0,
      },
    };

    const formulas = ns.fileExists('Formulas.exe');

    const need_cleanup =
      cleanup &&
      ((so.moneyAvailable ?? 0) < (so.moneyMax ?? 0) || (so.hackDifficulty ?? 0) > (so.minDifficulty ?? 100));
    if (need_cleanup) hgw = false;

    const player = ns.getPlayer();

    const steal_percent = formulas ? ns.formulas.hacking.hackPercent(so, player) : ns.hackAnalyzeChance(server);
    const steal_amount = (so.moneyMax ?? 0) * steal_percent;
    const weaken_time = formulas ? ns.formulas.hacking.weakenTime(so, player) : ns.getWeakenTime(server);
    const batch_time = weaken_time + extra_time;

    function calcHackThreads(hack_threads: number) {
      const so = {
        moneyMax: 0,
        moneyAvailable: 0,
        hackDifficulty: 0,
        minDifficulty: 0,
        ...(ns.getServer(server) as Server),
      };
      if (!cleanup) {
        so.hackDifficulty = so.minDifficulty;
        so.moneyAvailable = so.moneyMax;
      }
      let total_steal = steal_amount * hack_threads;
      if (total_steal > so.moneyMax) total_steal = so.moneyMax;

      so.hackDifficulty = so.hackDifficulty + ns.hackAnalyzeSecurity(hack_threads);
      so.moneyAvailable = so.moneyAvailable - total_steal;
      const hweak_target = so.hackDifficulty - so.minDifficulty;

      const weaken_hack_threads = hgw
        ? 0
        : Math.ceil(hweak_target / (formulas ? ns.formulas.hacking.weakenEffect(1) : ns.weakenAnalyze(1)));
      if (!hgw) {
        so.hackDifficulty = so.minDifficulty;
      }

      const grow_threads = formulas
        ? ns.formulas.hacking.growThreads(so, player, so.moneyMax)
        : ns.growthAnalyze(server, so.moneyMax / so.moneyAvailable) + 1;

      so.hackDifficulty += ns.growthAnalyzeSecurity(grow_threads);
      const gweak_target = so.hackDifficulty - so.minDifficulty;
      const weaken_grow_threads =
        Math.ceil(gweak_target / (formulas ? ns.formulas.hacking.weakenEffect(1) : ns.weakenAnalyze(1))) + 1;

      const ram =
        hack_threads * hackRam + grow_threads * growRam + (weaken_hack_threads + weaken_grow_threads) * weakenRam;

      return {
        threads: {
          hack: hack_threads,
          weaken_hack: weaken_hack_threads,
          grow: grow_threads,
          weaken_grow: weaken_grow_threads,
        },
        ram,
        steal: {
          total: total_steal,
          per_gb: total_steal / ram,
        },
      };
    }

    if (need_cleanup) {
      max_batch = calcHackThreads(0);
    } else {
      for (let hack_threads = 1; hack_threads <= max_batch_ram / (hackRam + growRam + 2 * weakenRam); hack_threads++) {
        const threads = calcHackThreads(hack_threads);
        if (threads.ram > max_batch_ram) break;
        if (threads.steal.total == (so.moneyMax ?? 0)) {
          if (max_batch.steal.total === 0) max_batch = threads;
          break;
        }
        if (threads.ram < min_batch_ram) continue;
        if (threads.steal.per_gb > max_batch.steal.per_gb) {
          max_batch = threads;
        }
      }
    }
    return {
      ...max_batch,
      hostname: server,
      hack_chance: formulas ? ns.formulas.hacking.hackChance(so, player) : ns.hackAnalyzeChance(server),
      steal: {
        ...max_batch.steal,
        per_gb_per_s: (max_batch.steal.total / max_batch.ram / batch_time) * 1000,
        per_s: (max_batch.steal.total / batch_time) * 1000,
      },
      time: {
        hack: formulas ? ns.formulas.hacking.hackTime(so, player) : ns.getHackTime(server),
        grow: formulas ? ns.formulas.hacking.growTime(so, player) : ns.getGrowTime(server),
        weaken: weaken_time,
        batch: batch_time,
      },
      so: ns.getServer(server) as Server,
      cleanup: need_cleanup,
    };
  }
}

export function autocomplete(data: AutocompleteData, args: ScriptArg[]) {
  data.flags(flags_data);
  return ['--tail'];
}
