import { Logger } from "../../utility/log"
import { PortNumbers } from "../../utility/constants"
import { HackOperationResultPacket, HackOperation } from "../../utility/network_packets"
import { ConvertToFlagsData, Hacking } from "@/utility/flags";

const flags_struct: Hacking.HackArgs & Hacking.HackFinishAtArgs & Hacking.HackRunAtArgs & Hacking.HackDelayUniArgs= {
  target: "",
  finish_at: -1,
  process_time: -1,
  run_at: -1,
  delay:-1,
  log_file: "",
  port_index: PortNumbers.multi_hack_in,
  operation: "" as HackOperation,
  log_prefix: ""
}
const flags_data = ConvertToFlagsData(flags_struct);

export async function main(ns: NS) {
  const flag = ns.flags(flags_data) as typeof flags_struct;
  const target = flag.target as string;

  let logger = new Logger(ns, { log_file: flag.log_file ? flag.log_file : undefined, clean: false, extra_name: target });
  logger.prefix = `${ns.pid}${flag.log_prefix}: `
  logger.include_timestamp = true;
  logger.Log(`args: ${JSON.stringify(ns.args)}`);
  if (flag.operation.length === 0) {
    throw "Operation is not set!";
  }

  let ram_override = ns.ramOverride(1.6 + ns.getFunctionRamCost(flag.operation));
  logger.Log(`Overrided RAM to ${ram_override}, function ${flag.operation} ram: ${ns.getFunctionRamCost(flag.operation)}'`);

  if (flag.run_at == -1) {
    if (flag.finish_at != -1 && flag.process_time != -1) {
      flag.run_at = flag.finish_at - flag.process_time;
      logger.Log(`Now: ${ns.format.time(performance.now(), true)} Finish at: ${ns.format.time(flag.finish_at, true)} process_time: ${ns.format.time(flag.process_time, true)} => run_at: ${ns.format.time(flag.run_at, true)}`)
      logger.Log(`Now: ${performance.now()} Finish at: ${flag.finish_at} process_time: ${flag.process_time} => run_at: ${flag.run_at}`);
    }
  }
  else {
    logger.Log(`Now: ${ns.format.time(performance.now(), true)} Run at: ${ns.format.time(flag.run_at, true)}`)
    logger.Log(`Now: ${performance.now()} Run at: ${flag.run_at}`)
  }

  function get_process_log() {
    let logs = ns.getScriptLogs();
    for (let l of logs) {
      if (l.startsWith(`${flag.operation}:`))
        logger.Log(l);
    }
  }
  if (flag.delay == -1)
    flag.delay = flag.run_at - performance.now();
  logger.Log(`Running ${flag.operation} on ${target} in ${flag.delay.toFixed(3)}. Now is ${performance.now().toFixed(2)}`);
  flag.delay = Math.max(0, flag.delay);

  const result = await ns[flag.operation](target, { additionalMsec: flag.delay });
  get_process_log();

  logger.Log(`operation ${flag.operation} ended on ${target}. Result: ${result}`);
  let return_data = new HackOperationResultPacket(target, result, flag.operation, ns.pid);
  //ns.tryWritePort(port_index, JSON.stringify(return_data));
}

export function autocomplete(data: AutocompleteData, args: ScriptArg[]) {
  if (args.at(-1) == "--target" || (args.at(-2) == "--target" && !data.command.endsWith(' ')))
    return [...data.servers];

  if (args.at(-1) == "--operation" || (args.at(-2) == "--operation" && !data.command.endsWith(' ')))
    return ["hack", "grow", "weaken"];

  data.flags(flags_data);
  return ["--tail"];
}