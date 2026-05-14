import { GetAllServers } from './scanner';

export async function main(ns: NS) {
  const servers = GetAllServers(ns);
  for (const server of servers) {
    const files = ns.ls(server, 'logs/');
    for (const file of files) {
      ns.rm(file, server);
      ns.print(`@${server}:/${file}`);
    }
  }
}
