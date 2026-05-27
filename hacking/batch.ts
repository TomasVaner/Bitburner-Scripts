import { ScriptNames, HackScripts, Strings } from '@/utility/constants';
import { NSLogger } from '@/utility/log';
import { GetAllServers, GetFreeRam, GetRoute, OptimalBatch, Weight } from '@/utility/scanner';
import { ConvertArgsToFlags, ConvertToArgs, ConvertToFlagsData, Hacking } from '@/utility/flags';
import { ProgressBar } from '@/ui/progress_bar';
import { main as hwg_main, flags_struct as hacking_flags_struct } from '@/hacking/simple/hwg_uni';
import '@/utility/extensions/array';

const flag_struct = {
  buy_clouds: false,
  cloud_starting_memory: 64,
  limit_batches: Infinity,
  limit_processes: Infinity,
  limit_servers: Infinity,
  single_batch: false,
  debug: false,
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
  // eslint-disable-next-line no-debugger
  if (flag.debug) debugger;

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
    }

    const start_time = performance.now();

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
    compute_servers.sort((a, b) => b.freeRam - a.freeRam).slice(0, flag.limit_servers);

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

    const max_ram = compute_servers.sum((cs) => cs.freeRam);
    let hackable_servers = all_servers
      .filter((s) => Weight(ns, s) > 0)
      .map((s) =>
        OptimalBatch(
          ns,
          { hackRam, growRam, weakenRam },
          s,
          {
            max_ram,
            max_batch_count: flag.limit_batches,
            max_process_count: flag.limit_processes,
          },
          { extra_time },
        ),
      );

    if (hackable_servers.some((s) => s.cleanup)) {
      const hackable_servers_cleanup = hackable_servers
        .filter((s) => s.cleanup)
        .filter((s) => !running_scipts.some((p) => p.parsed_args.target == s.hostname))
        .sortby((s) => s.ram);
      if (hackable_servers_cleanup.length > 0) hackable_servers = hackable_servers_cleanup;
      else hackable_servers = hackable_servers.filter((s) => !s.cleanup);

      hackable_servers.sortby((s) => (s.steal.total * s.hack_chance) / s.batch_time, false);
    }

    if (hackable_servers.length === 0) {
      await ns.sleep(5000);
      continue;
    }
    /*hackable_servers = hackable_servers
			.filter(s => !(s.hostname in running));*/

    if (!hackable_servers[0].cleanup)
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

    const start_launch_time = performance.now();

    let sleep = Infinity;
    const lastSync = performance.now();
    for (let target_server of target_servers) {
      sleep = Math.min(target_server.time.weaken, sleep);

      if (compute_servers.length === 0) {
        logger.Log(`No compute servers available for batch processing`);
        break;
      }
      if (target_server.cleanup) {
        compute_servers = compute_servers.sortby((cs) => cs.freeRam, false);
        if (target_server.ram > compute_servers[0]?.freeRam ?? 0) {
          const initial_target = target_server;
          target_server = OptimalBatch(
            ns,
            { hackRam, growRam, weakenRam },
            target_server.hostname,
            {
              max_ram: compute_servers[0].freeRam,
              optmize_cleanup: true,
            },
            {},
          );
          if (target_server.ram > compute_servers[0].freeRam) {
            logger.Log(`Could not find enough memory to clean ${target_server.hostname}`);
            continue;
          } else {
            logger.Log(
              `Reduced cleanup batch for ${target_server.hostname} from ${ns.format.ram(
                initial_target.ram,
              )} to ${ns.format.ram(target_server.ram)}/${ns.format.ram(compute_servers[0].freeRam)}. ${
                initial_target.threads.weaken_hack
              }|${initial_target.threads.grow}|${initial_target.threads.weaken_grow} -> ${
                target_server.threads.weaken_hack
              }|${target_server.threads.grow}|${target_server.threads.weaken_grow}`,
            );
          }
        }
      }
      ns.print(
        `Start batch on ${target_server.hostname} time to finish = ${ns.format.time(
          target_server.time.batch,
        )}. Time since start: ${ns.format.time(start_launch_time - start_time, true)}. Compute server: ${
          compute_servers[0].hostname
        }[${ns.format.ram(compute_servers[0].freeRam)}]`,
      );

      const common_args = {
        target: target_server.hostname,
        port_index: -1,
        log_file: flag.debug ? logger.log_file : '',
      };

      const convert_to_args = (arg_obj: Hacking.HackDelayArgs) => ConvertToArgs(arg_obj);

      const process_args = {
        hack: convert_to_args({
          ...common_args,
          operation: 'hack',
          delay: target_server.time.weaken - target_server.time.hack,
        }),
        weaken_hack: convert_to_args({
          ...common_args,
          operation: 'weaken',
          delay: 0,
        }),
        grow: convert_to_args({
          ...common_args,
          operation: 'grow',
          delay: target_server.time.weaken - target_server.time.grow,
        }),
        weaken_grow: convert_to_args({
          ...common_args,
          operation: 'weaken',
          delay: 0,
        }),
        weaken_grow_last: convert_to_args({
          ...common_args,
          operation: 'weaken',
          delay: 0,
          port_index: ns.pid,
        }),
      };

      const thread_args = {
        hack: { threads: target_server.threads.hack, temporary: true, ramOverride: hackRam },
        weaken_hack: { threads: target_server.threads.weaken_hack, temporary: true, ramOverride: weakenRam },
        grow: { threads: target_server.threads.grow, temporary: true, ramOverride: growRam },
        weaken_grow: { threads: target_server.threads.weaken_grow, temporary: true, ramOverride: weakenRam },
      } as { hack: RunOptions; weaken_hack: RunOptions; grow: RunOptions; weaken_grow: RunOptions };

      compute_servers = compute_servers.filter((cs) => cs.freeRam > target_server.ram);

      for (let cs_ind = 0; cs_ind < compute_servers.length; ++cs_ind) {
        const cs = compute_servers[cs_ind];
        const availableBatches =
          target_server.cleanup || flag.single_batch ? 1 : Math.floor(cs.freeRam / target_server.ram);
        if (availableBatches == 0) break;

        for (let b_ind = 0; b_ind < availableBatches; ++b_ind) {
          const last_batch = b_ind == availableBatches - 1 && cs_ind == compute_servers.length - 1;

          if (target_server.threads.hack > 0) {
            ns.exec(ScriptNames.hwg_script, cs.hostname, thread_args.hack, ...process_args.hack);
          }
          if (target_server.threads.weaken_hack > 0) {
            const last_process = last_batch && target_server.cleanup && target_server.threads.grow === 0;
            ns.exec(
              ScriptNames.hwg_script,
              cs.hostname,
              thread_args.weaken_hack,
              ...(last_process ? process_args.weaken_grow_last : process_args.weaken_grow),
            );
          }

          if (target_server.threads.grow > 0) {
            ns.exec(ScriptNames.hwg_script, cs.hostname, thread_args.grow, ...process_args.grow);
          }
          if (target_server.threads.weaken_grow > 0) {
            ns.exec(
              ScriptNames.hwg_script,
              cs.hostname,
              thread_args.weaken_grow,
              ...(last_batch ? process_args.weaken_grow_last : process_args.weaken_grow),
            );
          }
          ++started_batches;
          /*if (performance.now() - lastSync > flag.sync_interval) {
            await ns.asleep(0);
            lastSync = performance.now();
          }*/
        }
        compute_servers[cs_ind].freeRam -= target_server.ram * availableBatches;

        if (target_server.cleanup) break;
      }

      logger.Log(`WARNING: Exec time: ${ns.format.time(performance.now() - start_launch_time, true)}`);
      if (!target_server.cleanup) {
        logger.Log(
          `Started ${started_batches} batches on ${target_server.hostname} (${ns.format.ram(
            target_server.ram * started_batches,
          )}/${ns.format.ram(total_free_ram)}). ` +
            `Expected steal ${ns.format.number(
              target_server.steal.per_batch * started_batches * target_server.hack_chance,
            )} / ${ns.format.number(target_server.steal.total * target_server.hack_chance)} in ${ns.format.time(
              target_server.time.batch + 5,
            )} (${ns.format.number(
              ((target_server.steal.per_batch * started_batches * target_server.hack_chance) /
                target_server.time.weaken) *
                1000,
            )}, ${ns.format.number(
              ((target_server.steal.per_batch * started_batches * target_server.hack_chance) /
                target_server.time.batch) *
                1000,
            )}))`,
        );
      } else {
        const diff_diff = (target_server.so.hackDifficulty ?? 0) - (target_server.so.minDifficulty ?? 0);
        const money_diff = (target_server.so.moneyMax ?? 0) - (target_server.so.moneyAvailable ?? 0);
        const money_percent = money_diff / (target_server.so.moneyMax ?? 1);
        const cleanup_str = `${target_server.hostname}: d:${diff_diff}, m:${ns.format.number(
          money_diff,
        )}(${ns.format.percent(money_percent)})`;

        logger.Log(
          `Started CLEANUP batch on ${target_server.hostname} (${ns.format.ram(
            target_server.ram * started_batches,
          )}). ` + ` [${cleanup_str}]`,
        );
      }
    }

    if (started_batches > 0) {
      if (sleep < Infinity)
        /*ns.printRaw(
          <ProgressBar startTime={performance.now()} endTime={performance.now() + sleep} ns={ns}></ProgressBar>,
        );*/
        logger.Log(`Next finish at ${new Date(Date.now() + sleep).toLocaleString()} `);
      //await ns.nextPortWrite(ns.pid);
      if (target_servers[0].cleanup) {
        logger.Log(`Going to the next iteration while cleanup going on (${target_servers.map((s) => s.hostname)})`);
        await ns.sleep(0);
        await ns.sleep(5);
      } else {
        extra_time = performance.now() - start_time;
        ns.print(
          `INFO: waiting for something to finish.` +
            ` Next will finish in ${ns.format.time(sleep)} (${target_servers.map(
              (s) => s.hostname,
            )}) extra time: ${ns.format.time(extra_time, true)}`,
        );
        await ns.nextPortWrite(ns.pid);
        await ns.sleep(0);
      }
    } else {
      await ns.sleep(5000);
    }
    if (flag.debug) break;
  }
}

export function autocomplete(data: AutocompleteData, args: ScriptArg[]) {
  data.flags(flags_data);
  return ['--tail'];
}
