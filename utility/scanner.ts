
export function GetFreeRam(ns:NS, server: string)
{
  return ns.getServerMaxRam(server) - ns.getServerUsedRam(server);
}

export function Weight(ns : NS, server : string):number {
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

export function GetAllServers(ns : NS, root = 'home', found : string[] = [], {print_route= false, shift=''} = {}) : string[] {
	found.push(root);
	if (print_route)
	{
		ns.tprint(shift, root);
	}
	let connected_servers = (root == 'home' ? ns.scan(root) : ns.scan(root).slice(1));
	for (let s_ind = 0; s_ind < connected_servers.length; ++s_ind)
	{
		let next_shift = shift.replace('┗', ' ').replace('┣', '┃');
		next_shift += s_ind == connected_servers.length - 1 ? '┗' : '┣'
		GetAllServers(ns, connected_servers[s_ind], found, {print_route, shift:next_shift});
	}

	return found;
}

export function GetRoute(ns : NS, hostname:string, root = 'home', found : string[] = [], current_route:string[] = []) : string[] {
	found.push(root);
	current_route.push(root);
	let connected_servers = ns.scan(root).filter(s => !found.includes(s));
	for (let server of connected_servers)
	{
		if (server === hostname)
		{
			current_route.push(server);
			return current_route;
		}
		let ret = GetRoute(ns, hostname, server, found, [...current_route]);
		if (ret.length > 0)
			return ret;
	}

	return [];
}