import { GetAllServers } from "./scanner";


export async function main(ns: NS) {
	let servers = GetAllServers(ns);
	for (let server of servers)
	{
		let files = ns.ls(server, "logs/")
		for (let file of files)
		{
			ns.rm(file, server);
			ns.print(`@${server}:/${file}`);
		}
	}
}
