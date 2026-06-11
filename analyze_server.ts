import { GetAllServers, GetFreeRam, OptimalBatch } from '@/utility/scanner';
import { NSLogger } from '@/utility/log';
import { ConvertToFlagsData, GetLastArgument } from '@/utility/flags';
import { ScriptNames } from '@/utility/constants';
import '@/utility/extensions/array';

const flag_struct = {
  hostname: '',
  limit_batches: Infinity,
  limit_processes: Infinity,
  extra_time: 0,
  delay: 0,
  cores: 1,
};
const flags_data = ConvertToFlagsData(flag_struct);

export async function main(ns: NS) {
  const flag = ns.flags(flags_data) as typeof flag_struct;
  const logger = new NSLogger(ns);
  debugger;

  const all_servers = GetAllServers(ns)
    .map((s) => ns.getServer(s))
    .filter((s) => (s.requiredHackingSkill ?? 0) <= ns.getPlayer().skills.hacking);
  const compute_servers = all_servers
    .filter((s) => s.hasAdminRights && s.maxRam > 0)
    .map((c) => {
      return { hostname: c.hostname, freeRam: c.hostname == 'home' ? Math.max(0, c.maxRam - 128) : c.maxRam };
    })
    .sortby((a) => a.freeRam, false);

  const hackRam = ns.getScriptRam(ScriptNames.hwg_script) + ns.getFunctionRamCost('hack');
  const growRam = ns.getScriptRam(ScriptNames.hwg_script) + ns.getFunctionRamCost('grow');
  const weakenRam = ns.getScriptRam(ScriptNames.hwg_script) + ns.getFunctionRamCost('weaken');

  const total_ram = compute_servers.sum((cs) => cs.freeRam);

  logger.Log(`Total free RAM across extra compute servers: ${ns.format.number(total_ram)}`);

  const hack_servers =
    flag.hostname.length === 0 ? all_servers.filter((s) => !s.purchasedByPlayer) : [ns.getServer(flag.hostname)];

  const batches = hack_servers
    .map((s) =>
      OptimalBatch(
        ns,
        { hackRam, growRam, weakenRam },
        s.hostname,
        {
          compute_servers,
          max_batch_count: flag.limit_batches,
          max_process_count: flag.limit_processes,
          cores: flag.cores,
        },
        { extra_time: flag.extra_time },
        hack_servers.length === 1 ? logger : undefined,
      ),
    )
    .sortby((b) => (b.batches.optimal.steal.total * b.hack_chance) / b.batches.optimal.batch_time);

  for (const optimal_batch of batches) {
    const total_batches = compute_servers.sum((cs) => Math.floor(cs.freeRam / optimal_batch.batches.optimal.ram));
    logger.Log(
      `Target: ${optimal_batch.hostname} Total batches: ${total_batches}. RAM used: ${ns.format.ram(
        optimal_batch.batches.optimal.ram * total_batches,
      )}`,
    );
    if (optimal_batch.need_cleanup) logger.Log(`\tCleanup: ${optimal_batch.batches.cleanup?.to_string(ns)}`);
    logger.Log(
      `\tOptimal: ${optimal_batch.batches.optimal.to_string(ns)} ${ns.format.percent(
        optimal_batch.hack_chance,
      )}. $${ns.format.number(
        optimal_batch.batches.optimal.steal.per_batch * total_batches * optimal_batch.hack_chance,
      )} $${ns.format.number(
        ((optimal_batch.batches.optimal.steal.per_batch * total_batches * optimal_batch.hack_chance) /
          optimal_batch.batches.optimal.batch_time) *
          1000,
      )}/s`,
    );
  }
}

export function autocomplete(data: AutocompleteData, args: ScriptArg[]) {
  if (GetLastArgument(data, args) == '--hostname' && !data.servers.includes(args.at(-1) as string)) return data.servers;
  data.flags(flags_data);
  return ['--tail'];
}
