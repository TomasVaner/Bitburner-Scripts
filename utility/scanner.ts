import { Logger } from '@/utility/log';
import '@/utility/extensions/array';

export function GetFreeRam(ns: NS, server: string) {
  return ns.getServerMaxRam(server) - ns.getServerUsedRam(server);
}

export function Weight(ns: NS, server: string): number {
  if (!server) return 0;

  // Don't ask, endgame stuff
  if (server.startsWith('hacknet-node')) return 0;

  // Get the player information
  const player = ns.getPlayer();

  // Get the server information
  const so = ns.getServer(server) as Server;
  if (!so) return 0;

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
    weight =
      ((so.moneyMax ?? 0) / ns.formulas.hacking.weakenTime(so, player)) * ns.formulas.hacking.hackChance(so, player);
  }
  // If we do not have formulas, we can't properly factor in hackchance, so we lower the hacking level tolerance by half
  else if ((so.requiredHackingSkill ?? 0) > player.skills.hacking / 2) return 0;

  return weight;
}

export function GetAllServers(
  ns: NS,
  root = 'home',
  found: string[] = [],
  { print_route = false, shift = '', distance = 0 } = {},
): string[] {
  found.push(root);
  if (print_route) {
    ns.tprint(shift, root, ` (${distance})`);
  }
  const connected_servers = root == 'home' ? ns.scan(root) : ns.scan(root).slice(1);
  for (let s_ind = 0; s_ind < connected_servers.length; ++s_ind) {
    let next_shift = shift.replace('┗', ' ').replace('┣', '┃');
    next_shift += s_ind == connected_servers.length - 1 ? '┗' : '┣';
    GetAllServers(ns, connected_servers[s_ind], found, { print_route, shift: next_shift, distance: distance + 1 });
  }

  return found;
}

export function GetRoute(
  ns: NS,
  hostname: string,
  root = 'home',
  found: string[] = [],
  current_route: string[] = [],
): string[] {
  found.push(root);
  current_route.push(root);
  const connected_servers = ns.scan(root).filter((s) => !found.includes(s));
  for (const server of connected_servers) {
    if (server === hostname) {
      current_route.push(server);
      return current_route;
    }
    const ret = GetRoute(ns, hostname, server, found, [...current_route]);
    if (ret.length > 0) return ret;
  }

  return [];
}

export class Batch {
  constructor(
    public threads: { hack: number; weaken_hack: number; grow: number; weaken_grow: number } = {
      hack: 0,
      weaken_hack: 0,
      grow: 0,
      weaken_grow: 0,
    },
    public ram: number = Number.MAX_VALUE,
    public batch_time: number = Number.MAX_VALUE,
    public steal: {
      total: number;
      per_batch: number;
      percent: number;
    } = { total: 0, per_batch: 0, percent: 0 },
  ) {}

  to_string(ns: NS) {
    return (
      `${this.threads.hack}|${this.threads.weaken_hack}|${this.threads.grow}|${
        this.threads.weaken_grow
      } ${ns.format.ram(this.ram)} ` +
      (this.threads.hack > 0
        ? `$${ns.format.number(this.steal.per_batch)}(${ns.format.percent(this.steal.percent)}) `
        : ' ') +
      `${ns.format.time(this.batch_time)}` +
      (this.threads.hack > 0
        ? `. $${ns.format.number(this.steal.total)}($${ns.format.number(
            (this.steal.total / this.batch_time) * 1000,
          )}/s)`
        : '')
    );
  }

  get_processes() {
    return [this.threads.hack, this.threads.weaken_hack, this.threads.grow, this.threads.weaken_grow].filter(
      (t) => t > 0,
    ).length;
  }
}

