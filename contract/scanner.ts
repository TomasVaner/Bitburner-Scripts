import { GetAllServers } from "../utility/scanner"
import { PortNumbers, ScriptNames, FileNames, Strings } from "../utility/constants"
import { Logger } from "../utility/log"
import { PacketType, NetworkPacket, DarknetContractReportPacket, ContractSolveResultPacket } from "../utility/network_packets"
import  { ConvertToArgs, Contract} from "@/utility/flags"

const flags_data = [["ignore_darknet", false]] as [[string, boolean]]

export async function main(ns: NS) {
  ns.disableLog('scan');
  ns.disableLog('run');
  ns.disableLog('asleep');
  ns.disableLog('sleep');
  ns.disableLog('getServer');

  let flag = ns.flags(flags_data);
  let ignore_darknet = flag.ignore_darknet as boolean;

  ns.clearPort(PortNumbers.contract_scanner_in);

  let logger = new Logger(ns);

  let solvable_types : Partial<Record<CodingContractName, boolean>> = {
    "Subarray with Maximum Sum":true,
    "Algorithmic Stock Trader I":true,
    "Find Largest Prime Factor":true,
    "Encryption I: Caesar Cipher":true,
    "Total Ways to Sum":true,
    "Largest Rectangle in a Matrix":true,
    "Array Jumping Game":true,
    "Total Number of Primes":true,
    "Square Root":true,
    "HammingCodes: Integer to Encoded Binary":true,
    "Compression I: RLE Compression":true,
    "Find All Valid Math Expressions": true,
    "Generate IP Addresses": true,
    "Proper 2-Coloring of a Graph": true,
    "Unique Paths in a Grid II": true,
    "Spiralize Matrix": true,
  };

  let waiting_script = [] as number[];
  for (let ctype in solvable_types) {
    let args: Contract.Solver.TypeSolverArgs = {
      type: ctype as CodingContractName
    }
    if (ns.isRunning(ScriptNames.constract_solver, ns.getHostname(), ...ConvertToArgs(args))) {
      logger.Log(`ERROR: ${ctype} solver is still running!`);
      waiting_script.forEach(pid => { ns.kill(pid) });
      return;
    }
    while (true) {
      let pid = ns.run(ScriptNames.constract_solver, 1, ...ConvertToArgs(args));
      if (pid != 0) {
        logger.Log(`Started solver for ${ctype}`);
        waiting_script.push(pid);
        await ns.sleep(0);
        await ns.sleep(0);
        break;
      }
      else
        await ns.asleep(100);
    }
  }

  let wating = [...Object.keys(solvable_types)];
  let timeout = performance.now() + 10000;

  let darknet_servers = ["darkweb"] as string[];

  if (ns.fileExists(FileNames.password_database))
  {
    let passwords = JSON.parse(ns.read(FileNames.password_database));
    darknet_servers = [...darknet_servers, ...Object.keys(passwords)];
  }

  
  logger.Log(`Started processing packets ${performance.now().toFixed(1)}`);
  do {
    ProcessPackets();
    if (performance.now() > timeout) {
      logger.Log(`[${wating}] were timed out (${performance.now().toFixed(1)})`);
      waiting_script.forEach(pid => { ns.kill(pid) });
      return;
    }
    await ns.asleep(500);
  } while (wating.length > 0)

  logger.Log(`Known types were tested successfully.`);

  let known_types = [] as CodingContractName[];

  while (true) {
    let servers = GetAllServers(ns);
    for (let server of [...(ignore_darknet ? [] : darknet_servers), ...servers]) {
      if(!ns.serverExists(server))
        continue;

      let contracts = ns.ls(server, '.cct');
      if (contracts.length == 0)
        continue;

      for (let contract of contracts) {
        if (wating.includes(`${server}/${contract}`))
          continue;

        let ctype = ns.codingcontract.getContractType(contract, server);
        if (solvable_types[ctype]) {
          logger.Log(`Trying to solve '${ctype}' contract (${server}/${contract})`);

          let args: Contract.Solver.FileSolverArgs = {
            filename: contract, hostname: server, type: ctype
          }
          let pid = ns.run(ScriptNames.constract_solver, 1, ...ConvertToArgs(args));
          if (pid != 0) {
            waiting_script.push(pid);
            wating.push(`${server}/${contract}`);
          }
        }
        else if (!known_types.includes(ctype) && !(ctype in solvable_types)) {
          logger.Log(`WARNING: new contract type ${ctype}: ${server}/${contract}`, { global_log: true });
          let co = ns.codingcontract.getContract(contract, server);
          let string_data = "";
          try {
            string_data = JSON.stringify(co.data)
          }
          catch(_) {
            string_data = co.data.toString();
          }
          logger.Log(`type: ${co.type} data: ${string_data}, desc: ${co.description}, diff: ${co.difficulty}`, { global_log: true});
          known_types.push(ctype);
        }
      }
    }

    ProcessPackets();
    await ns.asleep(1000);
  }

  function ProcessPackets() {
    while (ns.peek(PortNumbers.contract_scanner_in) != Strings.null_port_data) {
      let s = ns.readPort(PortNumbers.contract_scanner_in);
      logger.Log(s);
      let packet = JSON.parse(s) as NetworkPacket;
      switch (packet.type) {
        case PacketType.contract_solve_result:
          let solve_result = packet as ContractSolveResultPacket;
          wating = wating.filter(t => t != (solve_result.file ? `${solve_result.server}/${solve_result.file}` : solve_result.ctype));
          waiting_script = waiting_script.filter(pid => pid != solve_result.pid);
          logger.Log(`${darknet_servers.includes(solve_result.server) ? "WARNING" : "INFO"}: ${solve_result.ctype} was solved. Reward: '${solve_result.reward}' (${solve_result.server}/${solve_result.file})`);
          if (solve_result.reward.length == 0 && solvable_types[solve_result.ctype]) {
            throw `Could not solve known type ${packet.type}`;
          }
          break;
        case PacketType.darknet_contract:
          {
            let darknet_contract = packet as DarknetContractReportPacket;
            if (!darknet_servers.includes(darknet_contract.server)) {
              logger.Log(`INFO: darknet server '${darknet_contract.server}' will be scanned for contracts now`);
              darknet_servers.push(darknet_contract.server);
            }
          }
      }
    }
  }
}

export function autocomplete(data:AutocompleteData, args:ScriptArg[]) {
  data.flags(flags_data);
  return ["--tail"];
}