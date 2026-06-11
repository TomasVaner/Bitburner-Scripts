import { ScriptNames, HackScripts, Strings } from '@/utility/constants';
import { NSLogger } from '@/utility/log';
import { Batch, GetAllServers, GetFreeRam, GetRoute, OptimalBatch, Weight } from '@/utility/scanner';
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
    ns.disableLog('brutessh');
    ns.disableLog('ftpcrack');
    ns.disableLog('httpworm');
    ns.disableLog('relaysmtp');
    ns.disableLog('sqlinject');
  } // ignore logs
  const logger = new NSLogger(ns);
  logger.Log('Started hacking');
  ns.clearLog();
  // eslint-disable-next-line no-debugger
  debugger;

  const hack_sripts_ram = {
    hackRam: ns.getScriptRam(ScriptNames.hwg_script) + ns.getFunctionRamCost('hack'),
    growRam: ns.getScriptRam(ScriptNames.hwg_script) + ns.getFunctionRamCost('grow'),
    weakenRam: ns.getScriptRam(ScriptNames.hwg_script) + ns.getFunctionRamCost('weaken'),
  };

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
        flag.debug &&
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
    let money = money_made / 2 - spent_on_cloud;
    logger.Log(
      `$${ns.format.number(money_made - money_made_reported)} were made in the last batch. $${ns.format.number(
        money_made,
      )} made in total (${ns.format.number(money_per_s)}). Money left for cloud purchase: ${ns.format.number(money)}`,
    );
    money_made_reported = money_made;

    if (flag.buy_clouds) {
      if (clouds.length < ns.cloud.getServerLimit()) {
        while (
          ns.cloud.getServerNames().length < ns.cloud.getServerLimit() &&
          money >= ns.cloud.getServerCost(flag.cloud_starting_memory)
        ) {
          for (let memory = 2 ** 20; memory >= flag.cloud_starting_memory; memory /= 2) {
            if (ns.cloud.getServerCost(memory) < money) {
              spent_on_cloud += ns.cloud.getServerCost(memory);
              money -= ns.cloud.getServerCost(memory);
              ns.cloud.purchaseServer(`cloud`, memory);
              logger.Log(
                `Purchased cloud server with ${ns.format.ram(memory)}. Spent on clouds: ${ns.format.number(
                  spent_on_cloud,
                )}. Money left to spend: ${ns.format.number(money)}`,
                {
                  global_log: true,
                },
              );
              break;
            }
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
    }

    let compute_servers = [...extra_compute_servers].map((c) => {
      return { hostname: c, freeRam: c == 'home' ? Math.max(GetFreeRam(ns, c) - 128, 0) : GetFreeRam(ns, c) };
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

    const hackable_servers = all_servers.filter((s) => ns.getServer(s).hasAdminRights && Weight(ns, s) > 0);
    if (hackable_servers.length === 0) {
      hackable_servers.push('n00dles');
    }
    const hack_batches = hackable_servers
      .map((s) =>
        OptimalBatch(
          ns,
          hack_sripts_ram,
          s,
          {
            compute_servers,
            max_batch_count: flag.limit_batches,
            max_process_count: flag.limit_processes,
          },
          { extra_time },
        ),
      )
      .sortby((s) => (s.batches.optimal.steal.total * s.hack_chance) / s.batches.optimal.batch_time, false);

    const cleanup_servers = [];
    let hack_server: Unpacked<typeof hack_batches> | undefined = undefined;

    const compute_servers_for_cleanup = structuredClone(compute_servers);

    for (let server of hack_batches.filter(
      (hs) => !running_scipts.some((rs) => rs.parsed_args.target == hs.hostname),
    )) {
      let optimized_cleanup = false;
      if (server.batches.cleanup !== undefined) {
        if (compute_servers_for_cleanup[0].freeRam < server.batches.cleanup?.ram) {
          server = OptimalBatch(
            ns,
            hack_sripts_ram,
            server.hostname,
            {
              compute_servers: compute_servers_for_cleanup,
              optimize_cleanup: true,
            },
            {},
          );
          optimized_cleanup = true;
        }
        if (
          (server.batches.cleanup?.threads.weaken_hack ?? 0) +
            (server.batches.cleanup?.threads?.grow ?? 0) +
            (server.batches.cleanup?.threads.weaken_grow ?? 0) >
            0 &&
          (server.batches.cleanup?.ram ?? 0) < compute_servers_for_cleanup[0].freeRam
        ) {
          compute_servers_for_cleanup[0].freeRam -= server.batches.cleanup?.ram ?? 0;
          compute_servers_for_cleanup.sortby((cs) => cs.freeRam, false);
          cleanup_servers.push(server);
        } else continue;
      }
      if (
        server.batches.cleanup === undefined ||
        (server.so.hackDifficulty == server.so.minDifficulty && !optimized_cleanup)
      ) {
        hack_server = server;
        break;
      }
    }

    if (hack_server !== undefined && cleanup_servers.length > 0) {
      const total_ram = compute_servers.sum((cs) => cs.freeRam);
      const total_ram_leftover = compute_servers_for_cleanup.sum((cs) => cs.freeRam);
      const total_processes_used = cleanup_servers.sum((cs) => cs.batches.cleanup?.get_processes() ?? 0);
      const total_batches_used = cleanup_servers.length;
      const hack_server_prev = hack_server;
      hack_server = OptimalBatch(
        ns,
        hack_sripts_ram,
        hack_server.hostname,
        {
          compute_servers: compute_servers_for_cleanup,
          max_batch_count: flag.limit_batches - total_batches_used,
          max_process_count: flag.limit_processes - total_processes_used,
        },
        { extra_time },
      );
      logger.Log(
        `WARNING: switch batch for ${hack_server_prev.hostname}: ${hack_server_prev.batches.optimal.to_string(
          ns,
        )} -> ${hack_server.batches.optimal.to_string(
          ns,
        )} pu:${total_processes_used} bu:${total_batches_used} ru:${ns.format.ram(
          compute_servers.sum((cs) => cs.freeRam) - total_ram_leftover,
        )} can afford_batches: ${Math.floor(total_ram / hack_server_prev.batches.optimal.ram)} -> ${Math.floor(
          total_ram_leftover / hack_server.batches.optimal.ram,
        )}`,
      );

      if (hack_server.batches.optimal.ram > compute_servers_for_cleanup[0].freeRam) {
        hack_server = undefined;
      }
    }

    for (const cloud_server of compute_servers) {
      if (cloud_server.hostname == ns.getHostname()) continue;
      ns.scp(HackScripts, cloud_server.hostname);
    }

    logger.Log(`INFO: ${compute_servers.length} compute servers found`);
    if (cleanup_servers.length > 0) {
      logger.Log(
        `WARNING: ${cleanup_servers.length} cleanup servers. ${cleanup_servers.map(
          (cs) => `${cs.hostname}: ${cs.batches.cleanup?.to_string(ns)}=>${cs.batches.optimal.to_string(ns)}`,
        )}`,
      );
    }
    if (hack_server !== undefined) {
      logger.Log(`INFO: Found hack target: ${hack_server.hostname}: ${hack_server.batches.optimal.to_string(ns)}`);
    }

    let started_batches = 0;
    let started_processes = 0;
    let lastSync = performance.now();
    const start_launch_time = performance.now();
    if (compute_servers.length === 0) {
      throw `No compute servers available for batch processing`;
    }

    const convert_to_args = (arg_obj: Hacking.HackDelayArgs) => ConvertToArgs(arg_obj);

    function get_process_args(target: Unpacked<typeof hack_batches>, batch: Batch) {
      const common_args = {
        target: target.hostname,
        port_index: -1,
        log_file: flag.debug ? logger.log_file : '',
      };

      const process_args = {
        hack: convert_to_args({
          ...common_args,
          operation: 'hack',
          delay: target.time.weaken - target.time.hack,
        }),
        weaken_hack: convert_to_args({
          ...common_args,
          operation: 'weaken',
          delay: 0,
        }),
        grow: convert_to_args({
          ...common_args,
          operation: 'grow',
          delay: target.time.weaken - target.time.grow,
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
        hack: { threads: batch.threads.hack, temporary: true, ramOverride: hack_sripts_ram.hackRam },
        weaken_hack: { threads: batch.threads.weaken_hack, temporary: true, ramOverride: hack_sripts_ram.weakenRam },
        grow: { threads: batch.threads.grow, temporary: true, ramOverride: hack_sripts_ram.growRam },
        weaken_grow: { threads: batch.threads.weaken_grow, temporary: true, ramOverride: hack_sripts_ram.weakenRam },
      } as { hack: RunOptions; weaken_hack: RunOptions; grow: RunOptions; weaken_grow: RunOptions };

      return [process_args, thread_args] as [typeof process_args, typeof thread_args];
    }

    async function start_batches(
      batch: Batch,
      compute_server: Unpacked<typeof compute_servers>,
      process_args: {
        hack: ScriptArg[];
        weaken_hack: ScriptArg[];
        grow: ScriptArg[];
        weaken_grow: ScriptArg[];
        weaken_grow_last: ScriptArg[];
      },
      thread_args: { hack: RunOptions; weaken_hack: RunOptions; grow: RunOptions; weaken_grow: RunOptions },
      last_cs: boolean,
    ) {
      const availableBatches = Math.floor(
        Math.min(
          batch.threads.hack === 0 ? 1 : Infinity,
          compute_server.freeRam / batch.ram,
          flag.limit_batches - started_batches,
          (flag.limit_processes - started_processes) / batch.get_processes(),
        ),
      );

      last_cs ||= started_batches + availableBatches + 1 > flag.limit_batches;
      last_cs ||= started_processes + (availableBatches + 1) * batch.get_processes() > flag.limit_processes;

      if (availableBatches <= 0) {
        if (flag.debug)
          logger.Log(
            `ERROR: ${JSON.stringify(compute_server)}: No available batches for ${batch.to_string(
              ns,
            )}, prcessess: ${started_processes}, batches: ${started_batches}`,
          );
        return 0;
      }

      for (let b_ind = 0; b_ind < availableBatches; ++b_ind) {
        const last_batch = b_ind == availableBatches - 1 && last_cs;

        if (batch.threads.hack > 0) {
          ns.exec(ScriptNames.hwg_script, compute_server.hostname, thread_args.hack, ...process_args.hack);
          ++started_processes;
        }
        if (batch.threads.weaken_hack > 0) {
          const last_process = last_batch && batch.threads.hack === 0 && batch.threads.grow === 0;
          ns.exec(
            ScriptNames.hwg_script,
            compute_server.hostname,
            thread_args.weaken_hack,
            ...(last_process ? process_args.weaken_grow_last : process_args.weaken_grow),
          );
          ++started_processes;
        }

        if (batch.threads.grow > 0) {
          ns.exec(ScriptNames.hwg_script, compute_server.hostname, thread_args.grow, ...process_args.grow);
          ++started_processes;
        }
        if (batch.threads.weaken_grow > 0) {
          const pid = ns.exec(
            ScriptNames.hwg_script,
            compute_server.hostname,
            thread_args.weaken_grow,
            ...(last_batch ? process_args.weaken_grow_last : process_args.weaken_grow),
          );
          if (last_batch) {
            logger.Log(`Last process on ${compute_server.hostname} is PID ${pid}`);
          }
          ++started_processes;
        }
        ++started_batches;
        ns.enums.LocationName;
        if (performance.now() - lastSync > flag.sync_interval) {
          await ns.asleep(0);
          await ns.asleep(0);
          lastSync = performance.now();
        }
      }
      compute_server.freeRam -= batch.ram * availableBatches;
      return availableBatches;
    }

    const waiting_for_sleep =
      hack_server === undefined
        ? cleanup_servers.length > 0
          ? cleanup_servers.reduce((s1, s2) =>
              (s2.batches.cleanup?.batch_time ?? 0) > (s1.batches.cleanup?.batch_time ?? 0) ? s1 : s2,
            )?.batches?.cleanup
          : undefined
        : hack_server.batches.optimal;

    for (const cleanup_server of cleanup_servers) {
      if (cleanup_server.batches.cleanup === undefined) throw `Unexpected empty cleanup batch`;
      if ((cleanup_server.batches.cleanup?.ram ?? 0) > (compute_servers[0]?.freeRam ?? 0)) {
        throw new Error(
          `ERROR: could not start cleanup for ${cleanup_server.hostname}: ${cleanup_server.batches.cleanup?.to_string(
            ns,
          )}, free ram: ${ns.format.ram(compute_servers[0].freeRam)}`,
        );
      }

      const diff_diff = (cleanup_server.so.hackDifficulty ?? 0) - (cleanup_server.so.minDifficulty ?? 0);
      const money_diff = (cleanup_server.so.moneyMax ?? 0) - (cleanup_server.so.moneyAvailable ?? 0);
      const money_percent = money_diff / (cleanup_server.so.moneyMax ?? 1);
      const cleanup_str = `${cleanup_server.hostname}: d:${diff_diff}, m:${ns.format.number(
        money_diff,
      )}(${ns.format.percent(money_percent)})`;

      logger.Log(
        `Start cleanup batch on ${cleanup_str}: ${cleanup_server.batches.cleanup?.to_string(
          ns,
        )}. Time since start: ${ns.format.time(start_launch_time - start_time, true)}. Compute server: ${
          compute_servers[0].hostname
        }[${ns.format.ram(compute_servers[0].freeRam)}]`,
      );

      const [process_args, thread_args] = get_process_args(cleanup_server, cleanup_server.batches.cleanup);
      await start_batches(
        cleanup_server.batches.cleanup,
        compute_servers[0],
        process_args,
        thread_args,
        hack_server === undefined && cleanup_server.batches.cleanup === waiting_for_sleep,
      );
      compute_servers.sortby((cs) => cs.freeRam, false);
    }

    if (cleanup_servers.length > 0) {
      const total_free_ram = compute_servers.sum((cs) => cs.freeRam);
      const total_free_ram_calc = compute_servers_for_cleanup.sum((cs) => cs.freeRam);
      if (total_free_ram_calc != total_free_ram) {
        logger.Log(
          `WARNING: Total free RAM mismatch: r:${total_free_ram} != c:${total_free_ram_calc}. ${JSON.stringify(
            compute_servers,
          )} ${JSON.stringify(compute_servers_for_cleanup)}`,
        );
      }
    }

    if (hack_server !== undefined) {
      compute_servers = compute_servers.filter((cs) => cs.freeRam >= (hack_server?.batches?.optimal?.ram ?? 0));
      const total_free_ram = compute_servers.sum((cs) => cs.freeRam);
      let hack_batches = 0;
      for (let cs_ind = 0; cs_ind < compute_servers.length; ++cs_ind) {
        const cs = compute_servers[cs_ind];
        const [process_args, thread_args] = get_process_args(hack_server, hack_server.batches.optimal);
        hack_batches += await start_batches(
          hack_server.batches.optimal,
          cs,
          process_args,
          thread_args,
          cs_ind == compute_servers.length - 1,
        );
      }

      logger.Log(
        `Started ${hack_batches} batches on ${hack_server.hostname} (${ns.format.ram(
          hack_server.batches.optimal.ram * hack_batches,
        )}/${ns.format.ram(total_free_ram)}). ` +
          `Expected steal ${ns.format.number(
            hack_server.batches.optimal.steal.per_batch * hack_batches * hack_server.hack_chance,
          )} / ${ns.format.number(
            hack_server.batches.optimal.steal.total * hack_server.hack_chance,
          )} in ${ns.format.time(hack_server.batches.optimal.batch_time + 5)} (${ns.format.number(
            ((hack_server.batches.optimal.steal.per_batch * hack_batches * hack_server.hack_chance) /
              hack_server.time.weaken) *
              1000,
          )}, ${ns.format.number(
            ((hack_server.batches.optimal.steal.per_batch * hack_batches * hack_server.hack_chance) /
              hack_server.batches.optimal.batch_time) *
              1000,
          )}))`,
      );
    }
    logger.Log(`WARNING: Exec time: ${ns.format.time(performance.now() - start_launch_time, true)}`);

    if (started_batches > 0) {
      /*ns.printRaw(
          <ProgressBar startTime={performance.now()} endTime={performance.now() + sleep} ns={ns}></ProgressBar>,
        );*/
      extra_time = performance.now() - start_time;
      if (waiting_for_sleep !== undefined) {
        logger.Log(
          `Next finish at ${new Date(Date.now() + waiting_for_sleep.batch_time).toLocaleString()} in ${ns.format.time(
            waiting_for_sleep.batch_time,
            true,
          )} extra time: ${ns.format.time(extra_time, true)}`,
        );
        const res = await Promise.any([ns.nextPortWrite(ns.pid), ns.asleep(waiting_for_sleep.batch_time + extra_time)]);
        if (res === true) {
          logger.Log(`WARNING: await process timed out`);
        }
        await ns.sleep(0);
      }
    } else {
      await ns.sleep(60000);
    }
    if (flag.debug) break;
  }
}

export function autocomplete(data: AutocompleteData, args: ScriptArg[]) {
  data.flags(flags_data);
  return ['--tail'];
}
