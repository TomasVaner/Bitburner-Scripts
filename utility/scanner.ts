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
  { max_batch_ram = Infinity, min_batch_ram = 0, cleanup = true, hgw = false },
  { extra_time = 0 },
) {
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
    cleanup && ((so.moneyAvailable ?? 0) < (so.moneyMax ?? 0) || (so.hackDifficulty ?? 0) > (so.minDifficulty ?? 100));
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