export function OptimalBatch(
  ns: NS,
  { hackRam, growRam, weakenRam }: { hackRam: number; growRam: number; weakenRam: number },
  server: string,
  {
    compute_servers = [] as { hostname: string; freeRam: number }[],
    max_batch_count = Infinity,
    max_process_count = Infinity,
    optimize_cleanup = false,
    cores = 1,
  },
  { extra_time = 0 },
  logger?: Logger,
) {
  const hack_so = ns.getServer(server) as Server;

  const total_ram = compute_servers.sum((cs) => cs.freeRam);
  let max_batch = new Batch();
  let cleanup_batch: Batch | undefined = undefined;

  const formulas = ns.fileExists('Formulas.exe');

  const need_cleanup =
    (hack_so.moneyAvailable ?? 0) < (hack_so.moneyMax ?? 0) ||
    (hack_so.hackDifficulty ?? 0) > (hack_so.minDifficulty ?? 100);
  const base_difficulty = hack_so.hackDifficulty ?? 0;

  const player = ns.getPlayer();

  const steal_percent = formulas ? ns.formulas.hacking.hackPercent(hack_so, player) : ns.hackAnalyze(server);
  const steal_amount = (hack_so.moneyMax ?? 0) * steal_percent;

  function calcHackThreads(hack_threads: number, hgw: boolean): Batch {
    const so = {
      moneyMax: 0,
      moneyAvailable: 0,
      hackDifficulty: 0,
      minDifficulty: 0,
      ...(ns.getServer(server) as Server),
    };
    if (hack_threads > 0) {
      so.hackDifficulty = so.minDifficulty;
      so.moneyAvailable = so.moneyMax;
    }
    const weaken_time = formulas ? ns.formulas.hacking.weakenTime(so, player) : ns.getWeakenTime(server);
    const weaken_effect = formulas ? ns.formulas.hacking.weakenEffect(1, cores) : ns.weakenAnalyze(1, cores);
    let batch_steal = steal_amount * hack_threads;
    if (batch_steal > so.moneyMax) batch_steal = so.moneyMax;

    do {
      so.hackDifficulty = so.hackDifficulty + ns.hackAnalyzeSecurity(hack_threads);
      so.moneyAvailable = so.moneyAvailable - batch_steal;
      if (so.moneyAvailable === 0) so.moneyAvailable = 1;

      const hweak_target = so.hackDifficulty - so.minDifficulty;

      let weaken_hack_threads = hgw ? 0 : Math.ceil(hweak_target / weaken_effect);
      if (!hgw) {
        so.hackDifficulty = so.minDifficulty;
      }

      let grow_threads = formulas
        ? ns.formulas.hacking.growThreads(so, player, so.moneyMax, cores)
        : Math.ceil(ns.growthAnalyze(server, so.moneyMax / so.moneyAvailable, cores));

      so.hackDifficulty += ns.growthAnalyzeSecurity(grow_threads);
      const gweak_target = so.hackDifficulty - so.minDifficulty;
      let weaken_grow_threads = Math.ceil(gweak_target / weaken_effect);
      if (weaken_grow_threads > 0) ++weaken_grow_threads;

      if (
        optimize_cleanup &&
        hack_threads == 0 &&
        grow_threads * growRam + (weaken_hack_threads + weaken_grow_threads) * weakenRam > compute_servers[0].freeRam
      ) {
        so.hackDifficulty = base_difficulty;
        if (so.moneyMax / so.moneyAvailable > 1.01) {
          so.moneyAvailable = (so.moneyAvailable + so.moneyMax) / 2;
          continue;
        } else {
          [grow_threads, weaken_hack_threads] = [0, 0];
          weaken_grow_threads = Math.floor(compute_servers[0].freeRam / weakenRam);
        }
      }
      const ram =
        hack_threads * hackRam + grow_threads * growRam + (weaken_hack_threads + weaken_grow_threads) * weakenRam;
      const process_count = [hack_threads, grow_threads, weaken_hack_threads, weaken_grow_threads].filter(
        (t) => t > 0,
      ).length;

      const batch_count = Math.min(
        compute_servers.sum((cs) => Math.floor(cs.freeRam / ram)),
        max_batch_count,
        Math.floor(max_process_count / process_count),
      );

      const batch_time = weaken_time + extra_time;

      return new Batch(
        {
          hack: hack_threads,
          weaken_hack: weaken_hack_threads,
          grow: grow_threads,
          weaken_grow: weaken_grow_threads,
        },
        ram,
        batch_time,
        {
          total: batch_count * batch_steal,
          per_batch: batch_steal,
          percent: steal_percent * hack_threads,
        },
      );
    } while (true);
  }

  if (need_cleanup) {
    const cleanup_batches = [calcHackThreads(0, false), calcHackThreads(0, true)];
    cleanup_batch = cleanup_batches[0].ram >= cleanup_batches[1].ram ? cleanup_batches[1] : cleanup_batches[0];
  }
  if (!optimize_cleanup) {
    const limit =
      steal_amount === 0
        ? 0
        : Math.min(compute_servers[0].freeRam / (hackRam + growRam + 2 * weakenRam), Math.ceil(1 / steal_percent));
    let optimal_strike = 0;

    for (let hack_threads = 1; hack_threads <= limit; hack_threads++) {
      const omni_threads = [calcHackThreads(hack_threads, false), calcHackThreads(hack_threads, true)];
      if (omni_threads.every((t) => t.ram > compute_servers[0].freeRam)) break;
      for (const threads of omni_threads) {
        logger?.Log(
          `${hack_threads}|${threads.threads.weaken_hack}|${threads.threads.grow}|${
            threads.threads.weaken_grow
          }: ${ns.format.ram(threads.ram)} ${ns.format.number(threads.steal.per_batch)}(${ns.format.percent(
            threads.steal.per_batch / (hack_so.moneyMax ?? 0),
          )} t: ${ns.format.number(threads.steal.total)}`,
        );
        if (
          threads.steal.total > max_batch.steal.total ||
          (threads.steal.total == max_batch.steal.total && threads.ram < max_batch.ram)
        ) {
          max_batch = threads;
          optimal_strike = 0;
        } else {
          ++optimal_strike;
        }
      }
      if (optimal_strike > 3) break;
      if (omni_threads.every((t) => t.steal.per_batch == (hack_so.moneyMax ?? 0))) {
        if (max_batch.steal.per_batch === 0)
          max_batch = omni_threads[0].ram >= omni_threads[1].ram ? omni_threads[1] : omni_threads[0];
        break;
      }
    }
  }
  return {
    batches: {
      optimal: max_batch,
      cleanup: cleanup_batch,
    },
    hostname: server,
    hack_chance: formulas ? ns.formulas.hacking.hackChance(hack_so, player) : ns.hackAnalyzeChance(server),
    time: {
      hack: formulas ? ns.formulas.hacking.hackTime(hack_so, player) : ns.getHackTime(server),
      grow: formulas ? ns.formulas.hacking.growTime(hack_so, player) : ns.getGrowTime(server),
      weaken: formulas ? ns.formulas.hacking.weakenTime(hack_so, player) : ns.getWeakenTime(server),
    },
    so: ns.getServer(server) as Server,
    need_cleanup,
  };
}
