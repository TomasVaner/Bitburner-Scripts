import { Logger } from '@/utility/log';

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
  { print_route = false, shift = '' } = {},
): string[] {
  found.push(root);
  if (print_route) {
    ns.tprint(shift, root);
  }
  const connected_servers = root == 'home' ? ns.scan(root) : ns.scan(root).slice(1);
  for (let s_ind = 0; s_ind < connected_servers.length; ++s_ind) {
    let next_shift = shift.replace('┗', ' ').replace('┣', '┃');
    next_shift += s_ind == connected_servers.length - 1 ? '┗' : '┣';
    GetAllServers(ns, connected_servers[s_ind], found, { print_route, shift: next_shift });
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

export function OptimalBatch(
  ns: NS,
  { hackRam, growRam, weakenRam }: { hackRam: number; growRam: number; weakenRam: number },
  server: string,
  { max_ram = 0, max_batch_count = Infinity, max_process_count = Infinity, optmize_cleanup: optimize_cleanup = false },
  { extra_time = 0, delay = 0 },
  logger?: Logger,
) {
  const so = ns.getServer(server) as Server;

  let max_batch = {
    threads: {
      hack: 0,
      weaken_hack: 0,
      grow: 0,
      weaken_grow: 0,
    },
    ram: Infinity,
    batch_time: Infinity,
    steal: {
      total: 0,
      per_batch: 0,
      per_gb: 0,
    },
  };

  const formulas = ns.fileExists('Formulas.exe');

  const need_cleanup =
    (so.moneyAvailable ?? 0) < (so.moneyMax ?? 0) || (so.hackDifficulty ?? 0) > (so.minDifficulty ?? 100);
  const base_difficulty = so.hackDifficulty ?? 0;

  const player = ns.getPlayer();

  const steal_percent = formulas ? ns.formulas.hacking.hackPercent(so, player) : ns.hackAnalyzeChance(server);
  const steal_amount = (so.moneyMax ?? 0) * steal_percent;
  const weaken_time = formulas ? ns.formulas.hacking.weakenTime(so, player) : ns.getWeakenTime(server);

  function calcHackThreads(hack_threads: number, hgw: boolean) {
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
    let batch_steal = steal_amount * hack_threads;
    if (batch_steal > so.moneyMax) batch_steal = so.moneyMax;

    do {
      so.hackDifficulty = so.hackDifficulty + ns.hackAnalyzeSecurity(hack_threads);
      so.moneyAvailable = so.moneyAvailable - batch_steal;
      if (so.moneyAvailable === 0) so.moneyAvailable = 1;

      const hweak_target = so.hackDifficulty - so.minDifficulty;

      const weaken_hack_threads = hgw
        ? 0
        : Math.ceil(hweak_target / (formulas ? ns.formulas.hacking.weakenEffect(1) : ns.weakenAnalyze(1)));
      if (!hgw) {
        so.hackDifficulty = so.minDifficulty;
      }

      const grow_threads = formulas
        ? ns.formulas.hacking.growThreads(so, player, so.moneyMax)
        : Math.ceil(ns.growthAnalyze(server, so.moneyMax / so.moneyAvailable));

      so.hackDifficulty += ns.growthAnalyzeSecurity(grow_threads);
      const gweak_target = so.hackDifficulty - so.minDifficulty;
      const weaken_grow_threads =
        Math.ceil(gweak_target / (formulas ? ns.formulas.hacking.weakenEffect(1) : ns.weakenAnalyze(1))) + 1;

      const ram =
        hack_threads * hackRam + grow_threads * growRam + (weaken_hack_threads + weaken_grow_threads) * weakenRam;
      const process_count = [hack_threads, grow_threads, weaken_hack_threads, weaken_grow_threads].filter(
        (t) => t > 0,
      ).length;

      if (optimize_cleanup && hack_threads == 0 && ram > max_ram) {
        so.hackDifficulty = base_difficulty;
        if (so.moneyMax / so.moneyAvailable > 1.01) {
          so.moneyAvailable = (so.moneyAvailable * 9 + so.moneyMax) / 10;
          continue;
        } else if (base_difficulty - so.minDifficulty > 1) {
          so.minDifficulty = (so.minDifficulty * 9 + base_difficulty) / 10;
          continue;
        }
      }

      const batch_count = Math.min(
        Math.floor(max_ram / ram),
        max_batch_count,
        Math.floor(max_process_count / process_count),
      );

      const batch_time = weaken_time + extra_time + delay * batch_count;

      return {
        threads: {
          hack: hack_threads,
          weaken_hack: weaken_hack_threads,
          grow: grow_threads,
          weaken_grow: weaken_grow_threads,
        },
        ram,
        batch_time,
        steal: {
          total: batch_count * batch_steal,
          per_batch: batch_steal,
          per_gb: batch_steal / ram,
        },
      };
    } while (true);
  }

  if (need_cleanup) {
    const cleanup_batches = [calcHackThreads(0, false), calcHackThreads(0, true)];
    max_batch = cleanup_batches[0].ram >= cleanup_batches[1].ram ? cleanup_batches[1] : cleanup_batches[0];
  } else {
    for (let hack_threads = 1; hack_threads <= max_ram / (hackRam + growRam + 2 * weakenRam); hack_threads++) {
      const omni_threads = [calcHackThreads(hack_threads, false), calcHackThreads(hack_threads, true)];
      if (omni_threads.every((t) => t.ram > max_ram)) break;
      for (const threads of omni_threads) {
        logger?.Log(
          `${hack_threads}|${threads.threads.weaken_hack}|${threads.threads.grow}|${
            threads.threads.weaken_grow
          }: ${ns.format.ram(threads.ram)} ${ns.format.number(threads.steal.per_batch)} t: ${ns.format.number(
            threads.steal.total,
          )}`,
        );
        if (threads.ram > max_ram) break;
        if (
          threads.steal.total > max_batch.steal.total ||
          (threads.steal.total == max_batch.steal.total && threads.ram < max_batch.ram)
        ) {
          max_batch = threads;
        }
      }
      if (omni_threads.every((t) => t.steal.per_batch == (so.moneyMax ?? 0))) {
        if (max_batch.steal.per_batch === 0)
          max_batch = omni_threads[0].ram >= omni_threads[1].ram ? omni_threads[1] : omni_threads[0];
        break;
      }
    }
  }
  return {
    ...max_batch,
    hostname: server,
    hack_chance: formulas ? ns.formulas.hacking.hackChance(so, player) : ns.hackAnalyzeChance(server),
    steal: {
      ...max_batch.steal,
      per_gb_per_s: (max_batch.steal.per_batch / max_batch.ram / max_batch.batch_time) * 1000,
      per_s: (max_batch.steal.per_batch / max_batch.batch_time) * 1000,
    },
    time: {
      hack: formulas ? ns.formulas.hacking.hackTime(so, player) : ns.getHackTime(server),
      grow: formulas ? ns.formulas.hacking.growTime(so, player) : ns.getGrowTime(server),
      weaken: weaken_time,
      batch: max_batch.batch_time,
    },
    so: ns.getServer(server) as Server,
    cleanup: need_cleanup,
  };
}
